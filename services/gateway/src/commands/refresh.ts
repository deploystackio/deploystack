import { Command } from 'commander';
import { RefreshService } from '../services/refresh-service';

export function registerRefreshCommand(program: Command) {
  program
    .command('refresh')
    .description('Refresh MCP server configurations from cloud')
    .option('--url <url>', 'DeployStack backend URL (override stored URL)')
    .action(async (options) => {
      const refreshService = new RefreshService();
      await refreshService.refreshMCPConfiguration({ url: options.url });
    });
}
