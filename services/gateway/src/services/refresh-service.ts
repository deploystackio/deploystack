import chalk from 'chalk';
import ora from 'ora';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { MCPConfigService } from '../core/mcp';
import { AuthenticationError } from '../types/auth';

export interface RefreshOptions {
  url?: string;
}

export class RefreshService {
  private storage: CredentialStorage;
  private mcpService: MCPConfigService;

  constructor() {
    this.storage = new CredentialStorage();
    this.mcpService = new MCPConfigService();
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

      console.log(chalk.blue(`🔄 Refreshing MCP configuration for team: ${chalk.cyan(credentials.selectedTeam.name)}`));
      spinner = ora('Downloading latest MCP configuration...').start();
      
      try {
        const config = await this.mcpService.downloadAndStoreMCPConfig(
          credentials.selectedTeam.id,
          credentials.selectedTeam.name,
          api,
          false
        );
        
        spinner.succeed(`MCP configuration refreshed (${config.servers.length} server${config.servers.length === 1 ? '' : 's'})`);
        console.log(chalk.green('✅ MCP configuration has been refreshed'));
        
        // Show summary
        console.log(chalk.gray(`\n📊 Configuration Summary:`));
        console.log(chalk.gray(`   Team: ${config.team_name}`));
        console.log(chalk.gray(`   Installations: ${config.installations.length}`));
        console.log(chalk.gray(`   Servers: ${config.servers.length}`));
        console.log(chalk.gray(`   Last Updated: ${new Date(config.last_updated).toLocaleString()}`));
        
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
}
