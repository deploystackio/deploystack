import { Command } from 'commander';
import chalk from 'chalk';
import { getGatewayVersion } from '../config/version';

export function registerVersionCommand(program: Command) {
  program
    .command('version')
    .description('Display DeployStack Gateway version information')
    .action(async () => {
      try {
        const versionInfo = getGatewayVersion();
        
        console.log(chalk.cyan('DeployStack Gateway'));
        console.log(chalk.green(`Version: ${versionInfo.version}`));
        console.log(chalk.gray(`Build Time: ${versionInfo.buildTime}`));
        console.log(chalk.gray(`Source: ${versionInfo.source}`));
        
        // Add some additional info
        console.log();
        console.log(chalk.yellow('Environment:'));
        console.log(chalk.gray(`Node.js: ${process.version}`));
        console.log(chalk.gray(`Platform: ${process.platform} ${process.arch}`));
        
      } catch (error) {
        console.error(chalk.red('Error getting version information:'), error);
        process.exit(1);
      }
    });
}
