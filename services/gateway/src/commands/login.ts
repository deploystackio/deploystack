import { Command } from 'commander';
import chalk from 'chalk';

export function registerLoginCommand(program: Command) {
  program
    .command('login')
    .description('Authenticate with DeployStack cloud')
    .action(async () => {
      console.log(chalk.green('hello world from login'));
    });
}
