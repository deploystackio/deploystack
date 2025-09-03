import { Command } from 'commander';
import chalk from 'chalk';
import { ServerRestartService } from '../services/server-restart-service';

export function registerRestartCommand(program: Command) {
  program
    .command('restart')
    .description('Restart the gateway server')
    .option('-p, --port <port>', 'Port to run the gateway on', '9095')
    .option('-h, --host <host>', 'Host to bind the gateway to', 'localhost')
    .option('-f, --foreground', 'Run in foreground (default is daemon mode)')
    .action(async (options) => {
      const restartService = new ServerRestartService();

      try {
        const port = parseInt(options.port, 10);
        const host = options.host;
        const foreground = options.foreground || false;

        const result = await restartService.restartGatewayServer({
          port,
          host,
          foreground
        });

        if (result.restarted) {
          console.log(chalk.green('✅ Gateway restarted successfully'));
        } else {
          console.log(chalk.green('✅ Gateway started successfully'));
        }

        if (foreground) {
          console.log(chalk.gray('   Press Ctrl+C to stop the server'));
        } else {
          console.log(chalk.gray(`   PID: ${result.pid}`));
          console.log(chalk.gray(`   SSE endpoint: ${result.endpoints?.sse}`));
          console.log(chalk.gray(`   Messages: ${result.endpoints?.messages}`));
          console.log(chalk.gray(`   MCP endpoint: ${result.endpoints?.mcp}`));
          console.log(chalk.gray('   Use "deploystack status" to check status'));
          console.log(chalk.gray('   Use "deploystack stop" to stop the server'));
          
          if (result.mcpServersStarted !== undefined) {
            console.log(chalk.blue(`🤖 Ready to serve ${result.mcpServersStarted} MCP server${result.mcpServersStarted === 1 ? '' : 's'} for team: ${result.teamName}`));
          }
        }

      } catch (error) {
        console.error(chalk.red('❌ Failed to restart gateway:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
