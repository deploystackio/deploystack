import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CredentialStorage } from '../core/auth/storage';
import { MCPConfigService } from '../core/mcp';
import { TableFormatter } from '../utils/table';
import { AuthenticationError } from '../types/auth';
import { RefreshService } from '../services/refresh-service';

// PID file location
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export function registerMCPCommand(program: Command) {
  program
    .command('mcp')
    .description('Manage MCP server configurations')
    .option('--refresh', 'Force refresh MCP configuration from API')
    .option('--status', 'Show MCP configuration status')
    .option('--tools <server-number>', 'Discover and list tools from a specific MCP server')
    .option('--clear', 'Clear stored MCP configuration')
    .option('--url <url>', 'DeployStack backend URL (override stored URL)')
    .action(async (options) => {
      const storage = new CredentialStorage();
      const mcpService = new MCPConfigService();
      let spinner: ReturnType<typeof ora> | null = null;

      try {
        // Handle clear mode
        if (options.clear) {
          console.log(chalk.blue('🗑️  Clearing MCP configuration...'));
          spinner = ora('Clearing stored MCP configuration...').start();
          await mcpService.clearMCPConfig();
          spinner.succeed('MCP configuration cleared');
          console.log(chalk.green('✅ MCP configuration has been cleared'));
          return;
        }

        // Handle tools discovery mode - CRITICAL CHANGE: Only works when gateway is running
        if (options.tools) {
          const serverNumber = parseInt(options.tools, 10);
          
          if (isNaN(serverNumber) || serverNumber < 1) {
            console.log(chalk.red(`❌ Invalid server number "${options.tools}". Please use a positive number.`));
            console.log(chalk.gray('💡 Use "deploystack mcp" to see available servers'));
            process.exit(1);
          }

          // CRITICAL: Check if gateway is running first
          if (!isGatewayRunning()) {
            console.log(chalk.red('❌ Gateway is not running'));
            console.log(chalk.gray('💡 Use "deploystack start" to start the gateway first'));
            console.log(chalk.gray('💡 The --tools command only works with running MCP servers'));
            process.exit(1);
          }

          // Check authentication for tools mode
          if (!await storage.isAuthenticated()) {
            console.log(chalk.red('❌ Not authenticated'));
            console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
            process.exit(1);
          }

          const credentials = await storage.getCredentials();
          if (!credentials) {
            console.log(chalk.red('❌ No stored credentials found'));
            console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
            process.exit(1);
          }

          if (!credentials.selectedTeam) {
            console.log(chalk.red('❌ No team selected'));
            console.log(chalk.gray(`💡 Run 'deploystack teams --switch <team-number>' to select a team`));
            process.exit(1);
          }

          // Get MCP configuration
          const config = await mcpService.getMCPConfig();
          if (!config || config.servers.length === 0) {
            console.log(chalk.yellow('⚠️  No MCP servers configured'));
            console.log(chalk.gray('💡 Run "deploystack mcp --refresh" to download configuration'));
            process.exit(1);
          }

          if (serverNumber > config.servers.length) {
            console.log(chalk.red(`❌ Server number ${serverNumber} not found. Available servers: 1-${config.servers.length}`));
            console.log(chalk.gray('Available servers:'));
            config.servers.forEach((server, index) => {
              console.log(chalk.gray(`  ${index + 1}. ${server.installation_name}`));
            });
            process.exit(1);
          }

          const selectedServer = config.servers[serverNumber - 1];
          
          console.log(chalk.gray(`🎯 Server: ${chalk.cyan(selectedServer.installation_name)}`));
          console.log(chalk.gray(`🌐 Team: ${chalk.cyan(credentials.selectedTeam.name)}`));
          console.log(chalk.blue('🔗 Communicating with running MCP server...\n'));

          // NEW: Communicate with already-running MCP server via HTTP
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let tools: any[] = [];

          try {
            // Get tools from the running gateway server
            const gatewayTools = await fetchToolsFromRunningGateway(selectedServer.installation_name);
            
            if (gatewayTools.length === 0) {
              console.log(chalk.yellow('⚠️  No tools found in this MCP server'));
              console.log(chalk.gray('💡 The server may not expose any tools or may not be running properly'));
              console.log(chalk.gray('💡 Check "deploystack status" to see server status'));
              return;
            }

            tools = gatewayTools;
            console.log(chalk.green(`✅ Retrieved ${tools.length} tool${tools.length === 1 ? '' : 's'} from running server`));
            
          } catch (error) {
            console.error(chalk.red(`❌ Failed to communicate with running MCP server: ${error instanceof Error ? error.message : String(error)}`));
            console.log(chalk.gray('💡 Check "deploystack status" to see if the server is running'));
            console.log(chalk.gray('💡 Try restarting the gateway with "deploystack stop && deploystack start"'));
            process.exit(1);
          }
          
          console.log(chalk.blue(`🛠️  Available Tools`));
          
          const table = TableFormatter.createTable({
            head: ['#', 'Tool Name', 'Description', 'Parameters'],
            colWidths: [3, 25, 40, 30]
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools.forEach((tool: any, index: number) => {
            // Format parameters
            const requiredParams = tool.inputSchema.required || [];
            const allParams = Object.keys(tool.inputSchema.properties || {});
            const paramDisplay = allParams.length > 0 
              ? allParams.map(param => requiredParams.includes(param) ? `${param}*` : param).join(', ')
              : 'None';

            table.push([
              chalk.cyan((index + 1).toString()),
              chalk.yellow(tool.name),
              TableFormatter.truncate(tool.description, 38),
              chalk.gray(TableFormatter.truncate(paramDisplay, 28))
            ]);
          });

          console.log(table.toString());

          // Show parameter details for tools with parameters
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolsWithParams = tools.filter((tool: any) => 
            tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0
          );

          if (toolsWithParams.length > 0) {
            console.log(chalk.blue('\n📋 Parameter Details:'));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toolsWithParams.forEach((tool: any) => {
              console.log(chalk.yellow(`\n${tool.name}:`));
              
              const properties = tool.inputSchema.properties || {};
              const required = tool.inputSchema.required || [];
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Object.entries(properties).forEach(([paramName, paramInfo]: [string, any]) => {
                const isRequired = required.includes(paramName);
                const requiredMark = isRequired ? chalk.red('*') : ' ';
                const description = paramInfo.description || 'No description';
                const type = paramInfo.type || 'unknown';
                
                console.log(chalk.gray(`  ${requiredMark} ${chalk.cyan(paramName)} (${type}): ${description}`));
              });
            });
            
            console.log(chalk.gray('\n💡 * = Required parameter'));
          }

          console.log(chalk.gray(`\n💡 Server: ${selectedServer.installation_name}`));
          console.log(chalk.gray(`💡 Runtime: ${selectedServer.runtime}`));
          console.log(chalk.gray(`💡 Command: ${selectedServer.command} ${selectedServer.args.join(' ')}`));
          console.log(chalk.blue('💡 Tools retrieved from running MCP server (not spawned)'));
          
          return;
        }

        // Check authentication
        if (!await storage.isAuthenticated()) {
          console.log(chalk.red('❌ Not authenticated'));
          console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
          process.exit(1);
        }

        const credentials = await storage.getCredentials();
        if (!credentials) {
          console.log(chalk.red('❌ No stored credentials found'));
          console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
          process.exit(1);
        }

        // Check if team is selected
        if (!credentials.selectedTeam) {
          console.log(chalk.red('❌ No team selected'));
          console.log(chalk.gray(`💡 Run 'deploystack teams --switch <team-number>' to select a team`));
          process.exit(1);
        }

        // Handle refresh mode
        if (options.refresh) {
          const refreshService = new RefreshService();
          await refreshService.refreshMCPConfiguration({ url: options.url });
          return;
        }

        // Handle status mode (default)
        const backendUrl = options.url || credentials.baseUrl || 'https://cloud.deploystack.io';
        
        console.log(chalk.blue(`🤖 MCP Configuration Status`));
        console.log(chalk.gray(`🎯 Current team: ${chalk.cyan(credentials.selectedTeam.name)}`));
        console.log(chalk.gray(` Backend: ${backendUrl}\n`));

        spinner = ora('Checking MCP configuration...').start();
        
        const summary = await mcpService.getMCPConfigSummary();
        const hasConfig = await mcpService.hasMCPConfig();
        const isFresh = await mcpService.isMCPConfigFresh(24); // 24 hours

        spinner.stop();

        if (!hasConfig) {
          console.log(chalk.yellow('⚠️  No MCP configuration found'));
          console.log(chalk.gray('💡 Run with --refresh to download configuration'));
          return;
        }

        if (!summary) {
          console.log(chalk.red('❌ Could not read MCP configuration'));
          return;
        }

        // Show configuration status
        console.log(chalk.green('✅ MCP Configuration Found'));
        console.log(`\n📊 Configuration Details:`);
        console.log(`   Team: ${chalk.cyan(summary.teamName)} (${summary.teamId})`);
        console.log(`   Servers: ${chalk.yellow(summary.serverCount.toString())}`);
        console.log(`   Last Updated: ${chalk.gray(new Date(summary.lastUpdated).toLocaleString())}`);

        // Show freshness status
        if (isFresh) {
          console.log(`   Status: ${chalk.green('Fresh ✅')}`);
        } else {
          console.log(`   Status: ${chalk.yellow('Stale ⚠️')} (>24h old)`);
          console.log(chalk.gray('💡 Consider running with --refresh to update'));
        }

        // Show MCP servers table
        if (summary.serverCount > 0) {
          const fullConfig = await mcpService.getMCPConfig();
          if (fullConfig && fullConfig.servers.length > 0) {
            console.log(chalk.blue('\n🤖 MCP Servers'));
            
            // Create table
            const table = TableFormatter.createTable({
              head: ['#', 'Server Name', 'Runtime'],
              colWidths: [3, 40, 15]
            });

            fullConfig.servers.forEach((server, index) => {
              table.push([
                chalk.cyan((index + 1).toString()),
                TableFormatter.truncate(server.installation_name, 38),
                chalk.gray(server.runtime)
              ]);
            });

            console.log(table.toString());
          }
          
          console.log(chalk.gray('\n💡 Use this configuration with "deploystack start" to run the gateway'));
          console.log(chalk.gray('💡 Use "deploystack mcp --refresh" to update from the cloud'));
          console.log(chalk.gray('💡 Use "deploystack mcp --tools <server-number>" to discover available tools'));
        } else {
          console.log(chalk.yellow('\n⚠️  No MCP servers configured for this team'));
          console.log(chalk.gray('💡 Install MCP servers via the web interface'));
        }

      } catch (error) {
        if (spinner) {
          spinner.fail('MCP operation failed');
        }

        if (error instanceof AuthenticationError) {
          console.log(chalk.red(`❌ Failed to access MCP configuration: ${error.message}`));
          
          if (error.code === 'TOKEN_EXPIRED') {
            console.log(chalk.gray(`💡 Run 'deploystack login' to refresh your authentication`));
          } else if (error.code === 'NETWORK_ERROR') {
            console.log(chalk.gray('💡 Check your internet connection and try again'));
          }
        } else {
          console.log(chalk.red(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
        }
        
        process.exit(1);
      }
    });
}

/**
 * Check if gateway is running by checking PID file
 */
function isGatewayRunning(): boolean {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return false;
    }

    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    
    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Fetch tools from running gateway server via HTTP
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchToolsFromRunningGateway(_serverName: string): Promise<any[]> {
  // const fetch = (await import('node-fetch')).default; // Unused variable
  
  try {
    // Note: The /mcp endpoint has been removed. This function would need to be updated
    // to use SSE + session-based messaging for proper MCP communication.
    // For now, we'll use the /status endpoint to check if tools are available.
    throw new Error('Direct MCP communication not available. Use "deploystack status" to see running servers.');

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to communicate with gateway: ${error.message}`);
    }
    throw new Error(`Failed to communicate with gateway: ${String(error)}`);
  }
}
