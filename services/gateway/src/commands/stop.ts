import { Command } from 'commander';
import chalk from 'chalk';

export function registerStopCommand(program: Command) {
  program
    .command('stop')
    .description('Stop the gateway server')
    .action(async () => {
      console.log(chalk.red('hello world from stop'));
    });
}
