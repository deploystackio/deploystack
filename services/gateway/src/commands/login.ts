import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { OAuth2Client } from '../core/auth/oauth';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { MCPConfigService } from '../core/mcp';
import { AuthenticationError } from '../types/auth';
import { ServerStartService } from '../services/server-start-service';
import { detectDeviceInfo } from '../utils/device-detection';

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

        spinner = ora('Registering device...').start();

        // NEW: Automatic device registration
        try {
          const api = new DeployStackAPI(authResult.credentials, options.url);
          const deviceInfo = await detectDeviceInfo();
          const device = await api.registerOrUpdateDevice(deviceInfo);
          
          spinner.text = 'Storing credentials securely...';
          
          // Store credentials with device context
          await storage.storeCredentials({
            ...authResult.credentials,
            deviceId: device.id
          });

          console.log(chalk.green(`📱 Device registered: ${device.device_name}`));
        } catch (deviceError) {
          // If device registration fails, continue without it
          spinner.text = 'Storing credentials securely...';
          await storage.storeCredentials(authResult.credentials);
          
          console.log(chalk.yellow('⚠️  Device registration failed - continuing without device context'));
          if (deviceError instanceof Error) {
            console.log(chalk.gray(`   Device Error: ${deviceError.message}`));
          }
        }

        // Set default team as selected team and download MCP config
        spinner.text = 'Setting up default team...';
        try {
          const api = new DeployStackAPI(authResult.credentials, options.url);
          const teams = await api.getUserTeams();
          const defaultTeam = teams.find(team => team.is_default);
          
          if (defaultTeam) {
            await storage.updateSelectedTeam(defaultTeam.id, defaultTeam.name);
            
            // Download MCP configuration for the default team
            spinner.text = 'Downloading MCP server configurations...';
            const mcpService = new MCPConfigService();
            try {
              await mcpService.downloadAndStoreMCPConfig(defaultTeam.id, defaultTeam.name, api, false);
              
              // Auto-start the gateway server after successful MCP config download
              spinner.text = 'Starting gateway server...';
              const serverStartService = new ServerStartService();
              
              try {
                const startResult = await serverStartService.startGatewayServer({
                  port: 9095,
                  host: 'localhost',
                  foreground: false // Use daemon mode (default)
                });

                if (startResult.success) {
                  spinner.succeed('Authentication complete - Gateway server is now running');
                  console.log(chalk.green(`🚀 Gateway server started successfully`));
                  console.log(chalk.blue(`   • Server URL: http://localhost:9095`));
                  console.log(chalk.blue(`   • SSE Endpoint: http://localhost:9095/sse`));
                  console.log(chalk.blue(`   • PID: ${startResult.pid}`));
                  if (startResult.mcpServersStarted && startResult.mcpServersStarted > 0) {
                    console.log(chalk.blue(`   • MCP Servers: ${startResult.mcpServersStarted} running`));
                  }
                } else {
                  spinner.succeed('Credentials stored, default team selected, and MCP config downloaded');
                  console.log(chalk.yellow('⚠️  Gateway server is already running - you can check status with "deploystack status"'));
                  if (startResult.pid) {
                    console.log(chalk.gray(`   Running PID: ${startResult.pid}`));
                  }
                }
              } catch (serverError) {
                spinner.succeed('Credentials stored, default team selected, and MCP config downloaded');
                console.log(chalk.yellow('⚠️  Could not auto-start gateway server - you can start it manually with "deploystack start"'));
                if (serverError instanceof Error) {
                  console.log(chalk.gray(`   Server Error: ${serverError.message}`));
                }
              }
            } catch (mcpError) {
              spinner.succeed('Credentials stored and default team selected');
              console.log(chalk.yellow('⚠️  Could not download MCP configurations - you can try again later'));
              if (mcpError instanceof Error) {
                console.log(chalk.gray(`   MCP Error: ${mcpError.message}`));
              }
            }
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
        console.log(chalk.gray(`   deploystack mcp        - Manage MCP server configurations`));
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
