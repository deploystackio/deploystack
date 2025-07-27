import { Command } from 'commander';
import chalk from 'chalk';
import { CredentialStorage } from '../core/auth/storage';
import { DeployStackAPI } from '../core/auth/api-client';
import { TableFormatter } from '../utils/table';
import { AuthenticationError } from '../types/auth';

export function registerTeamsCommand(program: Command) {
  program
    .command('teams')
    .description('List your teams and team information')
    .option('--url <url>', 'DeployStack backend URL (for development)', 'https://cloud.deploystack.io')
    .action(async (options) => {
      const storage = new CredentialStorage();

      try {
        // Check authentication
        if (!await storage.isAuthenticated()) {
          console.log(chalk.red('❌ Not authenticated'));
          console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
          process.exit(1);
        }

        const credentials = await storage.getCredentials();
        if (!credentials) {
          console.log(chalk.red('❌ No stored credentials found'));
          console.log(chalk.gray(`💡 Run 'deploystack login' to authenticate`));
          process.exit(1);
        }

        const api = new DeployStackAPI(credentials, options.url);

        // Get teams
        const teams = await api.getUserTeams();

        if (teams.length === 0) {
          console.log(chalk.yellow('📭 You are not a member of any teams'));
          console.log(chalk.gray('💡 Contact your administrator to be added to a team'));
          return;
        }

        console.log(chalk.blue(`👥 Your Teams (${teams.length} team${teams.length === 1 ? '' : 's'} found)\n`));

        // Create table
        const table = TableFormatter.createTable({
          head: ['Team Name', 'Role', 'Members', 'Default', 'Created'],
          colWidths: [25, 15, 8, 7, 12]
        });

        teams.forEach(team => {
          table.push([
            TableFormatter.truncate(team.name, 23),
            team.role === 'team_admin' ? chalk.cyan('admin') : chalk.gray('user'),
            team.member_count.toString(),
            TableFormatter.formatBoolean(team.is_default),
            TableFormatter.formatDate(team.created_at)
          ]);
        });

        console.log(table.toString());

        // Show helpful tips
        console.log();
        console.log(chalk.gray(`💡 Use 'deploystack start --team <team-name>' to start gateway for specific team`));
        
        // Show default team info
        const defaultTeam = teams.find(team => team.is_default);
        if (defaultTeam) {
          console.log(chalk.gray(`💡 Your default team is: ${chalk.cyan(defaultTeam.name)}`));
        }

        // Show admin teams
        const adminTeams = teams.filter(team => team.role === 'team_admin');
        if (adminTeams.length > 0) {
          console.log(chalk.gray(`💡 You have admin access to ${adminTeams.length} team${adminTeams.length === 1 ? '' : 's'}`));
        }

      } catch (error) {
        if (error instanceof AuthenticationError) {
          console.log(chalk.red(`❌ Failed to get teams: ${error.message}`));
          
          if (error.code === 'TOKEN_EXPIRED') {
            console.log(chalk.gray(`💡 Run 'deploystack login' to refresh your authentication`));
          } else if (error.code === 'NETWORK_ERROR') {
            console.log(chalk.gray('💡 Check your internet connection and try again'));
            if (options.url !== 'https://cloud.deploystack.io') {
              console.log(chalk.gray(`💡 Make sure your development server is running at ${options.url}`));
            }
          } else if (error.code === 'INVALID_TOKEN') {
            console.log(chalk.gray('💡 Your token may not have permission to view teams'));
            console.log(chalk.gray(`💡 Run 'deploystack login' to refresh your authentication`));
          }
        } else {
          console.log(chalk.red(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
        }
        
        process.exit(1);
      }
    });
}
