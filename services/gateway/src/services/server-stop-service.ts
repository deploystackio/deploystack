import fs from 'fs';
import path from 'path';
import os from 'os';

// PID file location
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export interface ServerStopOptions {
  force?: boolean;
  timeout?: number;
}

export interface ServerStopResult {
  success: boolean;
  message: string;
  wasRunning: boolean;
}

export class ServerStopService {
  /**
   * Stop the DeployStack Gateway server gracefully or forcefully
   */
  async stopGatewayServer(options: ServerStopOptions = {}): Promise<ServerStopResult> {
    const timeoutSeconds = options.timeout || 30;
    const force = options.force || false;

    try {
      // Check if PID file exists
      if (!fs.existsSync(PID_FILE)) {
        return {
          success: true,
          message: 'Gateway server is not running (no PID file found)',
          wasRunning: false
        };
      }

      // Read PID from file
      const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
      const pid = parseInt(pidStr, 10);

      if (isNaN(pid)) {
        this.removePidFile();
        return {
          success: true,
          message: 'Invalid PID in PID file - cleaned up',
          wasRunning: false
        };
      }

      // Check if process is running
      if (!this.isProcessRunning(pid)) {
        this.removePidFile();
        return {
          success: true,
          message: 'Gateway server is not running (process not found) - cleaned up PID file',
          wasRunning: false
        };
      }

      // The gateway handles MCP server shutdown internally
      // When we send SIGTERM to the gateway, it will:
      // 1. Stop all MCP servers gracefully (following MCP spec)
      // 2. Stop the HTTP server
      // 3. Clean up and exit

      if (force) {
        // Force stop - send SIGKILL immediately
        try {
          process.kill(pid, 'SIGKILL');
          this.removePidFile();
          return {
            success: true,
            message: 'Gateway server force stopped (MCP servers may not have shutdown gracefully)',
            wasRunning: true
          };
        } catch {
          this.removePidFile();
          return {
            success: true,
            message: 'Process was already stopped - cleaned up PID file',
            wasRunning: false
          };
        }
      } else {
        // Graceful stop - send SIGTERM and wait
        try {
          process.kill(pid, 'SIGTERM');
          
          // Wait for graceful shutdown with timeout for MCP server cleanup
          let attempts = 0;
          const maxAttempts = timeoutSeconds * 2; // Check every 500ms
          
          while (attempts < maxAttempts && this.isProcessRunning(pid)) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }

          if (this.isProcessRunning(pid)) {
            // Process didn't stop gracefully, force kill
            process.kill(pid, 'SIGKILL');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (this.isProcessRunning(pid)) {
              return {
                success: false,
                message: `Failed to stop process even with SIGKILL - process ${pid} may be stuck`,
                wasRunning: true
              };
            } else {
              this.removePidFile();
              return {
                success: true,
                message: `Gateway force stopped after ${timeoutSeconds}s timeout`,
                wasRunning: true
              };
            }
          } else {
            this.removePidFile();
            return {
              success: true,
              message: 'Gateway server stopped gracefully',
              wasRunning: true
            };
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
            this.removePidFile();
            return {
              success: true,
              message: 'Process was already stopped - cleaned up PID file',
              wasRunning: false
            };
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to stop gateway: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the gateway server is currently running
   */
  isServerRunning(): boolean {
    try {
      if (!fs.existsSync(PID_FILE)) {
        return false;
      }

      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      
      // Check if process is actually running
      try {
        process.kill(pid, 0); // Signal 0 checks if process exists
        return true;
      } catch {
        // Process doesn't exist, remove stale PID file
        this.removePidFile();
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get the PID of the running server
   */
  getRunningPid(): number | undefined {
    try {
      if (!fs.existsSync(PID_FILE)) {
        return undefined;
      }
      return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if process is running
   */
  private isProcessRunning(pid: number): boolean {
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
  private removePidFile(): void {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {
      // Ignore file removal errors
    }
  }
}
