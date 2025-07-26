import { Command } from 'commander';
import chalk from 'chalk';

export function registerLogoutCommand(program: Command) {
  program
    .command('logout')
    .description('Clear local credentials')
    .action(async () => {
      console.log(chalk.yellow('hello world from logout'));
    });
}
