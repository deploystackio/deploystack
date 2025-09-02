import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { CredentialStorage } from '../core/auth/storage';
import { MCPConfigService } from '../core/mcp';
import { AuthenticationError } from '../types/auth';
import { ServerStopService } from '../services/server-stop-service';

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
          spinner = ora(`Logging out ${userEmail}...`).start();
          
          // Clear MCP configurations for selected team
          const mcpService = new MCPConfigService();
          await mcpService.clearMCPConfig();
          
          spinner.text = 'Clearing credentials and configurations...';
          await storage.clearCredentials(userEmail);
          
          spinner.text = 'Stopping gateway server...';
          
          // Stop the gateway server if it's running
          const stopService = new ServerStopService();
          if (stopService.isServerRunning()) {
            try {
              const stopResult = await stopService.stopGatewayServer({ timeout: 15 });
              if (stopResult.success && stopResult.wasRunning) {
                spinner.stop();
                console.log('Gateway server stopped - you are successfully logged out');
              } else {
                spinner.stop();
                console.log('You are successfully logged out');
              }
            } catch (error) {
              spinner.warn('Failed to stop gateway server gracefully');
              console.log(chalk.yellow(`⚠️  Gateway server may still be running: ${error instanceof Error ? error.message : String(error)}`));
            }
          } else {
            spinner.stop();
            console.log('You are successfully logged out');
          }
        }

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
