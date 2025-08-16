import { Command } from 'commander';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { LogLevel, LogEntry } from '../utils/logger';

interface LogsOptions {
  follow: boolean;
  lines: string;
  level?: LogLevel;
  component?: string;
  json: boolean;
  noColor: boolean;
  port: string;
  host: string;
}

export function registerLogsCommand(program: Command) {
  program
    .command('logs')
    .description('Stream real-time logs from the gateway')
    .option('-f, --follow', 'Follow log output (default: true)', true)
    .option('-n, --lines <number>', 'Number of lines to show initially', '50')
    .option('--level <level>', 'Filter by log level (debug, info, warn, error)')
    .option('--component <component>', 'Filter by component name')
    .option('--json', 'Output raw JSON format', false)
    .option('--no-color', 'Disable colored output', false)
    .option('-p, --port <port>', 'Gateway port', '9095')
    .option('-h, --host <host>', 'Gateway host', 'localhost')
    .action(async (options: LogsOptions) => {
      try {
        await streamLogs(options);
      } catch (error) {
        console.error(chalk.red('❌ Failed to stream logs:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

async function streamLogs(options: LogsOptions): Promise<void> {
  const { host, port, lines, level, component, json, noColor } = options;
  const gatewayUrl = `http://${host}:${port}`;
  
  // Check if gateway is running
  try {
    const healthResponse = await fetch(`${gatewayUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Gateway health check failed: ${healthResponse.status}`);
    }
  } catch {
    console.error(chalk.red('❌ Gateway is not running or not accessible'));
    console.error(chalk.gray('   Make sure the gateway is started with "deploystack start"'));
    console.error(chalk.gray(`   Expected gateway at: ${gatewayUrl}`));
    process.exit(1);
  }

  // Build query parameters
  const params = new URLSearchParams();
  params.set('lines', lines);
  if (level) params.set('level', level);
  if (component) params.set('component', component);

  const streamUrl = `${gatewayUrl}/logs/stream?${params.toString()}`;

  console.log(chalk.blue('📡 Connecting to gateway logs...'));
  console.log(chalk.gray(`   Gateway: ${gatewayUrl}`));
  if (level) console.log(chalk.gray(`   Level filter: ${level}`));
  if (component) console.log(chalk.gray(`   Component filter: ${component}`));
  console.log(chalk.gray(`   Initial lines: ${lines}`));
  console.log('');

  // Create SSE connection using fetch
  try {
    const response = await fetch(streamUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to logs stream: ${response.status}`);
    }

    console.log(chalk.green('✅ Connected to gateway logs\n'));

    // Setup terminal UI with persistent bottom box
    await setupTerminalUI(response, json, noColor);
  } catch (error) {
    console.error(chalk.red('❌ Failed to connect to gateway logs'));
    console.error(chalk.gray('   Make sure the gateway is running and accessible'));
    if (error instanceof Error) {
      console.error(chalk.gray(`   Error: ${error.message}`));
    }
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupTerminalUI(response: any, json: boolean, noColor: boolean): Promise<void> {
  // Setup raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  let shouldStop = false;
  const terminalWidth = process.stdout.columns || 80;
  const boxWidth = Math.min(50, terminalWidth - 4);
  
  // Create the persistent bottom box
  const createBottomBox = () => {
    const topBorder = '┌' + '─'.repeat(boxWidth - 2) + '┐';
    const message = 'Press "x" to exit logs';
    const padding = Math.max(0, boxWidth - 4 - message.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    const middleLine = '│ ' + ' '.repeat(leftPad) + message + ' '.repeat(rightPad) + ' │';
    const bottomBorder = '└' + '─'.repeat(boxWidth - 2) + '┘';
    
    return noColor ? 
      [topBorder, middleLine, bottomBorder] :
      [
        chalk.gray(topBorder),
        chalk.gray('│ ') + chalk.yellow(' '.repeat(leftPad) + message + ' '.repeat(rightPad)) + chalk.gray(' │'),
        chalk.gray(bottomBorder)
      ];
  };

  const showBottomBox = () => {
    const box = createBottomBox();
    console.log('\n' + box.join('\n'));
  };

  const hideBottomBox = () => {
    // Move cursor up 4 lines and clear them
    process.stdout.write('\x1b[4A\x1b[0J');
  };

  // Handle keyboard input
  const handleKeyPress = (key: string) => {
    if (key === 'x' || key === 'X') {
      shouldStop = true;
      hideBottomBox();
      console.log(chalk.yellow('🛑 Stopping log stream...'));
      cleanup();
    } else if (key === '\u0003') { // Ctrl+C
      shouldStop = true;
      hideBottomBox();
      console.log(chalk.yellow('\n🛑 Stopping log stream...'));
      cleanup();
    }
  };

  const cleanup = () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeListener('data', handleKeyPress);
    process.exit(0);
  };

  // Setup keyboard listener
  process.stdin.on('data', handleKeyPress);

  // Handle process signals
  process.on('SIGINT', () => {
    shouldStop = true;
    hideBottomBox();
    console.log(chalk.yellow('\n🛑 Stopping log stream...'));
    cleanup();
  });

  process.on('SIGTERM', cleanup);

  // Show initial bottom box
  showBottomBox();

  // Parse SSE stream using async iteration
  if (response.body) {
    let buffer = '';
    
    // Use async iteration for the response body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of response.body as any) {
      if (shouldStop) break;
      
      buffer += chunk.toString();
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (shouldStop) break;
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (data.trim() === '') continue; // Skip empty data
          
          try {
            const logEntry: LogEntry = JSON.parse(data);
            
            // Hide bottom box, show log entry, then show box again
            hideBottomBox();
            
            if (json) {
              // Raw JSON output
              console.log(JSON.stringify(logEntry));
            } else {
              // Formatted output
              formatLogEntry(logEntry, noColor);
            }
            
            showBottomBox();
            
          } catch {
            // Skip malformed log entries or heartbeat messages
            continue;
          }
        } else if (line.startsWith(': ')) {
          // Skip heartbeat messages silently
          continue;
        }
      }
    }
  }
}

function formatLogEntry(entry: LogEntry, noColor: boolean): void {
  const timestamp = noColor ? entry.timestamp : chalk.gray(entry.timestamp);
  const component = entry.component ? 
    (noColor ? `[${entry.component}]` : chalk.cyan(`[${entry.component}]`)) : '';
  
  let levelColor: (str: string) => string = (str) => str;
  let levelIcon = '';
  
  if (!noColor) {
    switch (entry.level) {
      case 'debug':
        levelColor = chalk.gray;
        levelIcon = '🔍';
        break;
      case 'info':
        levelColor = chalk.blue;
        levelIcon = 'ℹ️';
        break;
      case 'warn':
        levelColor = chalk.yellow;
        levelIcon = '⚠️';
        break;
      case 'error':
        levelColor = chalk.red;
        levelIcon = '❌';
        break;
    }
  }

  const levelText = levelColor(entry.level.toUpperCase().padEnd(5));
  const message = (!noColor && entry.level === 'error') ? chalk.red(entry.message) : entry.message;
  
  console.log(`${timestamp} ${levelIcon} ${levelText} ${component} ${message}`);
  
  if (entry.metadata) {
    const metadataText = noColor ? 
      `   Metadata: ${JSON.stringify(entry.metadata)}` :
      `${chalk.gray('   Metadata:')} ${JSON.stringify(entry.metadata)}`;
    console.log(metadataText);
  }
}
