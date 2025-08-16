import { Command } from 'commander';
import chalk from 'chalk';
import { ServerStartService } from '../services/server-start-service';

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start the gateway server')
    .option('-p, --port <port>', 'Port to run the gateway on', '9095')
    .option('-h, --host <host>', 'Host to bind the gateway to', 'localhost')
    .option('-f, --foreground', 'Run in foreground (default is daemon mode)')
    .action(async (options) => {
      const serverService = new ServerStartService();

      try {
        const port = parseInt(options.port, 10);
        const host = options.host;
        const foreground = options.foreground || false;

        console.log(chalk.blue('🚀 Starting DeployStack Gateway...'));

        const result = await serverService.startGatewayServer({
          port,
          host,
          foreground
        });

        if (!result.success) {
          console.log(chalk.yellow('⚠️  Gateway server is already running'));
          console.log(chalk.gray(`   PID: ${result.pid}`));
          console.log(chalk.gray('   Use "deploystack stop" to stop the server first'));
          process.exit(1);
        }

        if (foreground) {
          console.log(chalk.green('✅ Gateway started in foreground mode'));
          console.log(chalk.gray('   Press Ctrl+C to stop the server'));
        } else {
          console.log(chalk.green('✅ Gateway started as daemon'));
          console.log(chalk.gray(`   PID: ${result.pid}`));
          console.log(chalk.gray(`   SSE endpoint: ${result.endpoints?.sse}`));
          console.log(chalk.gray(`   Messages: ${result.endpoints?.messages}`));
          console.log(chalk.gray('   Use "deploystack status" to check status'));
          console.log(chalk.gray('   Use "deploystack stop" to stop the server'));
          
          if (result.mcpServersStarted !== undefined) {
            console.log(chalk.blue(`🤖 Ready to serve ${result.mcpServersStarted} MCP server${result.mcpServersStarted === 1 ? '' : 's'} for team: ${result.teamName}`));
          }
        }

      } catch (error) {
        console.error(chalk.red('❌ Failed to start gateway:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
