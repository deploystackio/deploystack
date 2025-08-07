import { Command } from 'commander';
import chalk from 'chalk';
import { ProxyServer } from '../core/server/proxy';
import { CredentialStorage } from '../core/auth/storage';
import { MCPConfigService } from '../core/mcp';
import { RuntimeState } from '../core/process/runtime-state';
import { ProcessManager } from '../core/process/manager';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// PID file location
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start the gateway server')
    .option('-p, --port <port>', 'Port to run the gateway on', '9095')
    .option('-h, --host <host>', 'Host to bind the gateway to', 'localhost')
    .option('-f, --foreground', 'Run in foreground (default is daemon mode)')
    .action(async (options) => {
      try {
        const port = parseInt(options.port, 10);
        const host = options.host;

        // Skip the running check if this is a daemon child process
        const isDaemonChild = process.env.DEPLOYSTACK_DAEMON === 'true';
        
        if (!isDaemonChild) {
          // Check if server is already running (only for parent process)
          if (isServerRunning()) {
            console.log(chalk.yellow('⚠️  Gateway server is already running'));
            console.log(chalk.gray('   Use "deploystack stop" to stop the server first'));
            process.exit(1);
          }
        }

        if (options.foreground) {
          // Run in foreground mode
          await startServer(port, host, true);
        } else {
          // Default daemon mode - fork the process
          await startDaemon(port, host);
        }

      } catch (error) {
        console.error(chalk.red('❌ Failed to start gateway:'), error);
        process.exit(1);
      }
    });
}

/**
 * Start daemon process by forking
 */
async function startDaemon(port: number, host: string): Promise<void> {
  console.log(chalk.blue('🚀 Starting DeployStack Gateway...'));

  // Get the current script path
  const scriptPath = process.argv[1]; // This is the compiled JS file
  
  
  // Spawn a truly detached daemon process
  const child = spawn(process.execPath, [scriptPath, 'start', '--foreground', '--port', port.toString(), '--host', host], {
    detached: true,
    stdio: 'ignore', // Completely ignore stdio for true daemon behavior
    env: { ...process.env, DEPLOYSTACK_DAEMON: 'true' }
  });

  console.log(chalk.gray(`   Spawned child process with PID: ${child.pid}`));

  // Write the child PID to the PID file
  writePidFile(child.pid!);

  // Immediately unref the child process so parent can exit
  child.unref();

  // Wait a moment to see if the process starts successfully
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if the process is still running
  try {
    process.kill(child.pid!, 0);
    console.log(chalk.green('✅ Gateway started as daemon'));
    console.log(chalk.gray(`   PID: ${child.pid}`));
    console.log(chalk.gray(`   SSE endpoint: http://${host}:${port}/sse`));
    console.log(chalk.gray(`   Messages: http://${host}:${port}/message`));
    console.log(chalk.gray('   Use "deploystack status" to check status'));
    console.log(chalk.gray('   Use "deploystack stop" to stop the server'));
  } catch {
    removePidFile();
    console.error(chalk.red('❌ Failed to start daemon process'));
    console.error(chalk.red('Error:'), 'Process died during startup');
    throw new Error('Failed to start daemon process: Process died during startup');
  }
}

/**
 * Start server in current process (foreground mode)
 * NEW: Now starts ALL MCP servers as persistent background processes
 */
