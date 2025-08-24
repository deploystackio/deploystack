import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { MCPConfigService } from '../core/mcp';
import { ServerRestartService } from './server-restart-service';
import { AuthenticationError } from '../types/auth';
import { TeamMCPConfig, MCPServerConfig } from '../types/mcp';
import { detectDeviceInfo } from '../utils/device-detection';

export interface RefreshOptions {
  url?: string;
}

export class RefreshService {
  private storage: CredentialStorage;
  private mcpService: MCPConfigService;
  private restartService: ServerRestartService;

  constructor() {
    this.storage = new CredentialStorage();
    this.mcpService = new MCPConfigService();
    this.restartService = new ServerRestartService();
  }

  /**
   * Refresh MCP server configurations from the cloud control plane
   * @param options Refresh options including optional backend URL override
   */
  async refreshMCPConfiguration(options: RefreshOptions = {}): Promise<void> {
    let spinner: ReturnType<typeof ora> | null = null;

    try {
      // Check authentication
      if (!await this.storage.isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated'));
        console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
        process.exit(1);
      }

      const credentials = await this.storage.getCredentials();
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

      const backendUrl = options.url || credentials.baseUrl || 'https://cloud.deploystack.io';
      const api = new DeployStackAPI(credentials, backendUrl);

      console.log(chalk.blue(`🔄 Refreshing MCP configuration using new gateway endpoint`));
      
      // Step 1: Detect device and get device ID
      spinner = ora('Detecting device and downloading latest MCP configurations...').start();
      
      try {
        // Detect current device information
        const deviceInfo = await detectDeviceInfo();
        
        // Download merged configurations using the new gateway endpoint
        // Backend will automatically find device by hardware_id
        const gatewayConfig = await this.mcpService.downloadGatewayMCPConfig(deviceInfo.hardware_id, api, false);
        
        const readyServers = gatewayConfig.servers.filter(s => s.status === 'ready');
        const invalidServers = gatewayConfig.servers.filter(s => s.status === 'invalid');
        
        spinner.succeed(`Gateway MCP configurations refreshed (${readyServers.length} ready, ${invalidServers.length} invalid)`);
        console.log(chalk.green('✅ MCP configuration has been refreshed using new three-tier system'));
        
        if (invalidServers.length > 0) {
          console.log(chalk.yellow(`\n⚠️  ${invalidServers.length} server${invalidServers.length === 1 ? '' : 's'} marked as invalid:`));
          invalidServers.forEach(server => {
            console.log(chalk.gray(`   • ${server.name} - Missing required user configurations`));
          });
          console.log(chalk.gray(`💡 Configure these servers in the web UI to make them available`));
        }
        
        // Step 2: Check if gateway restart is needed
        const isRunning = this.restartService.isServerRunning();
        
        if (isRunning) {
          console.log(chalk.yellow('\n⚠️  Gateway restart required for changes to take effect.'));
          
          // Prompt user for restart
          const { shouldRestart } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'shouldRestart',
              message: 'Do you want to restart the DeployStack Gateway now?',
              default: true
            }
          ]);

          if (shouldRestart) {
            console.log(chalk.blue('\n🔄 Restarting gateway with updated configuration...'));
            
            try {
              const result = await this.restartService.restartGatewayServer();
              
              if (result.restarted) {
                console.log(chalk.green('✅ Gateway restarted successfully with new configuration'));
                
                if (result.mcpServersStarted !== undefined) {
                  console.log(chalk.blue(`🤖 Ready to serve ${result.mcpServersStarted} MCP server${result.mcpServersStarted === 1 ? '' : 's'}`));
                }
              }
            } catch (error) {
              console.log(chalk.red(`❌ Failed to restart gateway: ${error instanceof Error ? error.message : String(error)}`));
              console.log(chalk.gray('💡 You can restart manually with "deploystack restart"'));
            }
          } else {
            console.log(chalk.gray('💡 Configuration updated. Restart gateway manually with "deploystack restart" when ready.'));
          }
        } else {
          console.log(chalk.gray('💡 Gateway is not currently running. Changes will take effect when you start it.'));
        }
        
