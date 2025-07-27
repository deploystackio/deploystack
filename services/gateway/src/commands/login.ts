import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { OAuth2Client } from '../core/auth/oauth';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { AuthenticationError } from '../types/auth';

export function registerLoginCommand(program: Command) {
  program
    .command('login')
    .description('Authenticate with DeployStack cloud')
    .option('--no-browser', 'Skip automatic browser opening')
    .option('--url <url>', 'DeployStack backend URL (for development)', 'https://cloud.deploystack.io')
    .action(async (options) => {
      const storage = new CredentialStorage();
      const oauth = new OAuth2Client({
        baseUrl: options.url
      });

      let spinner: ReturnType<typeof ora> | null = null;

      try {
        // Check if already authenticated
        if (await storage.isAuthenticated()) {
          const credentials = await storage.getCredentials();
          console.log(chalk.green(`✅ You are already logged in as ${credentials?.userEmail}`));
          console.log(chalk.gray(`💡 Use 'deploystack whoami' to see details`));
          return;
        }

        console.log(chalk.blue('🔐 Starting authentication flow...'));
        
        if (options.url !== 'https://cloud.deploystack.io') {
          console.log(chalk.yellow(`🔧 Using development server: ${options.url}`));
        }

        // Start OAuth flow
        const authResult = await oauth.authenticate({
          openBrowser: options.browser !== false,
          timeout: 120000 // 2 minutes
        });

        spinner = ora('Storing credentials securely...').start();

        // Store credentials
        await storage.storeCredentials(authResult.credentials);

        // Set default team as selected team
        spinner.text = 'Setting up default team...';
        try {
          const api = new DeployStackAPI(authResult.credentials, options.url);
          const teams = await api.getUserTeams();
          const defaultTeam = teams.find(team => team.is_default);
          
          if (defaultTeam) {
            await storage.updateSelectedTeam(defaultTeam.id, defaultTeam.name);
            spinner.succeed('Credentials stored and default team selected');
          } else {
            spinner.succeed('Credentials stored securely');
            console.log(chalk.yellow('⚠️  No default team found - you may need to select a team manually'));
          }
        } catch {
          spinner.succeed('Credentials stored securely');
          console.log(chalk.yellow('⚠️  Could not auto-select default team - you can select one later'));
        }
        spinner = null;

        console.log(chalk.green(`✅ Successfully authenticated as ${authResult.credentials.userEmail}`));
        console.log(chalk.green(`🎉 You can now use the DeployStack Gateway CLI`));
        
        // Show available commands
        console.log(chalk.blue(`\n💡 Available commands:`));
        console.log(chalk.gray(`   deploystack whoami     - Show your user information`));
        console.log(chalk.gray(`   deploystack teams      - List your teams`));
        console.log(chalk.gray(`   deploystack start      - Start the gateway server`));
        
        if (options.url !== 'https://cloud.deploystack.io') {
          console.log(chalk.yellow(`   ⚠️  For MCP changes, visit: ${options.url}`));
        }

        // Exit successfully
        process.exit(0);

      } catch (error) {
        if (spinner) {
          spinner.fail('Authentication failed');
        }

        if (error instanceof AuthenticationError) {
          console.log(chalk.red(`❌ Authentication failed: ${error.message}`));
          
          // Provide helpful suggestions based on error type
          switch (error.code) {
            case 'TIMEOUT':
              console.log(chalk.yellow('💡 Try running the command again, or use --no-browser to open the URL manually'));
              break;
            case 'ACCESS_DENIED':
              console.log(chalk.yellow('💡 Make sure you approve the authorization request in your browser'));
              break;
            case 'BROWSER_ERROR':
              console.log(chalk.yellow('💡 Try using --no-browser to open the URL manually'));
              break;
            case 'NETWORK_ERROR':
              console.log(chalk.yellow('💡 Check your internet connection and try again'));
              if (options.url !== 'https://cloud.deploystack.io') {
                console.log(chalk.yellow(`💡 Make sure your development server is running at ${options.url}`));
              }
              break;
            case 'STORAGE_ERROR':
              console.log(chalk.yellow('💡 Check that you have permission to access the system keychain'));
              break;
          }
        } else {
          console.log(chalk.red(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
        }
        
        process.exit(1);
      }
    });
}