async function startServer(port: number, host: string, foreground: boolean): Promise<void> {
  if (!foreground) {
    console.log(chalk.blue('🚀 Starting DeployStack Gateway...'));
  }

  // Initialize core components for persistent process management
  const credentialStorage = new CredentialStorage();
  const mcpConfigService = new MCPConfigService();
  const runtimeState = new RuntimeState();
  const processManager = new ProcessManager();
  
  // Create proxy server with shared instances for runtime state integration
  const server = new ProxyServer(processManager, mcpConfigService, credentialStorage);

  // Setup graceful shutdown - NEW: Now stops ALL MCP servers first
  const shutdown = async () => {
    console.log(chalk.yellow('\n🛑 Received shutdown signal...'));
    try {
      // Step 1: Stop all MCP servers gracefully (following MCP spec)
      console.log(chalk.gray('   Stopping MCP servers...'));
      await processManager.stopAllServers({ 
        timeout: 10000, 
        showProgress: true 
      });

      // Step 2: Stop HTTP proxy server
      console.log(chalk.gray('   Stopping HTTP server...'));
      await server.stop();

      // Step 3: Clean up
      removePidFile();
      console.log(chalk.green('✅ Gateway shutdown complete'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Error during shutdown:'), error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Step 1: Check authentication and team selection
    if (!await credentialStorage.isAuthenticated()) {
      console.log(chalk.red('❌ Not authenticated'));
      console.log(chalk.gray('💡 Run "deploystack login" to authenticate first'));
      process.exit(1);
    }

    const credentials = await credentialStorage.getCredentials();
    if (!credentials?.selectedTeam) {
      console.log(chalk.red('❌ No team selected'));
      console.log(chalk.gray('💡 Run "deploystack teams --switch <team-number>" to select a team'));
      process.exit(1);
    }

    // Step 2: Load team MCP configuration
    console.log(chalk.blue(`📋 Loading MCP configuration for team: ${credentials.selectedTeam.name}`));
    
    let teamConfig;
    try {
      teamConfig = await mcpConfigService.getMCPConfig(credentials.selectedTeam.id);
      
      if (!teamConfig) {
        console.log(chalk.yellow('⚠️  No MCP configuration found'));
        console.log(chalk.gray('💡 Run "deploystack mcp --refresh" to download team configurations'));
        
        // Continue without MCP servers - just start HTTP server
        teamConfig = {
          team_id: credentials.selectedTeam.id,
          team_name: credentials.selectedTeam.name,
          installations: [],
          servers: [],
          last_updated: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to load MCP configuration: ${error instanceof Error ? error.message : String(error)}`));
      console.log(chalk.gray('💡 Continuing without MCP servers - only HTTP proxy will be available'));
      
      // Continue without MCP servers
      teamConfig = {
        team_id: credentials.selectedTeam.id,
        team_name: credentials.selectedTeam.name,
        installations: [],
        servers: [],
        last_updated: new Date().toISOString()
      };
    }

    // Step 3: Set team context in runtime state
    runtimeState.setCurrentTeam(teamConfig.team_id);

    // Step 4: Start all MCP servers as persistent background processes
    if (teamConfig.servers.length > 0) {
      console.log(chalk.blue(`🚀 Starting ${teamConfig.servers.length} MCP server${teamConfig.servers.length === 1 ? '' : 's'}...`));
      
      const startResult = await processManager.startAllServers(teamConfig, {
        continueOnError: true,
        showProgress: true
      });

      // Add all started processes to runtime state
      for (const processInfo of startResult.processes) {
        const installation = teamConfig.installations.find(
          inst => inst.installation_name === processInfo.config.installation_name
        );
        const installationId = installation?.id || processInfo.config.installation_name;

        runtimeState.addProcess(
          processInfo,
          installationId,
          processInfo.config.installation_name,
          teamConfig.team_id
        );
      }

      if (startResult.successfulStarts > 0) {
        console.log(chalk.green(`✅ Successfully started ${startResult.successfulStarts}/${startResult.totalServers} MCP servers`));
        console.log(chalk.gray(`   Servers available: ${startResult.processes.map(p => p.config.installation_name).join(', ')}`));
      }

      if (startResult.failedStarts > 0) {
        console.log(chalk.yellow(`⚠️  ${startResult.failedStarts} server${startResult.failedStarts === 1 ? '' : 's'} failed to start`));
        startResult.errors.forEach(error => {
          console.log(chalk.gray(`   ${error.serverName}: ${error.error}`));
        });
      }
    } else {
      console.log(chalk.gray('   No MCP servers configured for this team'));
    }

    // Step 5: Start HTTP proxy server
    console.log(chalk.blue('🌐 Starting HTTP proxy server...'));
    await server.start(port, host);

    // Step 6: Write PID file
    writePidFile(process.pid);

    // Step 7: Show startup summary
    console.log(chalk.green(`🚀 DeployStack Gateway listening at:`));
    console.log(chalk.blue(`   📡 SSE endpoint: http://${host}:${port}/sse`));
    console.log(chalk.blue(`   📨 Messages: http://${host}:${port}/message`));
    console.log(chalk.gray(`   📊 Health check: http://${host}:${port}/health`));
    
    const runningProcesses = runtimeState.getRunningTeamProcesses(teamConfig.team_id);
    console.log(chalk.blue(`🤖 Ready to serve ${runningProcesses.length} MCP server${runningProcesses.length === 1 ? '' : 's'} for team: ${teamConfig.team_name}`));

    if (foreground) {
      console.log(chalk.green('✅ Gateway started in foreground mode'));
      console.log(chalk.gray('   Press Ctrl+C to stop the server'));
    }

    // Keep the process alive
    await new Promise(() => {}); // Run forever until shutdown

  } catch (error) {
    console.error(chalk.red('❌ Failed to start gateway:'), error);
    
    // Clean up any started processes
    try {
      await processManager.stopAllServers({ timeout: 5000, showProgress: false });
    } catch (cleanupError) {
      console.error(chalk.red('❌ Error during cleanup:'), cleanupError);
    }
    
    removePidFile();
    throw error;
  }
}

/**
 * Check if server is already running by checking PID file
 */
function isServerRunning(): boolean {
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
      // Process doesn't exist, remove stale PID file
      removePidFile();
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Write PID file
 */
function writePidFile(pid: number): void {
  try {
    fs.writeFileSync(PID_FILE, pid.toString());
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not write PID file:'), error);
  }
}

/**
 * Remove PID file
 */
function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not remove PID file:'), error);
  }
}
