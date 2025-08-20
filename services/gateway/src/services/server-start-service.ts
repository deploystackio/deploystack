import chalk from 'chalk';
import { ProxyServer } from '../core/server/proxy';
import { CredentialStorage } from '../core/auth/storage';
import { MCPConfigService } from '../core/mcp';
import { RuntimeState } from '../core/process/runtime-state';
import { ProcessManager } from '../core/process/manager';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// PID file location
const PID_FILE = path.join(os.tmpdir(), 'deploystack-gateway.pid');

export interface ServerStartOptions {
  port?: number;
  host?: string;
  foreground?: boolean;
  teamId?: string;
}

export interface ServerStartResult {
  success: boolean;
  pid?: number;
  endpoints?: {
    sse: string;
    messages: string;
    health: string;
  };
  mcpServersStarted?: number;
  teamName?: string;
}

export class ServerStartService {
  /**
   * Start the DeployStack Gateway server with complete daemon functionality
   * This provides identical behavior whether called from login or start command
   */
  async startGatewayServer(options: ServerStartOptions = {}): Promise<ServerStartResult> {
    const port = options.port || 9095;
    const host = options.host || 'localhost';
    const foreground = options.foreground || false;

    try {
      // Skip the running check if this is a daemon child process
      const isDaemonChild = process.env.DEPLOYSTACK_DAEMON === 'true';
      
      if (!isDaemonChild) {
        // Check if server is already running (only for parent process)
        if (this.isServerRunning()) {
          return {
            success: false,
            pid: this.getRunningPid()
          };
        }
      }

      if (foreground) {
        // Run in foreground mode
        return await this.startServerProcess(port, host, true, options.teamId);
      } else {
        // Default daemon mode - fork the process
        return await this.startDaemon(port, host, options.teamId);
      }

    } catch (error) {
      throw new Error(`Failed to start gateway: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start daemon process by forking
   */
  private async startDaemon(port: number, host: string, _teamId?: string): Promise<ServerStartResult> {
    // Get the current script path
    const scriptPath = process.argv[1]; // This is the compiled JS file
    
    const args = ['start', '--foreground', '--port', port.toString(), '--host', host];
    
    // Create log files for debugging
    const logDir = path.join(os.tmpdir(), 'deploystack-gateway-logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const stdoutLog = path.join(logDir, 'stdout.log');
    const stderrLog = path.join(logDir, 'stderr.log');
    
    // Open log files
    const stdout = fs.openSync(stdoutLog, 'a');
    const stderr = fs.openSync(stderrLog, 'a');
    
    // Spawn daemon process with logging
    const child = spawn(process.execPath, [scriptPath, ...args], {
      detached: true,
      stdio: ['ignore', stdout, stderr], // Log stdout and stderr for debugging
      env: { ...process.env, DEPLOYSTACK_DAEMON: 'true' }
    });

    // Write the child PID to the PID file
    this.writePidFile(child.pid!);

    // Handle child process events for better error reporting
    let startupError: string | null = null;
    
    child.on('error', (error) => {
      startupError = `Child process error: ${error.message}`;
    });

    child.on('exit', (code, signal) => {
      if (code !== 0) {
        startupError = `Child process exited with code ${code}, signal ${signal}`;
      }
    });

    // Immediately unref the child process so parent can exit
    child.unref();

    // Wait a moment to see if the process starts successfully
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if the process is still running
    try {
      process.kill(child.pid!, 0);
      
      // Close log file descriptors
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      
      return {
        success: true,
        pid: child.pid!,
        endpoints: {
          sse: `http://${host}:${port}/sse`,
          messages: `http://${host}:${port}/message`,
          health: `http://${host}:${port}/health`
        }
      };
    } catch {
      // Close log file descriptors
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      
      this.removePidFile();
      
      // Try to read error logs for better error reporting
      let errorDetails = 'Process died during startup';
      try {
        if (fs.existsSync(stderrLog)) {
          const stderrContent = fs.readFileSync(stderrLog, 'utf8').trim();
          if (stderrContent) {
            errorDetails += `\nStderr: ${stderrContent.split('\n').slice(-5).join('\n')}`;
          }
        }
        if (startupError) {
          errorDetails += `\nStartup error: ${startupError}`;
        }
      } catch {
        // Ignore log reading errors
      }
      
      throw new Error(errorDetails);
    }
  }

  /**
   * Start server in current process (foreground mode)
   * Starts ALL MCP servers as persistent background processes
   */
  private async startServerProcess(
    port: number, 
    host: string, 
    foreground: boolean, 
    teamId?: string
  ): Promise<ServerStartResult> {
    // Initialize core components for persistent process management
    const credentialStorage = new CredentialStorage();
    const mcpConfigService = new MCPConfigService();
    const runtimeState = new RuntimeState();
    const processManager = new ProcessManager();
    
    // Create proxy server with shared instances for runtime state integration
    const server = new ProxyServer(processManager, mcpConfigService, credentialStorage);

    // Setup graceful shutdown - stops ALL MCP servers first
    const shutdown = async () => {
      try {
        // Step 1: Stop all MCP servers gracefully (following MCP spec)
        await processManager.stopAllServers({ 
          timeout: 10000, 
          showProgress: false 
        });

        // Step 2: Stop HTTP proxy server
        await server.stop();

        // Step 3: Clean up
        this.removePidFile();
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('❌ Error during shutdown:'), error);
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
      // Step 1: Check authentication and team selection
      if (!await credentialStorage.isAuthenticated()) {
        throw new Error('Not authenticated - run "deploystack login" first');
      }

      const credentials = await credentialStorage.getCredentials();
      if (!credentials?.selectedTeam) {
        throw new Error('No team selected - run "deploystack teams --switch <team-number>" to select a team');
      }

      // Use provided teamId or fall back to selected team
      const targetTeamId = teamId || credentials.selectedTeam.id;
      const targetTeamName = credentials.selectedTeam.name;

      // Step 2: Load team MCP configuration
      let teamConfig;
      try {
        teamConfig = await mcpConfigService.getMCPConfig(targetTeamId);
        
        if (!teamConfig) {
          // Continue without MCP servers - just start HTTP server
          teamConfig = {
            team_id: targetTeamId,
            team_name: targetTeamName,
            installations: [],
            user_configurations: [],
            servers: [],
            last_updated: new Date().toISOString()
          };
        }
      } catch {
        // Continue without MCP servers
        teamConfig = {
          team_id: targetTeamId,
          team_name: targetTeamName,
          installations: [],
          user_configurations: [],
          servers: [],
          last_updated: new Date().toISOString()
        };
      }

      // Step 3: Set team context in runtime state
      runtimeState.setCurrentTeam(teamConfig.team_id);

      let mcpServersStarted = 0;

      // Step 4: Start all MCP servers as persistent background processes
      if (teamConfig.servers.length > 0) {
        const startResult = await processManager.startAllServers(teamConfig, {
          continueOnError: true,
          showProgress: false
        });

        // Add all started processes to runtime state
        for (const processInfo of startResult.processes) {
          const installation = teamConfig.installations.find(
            inst => inst.installation_name === processInfo.config.installation_name
          );
          const installationId = installation?.id || processInfo.config.installation_name;

          runtimeState.addProcess(
            processInfo,
            installationId,
            processInfo.config.installation_name,
            teamConfig.team_id
          );
        }

        mcpServersStarted = startResult.successfulStarts;
      }

      // Step 5: Start HTTP proxy server
      await server.start(port, host);

      // Step 6: Write PID file
      this.writePidFile(process.pid);

      const result: ServerStartResult = {
        success: true,
        pid: process.pid,
        endpoints: {
          sse: `http://${host}:${port}/sse`,
          messages: `http://${host}:${port}/message`,
          health: `http://${host}:${port}/health`
        },
        mcpServersStarted,
        teamName: teamConfig.team_name
      };

      if (foreground) {
        // Keep the process alive
        await new Promise(() => {}); // Run forever until shutdown
      }

      return result;

    } catch (error) {
      // Clean up any started processes
      try {
        await processManager.stopAllServers({ timeout: 5000, showProgress: false });
      } catch {
        // Ignore cleanup errors
      }
      
      this.removePidFile();
      throw error;
    }
  }

  /**
   * Check if server is already running by checking PID file
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
   * Write PID file
   */
  private writePidFile(pid: number): void {
    try {
      fs.writeFileSync(PID_FILE, pid.toString());
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not write PID file:'), error);
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
}
