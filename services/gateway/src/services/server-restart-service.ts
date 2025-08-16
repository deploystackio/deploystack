import chalk from 'chalk';
import ora from 'ora';
import { ServerStartService, ServerStartOptions, ServerStartResult } from './server-start-service';
import { CredentialStorage } from '../core/auth/storage';
import fs from 'fs';
import path from 'path';
import os from 'os';

// PID file location (same as ServerStartService)
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export type ServerRestartOptions = ServerStartOptions;

export interface ServerRestartResult extends ServerStartResult {
  restarted: boolean;
}

export class ServerRestartService {
  private serverStartService: ServerStartService;
  private credentialStorage: CredentialStorage;

  constructor() {
    this.serverStartService = new ServerStartService();
    this.credentialStorage = new CredentialStorage();
  }

  /**
   * Restart the DeployStack Gateway server with graceful stop → start sequence
   * Handles all the complexity of PID management, daemon mode, and process orchestration
   */
  async restartGatewayServer(options: ServerRestartOptions = {}): Promise<ServerRestartResult> {
    let spinner: ReturnType<typeof ora> | null = null;

    try {
      // Check if server is currently running
      const isRunning = this.serverStartService.isServerRunning();
      
      if (!isRunning) {
        console.log(chalk.yellow('⚠️  Gateway server is not currently running'));
        console.log(chalk.blue('🚀 Starting gateway server...'));
        
        // Just start the server if it's not running
        const startResult = await this.serverStartService.startGatewayServer(options);
        
        return {
          ...startResult,
          restarted: false // It was a start, not a restart
        };
      }

      console.log(chalk.blue('🔄 Restarting DeployStack Gateway...'));
      
      // Step 1: Graceful shutdown
      spinner = ora('Stopping gateway server and MCP processes...').start();
      
      try {
        await this.stopGatewayServer();
        spinner.succeed('Gateway server stopped');
      } catch (error) {
        spinner.fail('Failed to stop gateway server gracefully');
        throw new Error(`Failed to stop gateway: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Step 2: Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Start the server with new configuration
      spinner = ora('Starting gateway server with updated configuration...').start();
      
      try {
        const startResult = await this.serverStartService.startGatewayServer(options);
        
        if (startResult.success) {
          spinner.succeed('Gateway server restarted successfully');
          
          return {
            ...startResult,
            restarted: true
          };
        } else {
          spinner.fail('Failed to start gateway server');
          throw new Error('Failed to start gateway after stop');
        }
      } catch (error) {
        spinner.fail('Failed to start gateway server');
        throw new Error(`Failed to start gateway: ${error instanceof Error ? error.message : String(error)}`);
      }

    } catch (error) {
      if (spinner) {
        spinner.fail('Gateway restart failed');
      }
      throw error;
    }
  }

  /**
   * Stop the gateway server gracefully
   * This handles the complex shutdown sequence including MCP process cleanup
   */
  private async stopGatewayServer(): Promise<void> {
    try {
      // Get the running PID
      const pid = this.getRunningPid();
      if (!pid) {
        throw new Error('No running gateway process found');
      }

      // Check if process exists
      try {
        process.kill(pid, 0); // Signal 0 checks if process exists
      } catch {
        // Process doesn't exist, clean up PID file
        this.removePidFile();
        throw new Error('Gateway process is not running');
      }

      // Send SIGTERM for graceful shutdown
      process.kill(pid, 'SIGTERM');

      // Wait for process to exit gracefully (up to 15 seconds)
      const maxWaitTime = 15000;
      const checkInterval = 500;
      let waitTime = 0;

      while (waitTime < maxWaitTime) {
        try {
          process.kill(pid, 0);
          // Process still exists, wait more
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
        } catch {
          // Process has exited
          this.removePidFile();
          return;
        }
      }

      // If we get here, process didn't exit gracefully, force kill
      try {
        process.kill(pid, 'SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        // Process might have exited between checks
      }

      // Clean up PID file
      this.removePidFile();

    } catch (error) {
      // Clean up PID file even on error
      this.removePidFile();
      throw error;
    }
  }

  /**
   * Get the PID of the running server
   */
  private getRunningPid(): number | undefined {
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
   * Remove PID file
   */
  private removePidFile(): void {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not remove PID file:'), error);
    }
  }

  /**
   * Check if the gateway server is currently running
   */
  isServerRunning(): boolean {
    return this.serverStartService.isServerRunning();
  }
}