        // Show summary
        console.log(chalk.gray(`\n📊 Configuration Summary:`));
        console.log(chalk.gray(`   Hardware ID: ${deviceInfo.hardware_id}`));
        console.log(chalk.gray(`   Ready Servers: ${readyServers.length}`));
        console.log(chalk.gray(`   Invalid Servers: ${invalidServers.length}`));
        console.log(chalk.gray(`   Last Updated: ${new Date(gatewayConfig.lastUpdated).toLocaleString()}`));
        
      } catch (error) {
        spinner.fail('Failed to refresh MCP configuration');
        throw error;
      }

    } catch (error) {
      if (spinner) {
        spinner.fail('MCP refresh operation failed');
      }

      if (error instanceof AuthenticationError) {
        console.log(chalk.red(`❌ Failed to refresh MCP configuration: ${error.message}`));
        
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
  }

  /**
   * Detect changes between old and new MCP configurations
   */
  private detectConfigurationChanges(oldConfig: TeamMCPConfig | null, newConfig: TeamMCPConfig): {
    hasChanges: boolean;
    changes: string[];
    addedServers: string[];
    removedServers: string[];
    modifiedServers: string[];
  } {
    const changes: string[] = [];
    const addedServers: string[] = [];
    const removedServers: string[] = [];
    const modifiedServers: string[] = [];

    // If no old config, everything is new
    if (!oldConfig) {
      return {
        hasChanges: false, // Don't prompt for restart on first-time config
        changes: ['Initial configuration downloaded'],
        addedServers: newConfig.servers.map(s => s.installation_name),
        removedServers: [],
        modifiedServers: []
      };
    }

    // Create maps for easier comparison
    const oldServers = new Map(oldConfig.servers.map(s => [s.installation_name, s]));
    const newServers = new Map(newConfig.servers.map(s => [s.installation_name, s]));

    // Check for added servers
    for (const [name] of newServers) {
      if (!oldServers.has(name)) {
        addedServers.push(name);
        changes.push(`• ${chalk.green(name)}: Added to team configuration`);
      }
    }

    // Check for removed servers
    for (const [name] of oldServers) {
      if (!newServers.has(name)) {
        removedServers.push(name);
        changes.push(`• ${chalk.red(name)}: Removed from team configuration`);
      }
    }

    // Check for modified servers
    for (const [name, newServer] of newServers) {
      const oldServer = oldServers.get(name);
      if (oldServer && this.hasServerConfigChanged(oldServer, newServer)) {
        modifiedServers.push(name);
        const serverChanges = this.getServerChanges(oldServer, newServer);
        changes.push(`• ${chalk.yellow(name)}: ${serverChanges.join(', ')}`);
      }
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      addedServers,
      removedServers,
      modifiedServers
    };
  }

  /**
   * Check if a server configuration has changed
   */
  private hasServerConfigChanged(oldServer: MCPServerConfig, newServer: MCPServerConfig): boolean {
    // Check command and args
    if (oldServer.command !== newServer.command) return true;
    if (JSON.stringify(oldServer.args) !== JSON.stringify(newServer.args)) return true;
    
    // Check environment variables
    if (JSON.stringify(oldServer.env) !== JSON.stringify(newServer.env)) return true;
    
    // Check runtime
    if (oldServer.runtime !== newServer.runtime) return true;
    
    return false;
  }

  /**
   * Get specific changes for a server
   */
  private getServerChanges(oldServer: MCPServerConfig, newServer: MCPServerConfig): string[] {
    const changes: string[] = [];
    
    if (oldServer.command !== newServer.command) {
      changes.push('command updated');
    }
    
    if (JSON.stringify(oldServer.args) !== JSON.stringify(newServer.args)) {
      changes.push('arguments changed');
    }
    
    if (JSON.stringify(oldServer.env) !== JSON.stringify(newServer.env)) {
      changes.push('environment variables updated');
    }
    
    if (oldServer.runtime !== newServer.runtime) {
      changes.push('runtime changed');
    }
    
    return changes;
  }

  /**
   * Handle configuration changes with interactive restart prompt
   */
  private async handleConfigurationChanges(changeInfo: {
    hasChanges: boolean;
    changes: string[];
    addedServers: string[];
    removedServers: string[];
    modifiedServers: string[];
  }): Promise<void> {
    console.log(chalk.blue('\n🔄 Configuration changes detected:'));
    changeInfo.changes.forEach(change => console.log(`   ${change}`));

    console.log(chalk.yellow('\n⚠️  Gateway restart required for changes to take effect.'));

    // Check if gateway is running
    const isRunning = this.restartService.isServerRunning();
    
    if (!isRunning) {
      console.log(chalk.gray('💡 Gateway is not currently running. Changes will take effect when you start it.'));
      return;
    }

    // Prompt user for restart
    const { shouldRestart } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldRestart',
        message: 'Do you want to restart the DeployStack Gateway now?',
        default: true
      }
    ]);

    if (shouldRestart) {
      console.log(chalk.blue('\n🔄 Restarting gateway with updated configuration...'));
      
      try {
        const result = await this.restartService.restartGatewayServer();
        
        if (result.restarted) {
          console.log(chalk.green('✅ Gateway restarted successfully with new configuration'));
          
          if (result.mcpServersStarted !== undefined) {
            console.log(chalk.blue(`🤖 Ready to serve ${result.mcpServersStarted} MCP server${result.mcpServersStarted === 1 ? '' : 's'}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to restart gateway: ${error instanceof Error ? error.message : String(error)}`));
        console.log(chalk.gray('💡 You can restart manually with "deploystack restart"'));
      }
    } else {
      console.log(chalk.gray('💡 Configuration updated. Restart gateway manually with "deploystack restart" when ready.'));
    }
  }
}
