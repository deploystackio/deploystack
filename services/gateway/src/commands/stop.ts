import { Command } from 'commander';
import chalk from 'chalk';
import { ServerStopService } from '../services/server-stop-service';

export function registerStopCommand(program: Command) {
  program
    .command('stop')
    .description('Stop the gateway server and all MCP processes')
    .option('-f, --force', 'Force stop the server (SIGKILL)')
    .option('--timeout <seconds>', 'Timeout for graceful shutdown in seconds', '30')
    .action(async (options) => {
      const stopService = new ServerStopService();
      
      try {
        const timeoutSeconds = parseInt(options.timeout, 10) || 30;
        console.log(chalk.blue('🛑 Stopping DeployStack Gateway...'));

        // Get current PID for progress messages
        const pid = stopService.getRunningPid();
        
        if (options.force && pid) {
          console.log(chalk.yellow('⚠️  Force stopping gateway (MCP servers may not shutdown gracefully)'));
          console.log(chalk.gray(`   Sending SIGKILL to process ${pid}...`));
        } else if (pid) {
          console.log(chalk.gray(`   Sending SIGTERM to process ${pid}...`));
          console.log(chalk.gray('   Gateway will stop MCP servers first, then HTTP server...'));
          console.log(chalk.gray(`   Waiting for graceful shutdown (timeout: ${timeoutSeconds}s)...`));
        }

        // Use the service to stop the server
        const result = await stopService.stopGatewayServer({
          force: options.force,
          timeout: timeoutSeconds
        });

        if (result.success) {
          if (result.wasRunning) {
            console.log(chalk.green(`✅ ${result.message}`));
            console.log(chalk.gray('💡 All MCP servers have been stopped along with the gateway'));
          } else {
            console.log(chalk.yellow(`⚠️  ${result.message}`));
          }
        } else {
          console.log(chalk.red(`❌ ${result.message}`));
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('❌ Failed to stop gateway:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}


