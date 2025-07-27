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
    .option('--url <url>', 'DeployStack backend URL (override stored URL)')
    .option('--switch <team-number>', 'Switch to a different team by team number (#)')
    .action(async (options) => {
      const storage = new CredentialStorage();
      let backendUrl = 'https://cloud.deploystack.io'; // Default fallback

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

        // Use stored baseUrl or command line override
        backendUrl = options.url || credentials.baseUrl || 'https://cloud.deploystack.io';
        const api = new DeployStackAPI(credentials, backendUrl);

        // Get fresh teams data from the API (real-time verification)
        const teams = await api.getUserTeams();
        
        // Handle team switching
        if (options.switch) {
          const teamNumber = parseInt(options.switch, 10);
          
          if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > teams.length) {
            console.log(chalk.red(`❌ Invalid team number "${options.switch}". Please use a number between 1 and ${teams.length}`));
            console.log(chalk.gray('Available teams:'));
            teams.forEach((team, index) => console.log(chalk.gray(`  ${index + 1}. ${team.name} (ID: ${team.id})`)));
            process.exit(1);
          }
          
          const teamToSwitch = teams[teamNumber - 1]; // Convert to 0-based index
          
          await storage.updateSelectedTeam(teamToSwitch.id, teamToSwitch.name);
          console.log(chalk.green(`✅ Switched to team: ${chalk.cyan(teamToSwitch.name)} (#${teamNumber})`));
          console.log(chalk.gray(`🌐 Using backend: ${backendUrl}`));
          return;
        }

        if (teams.length === 0) {
          console.log(chalk.yellow('📭 You are not a member of any teams'));
          console.log(chalk.gray('💡 Contact your administrator to be added to a team'));
          console.log(chalk.gray(`🌐 Using backend: ${backendUrl}`));
          return;
        }

        console.log(chalk.blue(`👥 Your Teams (${teams.length} team${teams.length === 1 ? '' : 's'} found)`));
        
        // Show currently selected team
        const selectedTeam = await storage.getSelectedTeam();
        if (selectedTeam) {
          console.log(chalk.gray(`🎯 Currently selected: ${chalk.cyan(selectedTeam.name)}`));
        } else {
          console.log(chalk.yellow('⚠️  No team selected - use --switch <team-number> to select one'));
        }
        
        console.log(chalk.gray(`🌐 Using backend: ${backendUrl}\n`));

        // Create table
        const table = TableFormatter.createTable({
          head: ['#', 'Team Name', 'Role', 'Ownership', 'Default', 'Selected'],
          colWidths: [3, 20, 16, 12, 10, 10]
        });

        teams.forEach((team, index) => {
          // Format role with colors and descriptions
          let roleDisplay: string;
          if (team.role === 'team_admin') {
            roleDisplay = team.is_owner ? chalk.green('Owner/Admin') : chalk.cyan('Admin');
          } else {
            roleDisplay = chalk.gray('User');
          }

          // Format ownership status
          const ownershipDisplay = team.is_owner ? chalk.green('✅ Owner') : chalk.gray('👤 Member');

          // Format default team status
          const defaultDisplay = team.is_default ? chalk.yellow('Default') : chalk.gray('Regular');
          
          // Format selected team status
          const isSelected = selectedTeam && selectedTeam.id === team.id;
          const selectedDisplay = isSelected ? chalk.green('Active') : chalk.gray('Inactive');

          table.push([
            chalk.cyan((index + 1).toString()),
            TableFormatter.truncate(team.name, 18),
            roleDisplay,
            ownershipDisplay,
            defaultDisplay,
            selectedDisplay
          ]);
        });

        console.log(table.toString());

        // Show helpful tips
        console.log();
        console.log(chalk.gray(`💡 Use 'deploystack teams --switch <team-number>' to switch to a different team`));
        
        // Show ownership summary
        const ownedTeams = teams.filter(team => team.is_owner);
        const adminTeams = teams.filter(team => team.role === 'team_admin' && !team.is_owner);
        const userTeams = teams.filter(team => team.role === 'team_user');
        const defaultTeam = teams.find(team => team.is_default);
        
        if (ownedTeams.length > 0) {
          console.log(chalk.gray(`💡 You own ${ownedTeams.length} team${ownedTeams.length === 1 ? '' : 's'}: ${ownedTeams.map(t => chalk.cyan(t.name)).join(', ')}`));
        }
        if (adminTeams.length > 0) {
          console.log(chalk.gray(`💡 You have admin access to ${adminTeams.length} additional team${adminTeams.length === 1 ? '' : 's'}`));
        }
        if (userTeams.length > 0) {
          console.log(chalk.gray(`💡 You have user access to ${userTeams.length} team${userTeams.length === 1 ? '' : 's'}`));
        }
        if (defaultTeam) {
          console.log(chalk.gray(`💡 Your default team is: ${chalk.cyan(defaultTeam.name)}`));
        }
        
        // Show member count if available
        const teamsWithMemberCount = teams.filter(team => team.member_count !== undefined);
        if (teamsWithMemberCount.length > 0) {
          const totalMembers = teamsWithMemberCount.reduce((sum, team) => sum + (team.member_count || 0), 0);
          console.log(chalk.gray(`📊 Total team members across all teams: ${totalMembers}`));
        }

      } catch (error) {
        if (error instanceof AuthenticationError) {
          console.log(chalk.red(`❌ Failed to get teams: ${error.message}`));
          
          if (error.code === 'TOKEN_EXPIRED') {
            console.log(chalk.gray(`💡 Run 'deploystack login' to refresh your authentication`));
          } else if (error.code === 'NETWORK_ERROR') {
            console.log(chalk.gray('💡 Check your internet connection and try again'));
            if (backendUrl !== 'https://cloud.deploystack.io') {
              console.log(chalk.gray(`💡 Make sure your development server is running at ${backendUrl}`));
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
