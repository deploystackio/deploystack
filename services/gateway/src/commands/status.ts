import { Command } from 'commander';
import chalk from 'chalk';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show gateway status')
    .action(async () => {
      console.log(chalk.cyan('hello world from status'));
    });
}
