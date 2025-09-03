import chalk from 'chalk';
import ora from 'ora';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { MCPConfigService } from '../core/mcp';
import { ConfigurationChangeService } from './configuration-change-service';
import { ClientNotificationService } from './client-notification-service';
import { AuthenticationError } from '../types/auth';
import { detectDeviceInfo } from '../utils/device-detection';

export interface RefreshOptions {
  url?: string;
}

export class RefreshService {
  private storage: CredentialStorage;
  private mcpService: MCPConfigService;
  private changeService: ConfigurationChangeService;

  constructor() {
    this.storage = new CredentialStorage();
    this.mcpService = new MCPConfigService();
    this.changeService = new ConfigurationChangeService();
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
        
        // Get existing configuration for change detection
        const oldConfig = await this.mcpService.getMCPConfig(credentials.selectedTeam.id);
        
        // Download merged configurations using the new gateway endpoint
        // Backend will automatically find device by hardware_id
        const gatewayConfig = await this.mcpService.downloadGatewayMCPConfig(deviceInfo.hardware_id, api, false);
        
        // Convert and store the gateway config in the format expected by local storage
        const teamMCPConfig = this.mcpService.convertGatewayConfigToTeamConfig(
          credentials.selectedTeam.id,
          credentials.selectedTeam.name,
          gatewayConfig
        );
        
        // Detect configuration changes
        const changeInfo = this.changeService.detectConfigurationChanges(oldConfig, teamMCPConfig);
        
        // Store the converted configuration
        await this.mcpService.storeMCPConfig(teamMCPConfig);
        
        const readyServers = gatewayConfig.servers.filter(s => s.status === 'ready');
        const invalidServers = gatewayConfig.servers.filter(s => s.status === 'invalid');
        
        spinner.succeed(`Gateway MCP configurations refreshed (${readyServers.length} ready, ${invalidServers.length} invalid)`);
        
        if (invalidServers.length > 0) {
          console.log(chalk.yellow(`\n⚠️  ${invalidServers.length} server${invalidServers.length === 1 ? '' : 's'} marked as invalid:`));
          invalidServers.forEach(server => {
            console.log(chalk.gray(`   • ${server.name} - Missing required user configurations`));
          });
          console.log(chalk.gray(`💡 Configure these servers in the web UI to make them available`));
        }
        
        // Step 2: Handle configuration changes
        if (changeInfo.hasChanges) {
          await this.changeService.handleConfigurationChanges(changeInfo, teamMCPConfig.servers);
          
          // Step 3: Notify connected clients about tool changes
          await this.notifyConnectedClients();
        } else {
          console.log(chalk.green('✅ No configuration changes detected - your MCP servers are up to date'));
          console.log(chalk.gray('💡 All servers are already running with the latest configuration'));
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
   * Notify connected clients about tool changes using HTTP requests to the running gateway
   */
  private async notifyConnectedClients(): Promise<void> {
    try {
      console.log(chalk.blue('Notifying connected MCP clients about tool changes...'));
      
      // Try to notify the running gateway about tool changes
      // The gateway will handle notifying all connected clients
      const gatewayUrl = 'http://localhost:9095';
      
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${gatewayUrl}/api/tools/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'configuration_refresh' })
        });
        
        if (response.ok) {
          const result = await response.json() as {
            totalNotified?: number;
            sseNotified?: number;
            streamableHttpNotified?: number;
          };
          console.log(chalk.green(`✅ Notified ${result.totalNotified || 0} connected clients`));
          if (result.sseNotified && result.sseNotified > 0) {
            console.log(chalk.gray(`   • SSE clients: ${result.sseNotified}`));
          }
          if (result.streamableHttpNotified && result.streamableHttpNotified > 0) {
            console.log(chalk.gray(`   • Streamable HTTP clients: ${result.streamableHttpNotified}`));
          }
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        // Gateway might not be running, which is fine
        console.log(chalk.gray('💡 Gateway not running - clients will receive updated tools when they connect'));
      }
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Failed to notify some clients: ${error instanceof Error ? error.message : String(error)}`));
      console.log(chalk.gray('💡 Clients will still receive updated tools on their next request'));
    }
  }

}
