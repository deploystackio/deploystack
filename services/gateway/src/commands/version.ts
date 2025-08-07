import { Command } from 'commander';
import chalk from 'chalk';
import { displayVersionInfo, getGatewayVersion, checkForUpdates } from '../config/version';

export function registerVersionCommand(program: Command) {
  program
    .command('version')
    .description('Display DeployStack Gateway version information and check for updates')
    .option('--no-update-check', 'Skip checking for updates from npm registry')
    .option('--json', 'Output version information in JSON format')
    .option('--debug', 'Show detailed debug information for npm API calls')
    .action(async (options) => {
      try {
        if (options.json) {
          // JSON output for programmatic use
          const versionInfo = getGatewayVersion();
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let output: any = {
            version: versionInfo.version,
            buildTime: versionInfo.buildTime,
            source: versionInfo.source,
            environment: {
              node: process.version,
              platform: process.platform,
              arch: process.arch
            }
          };
          
          if (!options.noUpdateCheck) {
            try {
              const updateCheck = await checkForUpdates(5000, options.debug);
              output.updateCheck = {
                currentVersion: updateCheck.currentVersion,
                latestVersion: updateCheck.latestVersion,
                isUpdateAvailable: updateCheck.isUpdateAvailable,
                updateMessage: updateCheck.updateMessage
              };
            } catch {
              output.updateCheck = {
                error: 'Failed to check for updates'
              };
            }
          }
          
          console.log(JSON.stringify(output, null, 2));
        } else {
          // Human-readable output
          await displayVersionInfo(options.noUpdateCheck, options.debug);
          
          // Add environment info
          console.log();
          console.log(chalk.yellow('Environment:'));
          console.log(chalk.gray(`Node.js: ${process.version}`));
          console.log(chalk.gray(`Platform: ${process.platform} ${process.arch}`));
        }
        
      } catch (error) {
        if (options.json) {
          console.error(JSON.stringify({ error: 'Failed to get version information' }, null, 2));
        } else {
          console.error(chalk.red('Error getting version information:'), error);
        }
        process.exit(1);
      }
    });
}
