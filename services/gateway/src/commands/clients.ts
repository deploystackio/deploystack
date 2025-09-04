import { Command } from 'commander';
import chalk from 'chalk';
import { ClientStateCacheService } from '../core/client/client-state-cache';

export function registerClientsCommand(program: Command) {
  program
    .command('clients')
    .description('Show all connected MCP clients')
    .action(async () => {
      await showConnectedClients();
    });
}

async function showConnectedClients(): Promise<void> {
  try {
    const clientCache = new ClientStateCacheService();
    
    // Get active clients from cache
    const activeClients = await clientCache.getActiveClients();
    const cacheSummary = await clientCache.getCacheSummary();

    console.log(chalk.blue('Connected MCP Clients'));
    console.log(chalk.gray('═'.repeat(50)));

    // Show summary
    if (activeClients.length === 0) {
      console.log(chalk.yellow('No clients currently connected'));
      console.log(chalk.gray('Clients will appear here when they connect to the gateway'));
      console.log(chalk.gray('   • SSE endpoint: http://localhost:9095/sse'));
      console.log(chalk.gray('   • MCP endpoint: http://localhost:9095/mcp'));
      
      if (cacheSummary.exists && cacheSummary.disconnectedClients > 0) {
        console.log(chalk.gray(`   • ${cacheSummary.disconnectedClients} recent disconnected client${cacheSummary.disconnectedClients === 1 ? '' : 's'} in cache`));
      }
      return;
    }

    console.log(chalk.green(`Summary: ${activeClients.length} active connections`));
    console.log(chalk.gray(`   • SSE connections: ${cacheSummary.sseClients}`));
    console.log(chalk.gray(`   • Streamable HTTP connections: ${cacheSummary.streamableHttpClients}`));
    console.log(chalk.gray(`   • Initialized clients: ${activeClients.filter(c => c.mcpInitialized).length}`));
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentlyActive = activeClients.filter(c => c.lastActivity > fiveMinutesAgo).length;
    console.log(chalk.gray(`   • Active (last 5min): ${recentlyActive}`));
    console.log('');

    // Show detailed client list
    console.log(chalk.blue('Client Details:'));
    console.log('');

    // Sort by creation time (newest first)
    const sortedClients = activeClients.sort((a, b) => b.createdAt - a.createdAt);

    for (const client of sortedClients) {
      const clientName = getClientDisplayName(client.clientInfo);
      const uptime = formatUptime(Date.now() - client.createdAt);
      const lastActivityAgo = formatUptime(Date.now() - client.lastActivity);
      
      console.log(chalk.white(`${clientName}`));
      console.log(chalk.gray(`   ID: ${client.id}`));
      console.log(chalk.gray(`   Type: ${client.type} ${client.mcpInitialized ? 'Initialized' : 'Connecting'}`));
      console.log(chalk.gray(`   Activity: ${lastActivityAgo} ago (${client.requestCount} requests)`));
      console.log(chalk.gray(`   Uptime: ${uptime}`));
      
      if (client.userAgent) {
        console.log(chalk.gray(`   User Agent: ${client.userAgent}`));
      }
      
      if (client.errorCount > 0) {
        console.log(chalk.red(`   Errors: ${client.errorCount}`));
      }
      
      console.log('');
    }

    // Show connection endpoints
    console.log(chalk.blue('Connection Endpoints:'));
    console.log(chalk.gray(`   • SSE: http://localhost:9095/sse`));
    console.log(chalk.gray(`   • Messages: http://localhost:9095/message`));
    console.log(chalk.gray(`   • MCP: http://localhost:9095/mcp`));
    console.log(chalk.gray(`   • Health: http://localhost:9095/health`));

    if (cacheSummary.lastUpdated) {
      const lastUpdated = new Date(cacheSummary.lastUpdated);
      console.log(chalk.gray(`\nCache last updated: ${lastUpdated.toLocaleString()}`));
    }

  } catch (error) {
    console.error(chalk.red('Failed to retrieve client information:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    console.log(chalk.gray('Make sure the gateway has been started at least once to create the client cache'));
    process.exit(1);
  }
}

/**
 * Get client display name from client info
 */
function getClientDisplayName(clientInfo?: { name: string; version: string }): string {
  if (!clientInfo) {
    return 'Unknown Client';
  }
  
  return `${clientInfo.name} v${clientInfo.version}`;
}

/**
 * Format uptime duration in human readable format
 */
function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
