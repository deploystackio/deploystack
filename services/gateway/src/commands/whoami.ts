import { Command } from 'commander';
import chalk from 'chalk';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { TableFormatter } from '../utils/table';
import { SCOPE_DESCRIPTIONS } from '../utils/auth-config';
import { AuthenticationError } from '../types/auth';

export function registerWhoamiCommand(program: Command) {
  program
    .command('whoami')
    .description('Display current user information')
    .option('--url <url>', 'DeployStack backend URL (override stored URL)')
    .action(async (options) => {
      const storage = new CredentialStorage();
      let backendUrl = 'https://cloud.deploystack.io'; // Default fallback

      try {
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

        // Use stored baseUrl or command line override
        backendUrl = options.url || credentials.baseUrl || 'https://cloud.deploystack.io';
        
        const api = new DeployStackAPI(credentials, backendUrl);

        // Get fresh user info from the API (real-time verification)
        const userInfo = await api.getUserInfo();
        const tokenInfo = await api.getTokenInfo();
        const accounts = api.getUserAccounts();

        // Display user information
        const userEmail = userInfo.email;
        console.log(chalk.blue(`👋 You are logged in with an OAuth Token, associated with ${userEmail}`));
        console.log(chalk.gray(`🆔 User ID (sub): ${userInfo.sub}`));
        if (userInfo.name) {
          console.log(chalk.gray(`👤 Full Name: ${userInfo.name}`));
        }
        if (userInfo.preferred_username) {
          console.log(chalk.gray(`🏷️  Username: ${userInfo.preferred_username}`));
        }
        console.log(chalk.gray(`✅ Email Verified: ${userInfo.email_verified ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`🌐 Using backend: ${backendUrl}\n`));

        // Display account info in table format if accounts exist
        if (accounts.length > 0) {
          const accountTable = TableFormatter.createTable({
            head: ['Account Name', 'Account ID'],
            colWidths: [30, 36]
          });

          accounts.forEach(account => {
            accountTable.push([
              TableFormatter.truncate(account.name, 28),
              account.id
            ]);
          });

          console.log(accountTable.toString());
          console.log();
        }

        // Display token permissions
        console.log(chalk.blue('🔓 Token Permissions:'));
        
        const scopeTable = TableFormatter.createTable({
          head: ['Scope', 'Description'],
          colWidths: [20, 50]
        });

        tokenInfo.scopes.forEach(scope => {
          const [resource, permission] = scope.split(':');
          const description = SCOPE_DESCRIPTIONS[scope] || 'Access to ' + scope;
          
          scopeTable.push([
            chalk.cyan(`${resource} (${permission || 'read'})`),
            TableFormatter.truncate(description, 48)
          ]);
        });

        console.log(scopeTable.toString());

        // Display token expiration
        const expiresAt = new Date(credentials.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
        
        console.log();
        if (timeUntilExpiry > 0) {
          if (hoursUntilExpiry > 24) {
            const daysUntilExpiry = Math.floor(hoursUntilExpiry / 24);
            console.log(chalk.green(`Token expires: ${expiresAt.toLocaleString()} (in ${daysUntilExpiry} days)`));
          } else if (hoursUntilExpiry > 1) {
            console.log(chalk.yellow(`Token expires: ${expiresAt.toLocaleString()} (in ${hoursUntilExpiry} hours)`));
          } else {
            const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60));
            console.log(chalk.red(`Token expires: ${expiresAt.toLocaleString()} (in ${minutesUntilExpiry} minutes)`));
          }
        } else {
          console.log(chalk.red(`Token expired: ${expiresAt.toLocaleString()}`));
          console.log(chalk.gray(`💡 Run 'deploystack login' to refresh your authentication`));
        }

      } catch (error) {
        if (error instanceof AuthenticationError) {
          console.log(chalk.red(`❌ Failed to get user information: ${error.message}`));
          
          if (error.code === 'TOKEN_EXPIRED') {
            console.log(chalk.gray(`💡 Run 'deploystack login' to refresh your authentication`));
          } else if (error.code === 'NETWORK_ERROR') {
            console.log(chalk.gray('💡 Check your internet connection and try again'));
            if (backendUrl !== 'https://cloud.deploystack.io') {
              console.log(chalk.gray(`💡 Make sure your development server is running at ${backendUrl}`));
            }
          }
        } else {
          console.log(chalk.red(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
        }
        
        process.exit(1);
      }
    });
}
