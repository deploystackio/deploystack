import { Command } from 'commander';
import chalk from 'chalk';

export function registerConfigCommand(program: Command) {
  program
    .command('config')
    .description('Manage local configuration')
    .action(async () => {
      console.log(chalk.magenta('hello world from config'));
    });
}
