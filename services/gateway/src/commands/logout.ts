import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { CredentialStorage } from '../core/auth/storage';
import { MCPConfigService } from '../core/mcp';
import { AuthenticationError } from '../types/auth';

export function registerLogoutCommand(program: Command) {
  program
    .command('logout')
    .description('Clear stored authentication credentials')
    .option('--all', 'Clear credentials for all users')
    .action(async (options) => {
      const storage = new CredentialStorage();
      let spinner: ReturnType<typeof ora> | null = null;

      try {
        // Check if user is currently authenticated
        const isAuthenticated = await storage.isAuthenticated();
        const credentials = await storage.getCredentials();

        if (!isAuthenticated && !credentials) {
          console.log(chalk.yellow('⚠️  You are not currently logged in'));
          console.log(chalk.gray(`💡 Use 'deploystack login' to authenticate`));
          return;
        }

        const userEmail = credentials?.userEmail || 'unknown user';

        if (options.all) {
          console.log(chalk.blue('🔐 Clearing all stored credentials...'));
          spinner = ora('Clearing credentials and MCP configurations...').start();
          
          // Clear MCP configurations
          const mcpService = new MCPConfigService();
          await mcpService.clearMCPConfig();
          
          await storage.clearCredentials();
          
          spinner.succeed('All credentials and configurations cleared');
          console.log(chalk.green('✅ Successfully logged out all users'));
        } else {
          console.log(chalk.blue(`🔐 Logging out ${userEmail}...`));
          spinner = ora('Clearing credentials and MCP configurations...').start();
          
          // Clear MCP configurations for selected team
          const mcpService = new MCPConfigService();
          await mcpService.clearMCPConfig();
          
          await storage.clearCredentials(userEmail);
          
          spinner.succeed('Credentials and configurations cleared');
          console.log(chalk.green(`✅ Successfully logged out ${userEmail}`));
        }

        console.log(chalk.gray(`💡 Use 'deploystack login' to authenticate again`));

      } catch (error) {
        if (spinner) {
          spinner.fail('Failed to clear credentials');
        }

        if (error instanceof AuthenticationError) {
          console.log(chalk.red(`❌ Logout failed: ${error.message}`));
          
          if (error.code === 'STORAGE_ERROR') {
            console.log(chalk.yellow('💡 There may be an issue accessing the system keychain'));
            console.log(chalk.yellow('💡 You may need to manually clear credentials from your system keychain'));
          }
        } else {
          console.log(chalk.red(`❌ Unexpected error during logout: ${error instanceof Error ? error.message : String(error)}`));
        }
        
        process.exit(1);
      }
    });
}
