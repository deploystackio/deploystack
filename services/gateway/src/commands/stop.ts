import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

// PID file location
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export function registerStopCommand(program: Command) {
  program
    .command('stop')
    .description('Stop the gateway server and all MCP processes')
    .option('-f, --force', 'Force stop the server (SIGKILL)')
    .option('--timeout <seconds>', 'Timeout for graceful shutdown in seconds', '30')
    .action(async (options) => {
      try {
        const timeoutSeconds = parseInt(options.timeout, 10) || 30;
        console.log(chalk.blue('🛑 Stopping DeployStack Gateway...'));

        // Check if PID file exists
        if (!fs.existsSync(PID_FILE)) {
          console.log(chalk.yellow('⚠️  Gateway server is not running (no PID file found)'));
          return;
        }

        // Read PID from file
        const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
        const pid = parseInt(pidStr, 10);

        if (isNaN(pid)) {
          console.log(chalk.red('❌ Invalid PID in PID file'));
          removePidFile();
          return;
        }

        // Check if process is running
        if (!isProcessRunning(pid)) {
          console.log(chalk.yellow('⚠️  Gateway server is not running (process not found)'));
          removePidFile();
          return;
        }

        // NEW: The gateway now handles MCP server shutdown internally
        // When we send SIGTERM to the gateway, it will:
        // 1. Stop all MCP servers gracefully (following MCP spec)
        // 2. Stop the HTTP server
        // 3. Clean up and exit

        if (options.force) {
          // Force stop - send SIGKILL immediately
          console.log(chalk.yellow('⚠️  Force stopping gateway (MCP servers may not shutdown gracefully)'));
          console.log(chalk.gray(`   Sending SIGKILL to process ${pid}...`));
          
          try {
            process.kill(pid, 'SIGKILL');
            console.log(chalk.green('✅ Gateway server force stopped'));
            removePidFile();
          } catch {
            console.log(chalk.yellow('⚠️  Process was already stopped'));
            removePidFile();
          }
        } else {
          // Graceful stop - send SIGTERM and wait
          console.log(chalk.gray(`   Sending SIGTERM to process ${pid}...`));
          console.log(chalk.gray('   Gateway will stop MCP servers first, then HTTP server...'));

          try {
            process.kill(pid, 'SIGTERM');
            
            // Wait for graceful shutdown with longer timeout for MCP server cleanup
            console.log(chalk.gray(`   Waiting for graceful shutdown (timeout: ${timeoutSeconds}s)...`));
            
            let attempts = 0;
            const maxAttempts = timeoutSeconds * 2; // Check every 500ms
            
            while (attempts < maxAttempts && isProcessRunning(pid)) {
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts++;
              
              // Show progress every 5 seconds
              if (attempts % 10 === 0) {
                const elapsed = Math.floor(attempts / 2);
                console.log(chalk.gray(`   Still shutting down... (${elapsed}s elapsed)`));
              }
            }

            if (isProcessRunning(pid)) {
              console.log(chalk.yellow(`⚠️  Process did not stop within ${timeoutSeconds}s, forcing shutdown...`));
              process.kill(pid, 'SIGKILL');
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              if (isProcessRunning(pid)) {
                console.log(chalk.red('❌ Failed to stop process even with SIGKILL'));
                console.log(chalk.gray(`   Process ${pid} may be stuck - manual intervention required`));
                process.exit(1);
              } else {
                console.log(chalk.yellow('⚠️  Gateway force stopped after timeout'));
              }
            } else {
              console.log(chalk.green('✅ Gateway server stopped gracefully'));
            }

            removePidFile();
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
              console.log(chalk.yellow('⚠️  Process was already stopped'));
              removePidFile();
            } else {
              throw error;
            }
          }
        }

        console.log(chalk.gray('💡 All MCP servers have been stopped along with the gateway'));

      } catch (error) {
        console.error(chalk.red('❌ Failed to stop gateway:'), error);
        process.exit(1);
      }
    });
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

/**
 * Remove PID file
 */
function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    console.warn(chalk.yellow('⚠️  Could not remove PID file:'));
  }
}
