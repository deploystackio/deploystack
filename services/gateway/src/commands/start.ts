import { Command } from 'commander';
import chalk from 'chalk';

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start the gateway server')
    .option('-p, --port <port>', 'Port to run the gateway on', '9095')
    .action(async (options) => {
      console.log(chalk.blue(`hello world from start (port: ${options.port})`));
    });
}
