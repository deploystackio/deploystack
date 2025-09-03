import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import os from 'os';

// PID file location
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show gateway status and MCP server processes')
    .option('-j, --json', 'Output status as JSON')
    .option('-v, --verbose', 'Show detailed process information')
    .option('--compare', 'Compare running processes with expected configuration')
    .action(async (options) => {
      try {
        const status = await getGatewayStatus();

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }

        // Display status in human-readable format
        await displayStatus(status, options.verbose, options.compare);

      } catch (error) {
        console.error(chalk.red('❌ Failed to get gateway status:'), error);
        process.exit(1);
      }
    });
}

/**
 * Get gateway status
 */
async function getGatewayStatus() {
  const status = {
    gateway: {
      running: false,
      pid: null as number | null,
      uptime: null as number | null,
      endpointSSE: null as string | null,
      endpointMessages: null as string | null,
      endpointMcp: null as string | null
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processes: [] as any[]
  };

  // Check if gateway is running
  if (fs.existsSync(PID_FILE)) {
    const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(pidStr, 10);

    if (!isNaN(pid) && isProcessRunning(pid)) {
      status.gateway.running = true;
      status.gateway.pid = pid;
      
      // Try to get process start time for uptime calculation
      try {
        const stat = fs.statSync(`/proc/${pid}/stat`);
        status.gateway.uptime = Date.now() - stat.birthtimeMs;
      } catch {
        // Fallback: use PID file modification time
        try {
          const pidFileStat = fs.statSync(PID_FILE);
          status.gateway.uptime = Date.now() - pidFileStat.mtimeMs;
        } catch {
          status.gateway.uptime = null;
        }
      }

      // Try to get server status via HTTP
      try {
        const serverStatus = await fetchServerStatus();
        status.server = serverStatus;
        status.processes = serverStatus.processes || [];
        
        // Determine endpoint from server status or default
        const port = 9095; // Default port
        const host = 'localhost'; // Default host
        status.gateway.endpointSSE = `http://${host}:${port}/sse`;
        status.gateway.endpointMessages = `http://${host}:${port}/message`;
        status.gateway.endpointMcp = `http://${host}:${port}/mcp`;
      } catch {
        // Server might be starting up or not responding
        status.gateway.endpointSSE = 'http://localhost:9095/sse (not responding)';
        status.gateway.endpointMessages = 'http://localhost:9095/message (not responding)';
        status.gateway.endpointMcp = 'http://localhost:9095/mcp (not responding)';
      }
    }
  }

  return status;
}

/**
 * Fetch server status via HTTP
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchServerStatus(): Promise<any> {
  const fetch = (await import('node-fetch')).default;
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch('http://localhost:9095/status', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Display status in human-readable format
 */
 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function displayStatus(status: any, verbose: boolean, _compare: boolean = false): Promise<void> {
  console.log(chalk.bold('\nDeployStack Gateway Status\n'));

  // Gateway status
  const gatewayTable = new Table({
    head: [chalk.cyan('Property'), chalk.cyan('Value')],
    colWidths: [20, 50]
  });

  gatewayTable.push(
    ['Status', status.gateway.running ? chalk.green('Running') : chalk.red('Stopped')],
    ['PID', status.gateway.pid || chalk.gray('N/A')],
    ['Uptime', status.gateway.uptime ? formatUptime(status.gateway.uptime) : chalk.gray('N/A')],
    ['SSE Endpoint', status.gateway.endpointSSE || chalk.gray('N/A')],
    ['Messages', status.gateway.endpointMessages || chalk.gray('N/A')],
    ['MCP Endpoint', status.gateway.endpointMcp || chalk.gray('N/A')]
  );

  console.log(gatewayTable.toString());

  // Team configuration
  if (status.server?.teamConfig) {
    console.log(chalk.bold('\nTeam Configuration\n'));
    
    const teamTable = new Table({
      head: [chalk.cyan('Property'), chalk.cyan('Value')],
      colWidths: [20, 50]
    });

    teamTable.push(
      ['Team ID', status.server.teamConfig.teamId],
      ['Team Name', status.server.teamConfig.teamName],
      ['Server Count', status.server.teamConfig.serverCount],
      ['Last Updated', new Date(status.server.teamConfig.lastUpdated).toLocaleString()]
    );

    console.log(teamTable.toString());
  }

  // MCP Processes
  if (status.processes && status.processes.length > 0) {
    console.log(chalk.bold('\nMCP Processes\n'));
    
    const processTable = new Table({
      head: [chalk.cyan('Name'), chalk.cyan('Status'), chalk.cyan('Runtime'), chalk.cyan('Uptime'), chalk.cyan('Messages'), chalk.cyan('Errors')],
      colWidths: [25, 12, 12, 12, 10, 8]
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status.processes.forEach((proc: any) => {
      const statusColor = proc.status === 'running' ? chalk.green : 
                         proc.status === 'failed' ? chalk.red : chalk.yellow;
      
      processTable.push([
        proc.name,
        statusColor(proc.status),
        proc.runtime,
        formatUptime(proc.uptime),
        proc.messageCount.toString(),
        proc.errorCount > 0 ? chalk.red(proc.errorCount.toString()) : proc.errorCount.toString()
      ]);
    });

    console.log(processTable.toString());

    if (verbose) {
      console.log(chalk.bold('\n🔍 Detailed Process Information\n'));
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status.processes.forEach((proc: any) => {
        console.log(chalk.blue(`${proc.name}:`));
        console.log(`  ID: ${proc.id}`);
        console.log(`  Status: ${proc.status}`);
        console.log(`  Runtime: ${proc.runtime}`);
        console.log(`  Uptime: ${formatUptime(proc.uptime)}`);
        console.log(`  Messages: ${proc.messageCount}`);
        console.log(`  Errors: ${proc.errorCount}`);
        console.log(`  Last Activity: ${new Date(proc.lastActivity).toLocaleString()}`);
        console.log('');
      });
    }
  } else if (status.gateway.running) {
    console.log(chalk.yellow('\n⚠️  No MCP processes running'));
    console.log(chalk.gray('   This might indicate no team configuration is loaded'));
  }

  // Summary
  if (status.gateway.running) {
    console.log(chalk.green('\n✅ Gateway is running and ready to serve MCP requests'));
  } else {
    console.log(chalk.red('\n❌ Gateway is not running'));
    console.log(chalk.gray('   Use "deploystack start" to start the gateway'));
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
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

/**
 * Check if process is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 checks if process exists
    return true;
  } catch {
    return false;
  }
}
