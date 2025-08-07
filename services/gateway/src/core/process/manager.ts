import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { MCPServerConfig, TeamMCPConfig } from '../../types/mcp';

export interface ProcessInfo {
  id: string;
  config: MCPServerConfig;
  process: ChildProcess;
  status: 'starting' | 'running' | 'terminating' | 'terminated' | 'failed';
  startTime: number;
  lastActivity: number;
  messageCount: number;
  errorCount: number;
  activeRequests: Map<string, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
  }>;
}

export interface ProcessStartResult {
  success: boolean;
  processInfo?: ProcessInfo;
  error?: string;
}

export interface AllProcessesResult {
  totalServers: number;
  successfulStarts: number;
  failedStarts: number;
  processes: ProcessInfo[];
  errors: Array<{
    serverName: string;
    error: string;
  }>;
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInfo>();
  private processIdsByName = new Map<string, string>();

  constructor() {
    super();
  }

  /**
   * Start all MCP servers for a team configuration
   * This is the new primary method for the persistent background process model
   */
  async startAllServers(teamConfig: TeamMCPConfig, options: {
    continueOnError?: boolean;
    showProgress?: boolean;
  } = {}): Promise<AllProcessesResult> {
    const { continueOnError = true, showProgress = false } = options;
    
    if (showProgress) {
      console.log(chalk.blue(`🚀 Starting ${teamConfig.servers.length} MCP server${teamConfig.servers.length === 1 ? '' : 's'} for team: ${teamConfig.team_name}`));
    }

    const result: AllProcessesResult = {
      totalServers: teamConfig.servers.length,
      successfulStarts: 0,
      failedStarts: 0,
      processes: [],
      errors: []
    };

    if (teamConfig.servers.length === 0) {
      if (showProgress) {
        console.log(chalk.gray('   No MCP servers configured for this team'));
      }
      return result;
    }

    // Start all servers
    for (const serverConfig of teamConfig.servers) {
      try {
        if (showProgress) {
          console.log(chalk.gray(`   Starting ${serverConfig.installation_name}...`));
        }

        const processInfo = await this.spawnProcess(serverConfig);
        result.processes.push(processInfo);
        result.successfulStarts++;

        if (showProgress) {
          console.log(chalk.green(`   ✅ Started ${serverConfig.installation_name}`));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          serverName: serverConfig.installation_name,
          error: errorMessage
        });
        result.failedStarts++;

        if (showProgress) {
          console.warn(chalk.yellow(`   ⚠️  Failed to start ${serverConfig.installation_name}: ${errorMessage}`));
        }

        if (!continueOnError) {
          break;
        }
      }
    }

    if (showProgress) {
      if (result.successfulStarts > 0) {
        console.log(chalk.green(`✅ Successfully started ${result.successfulStarts}/${result.totalServers} MCP servers`));
      }
      if (result.failedStarts > 0) {
        console.log(chalk.yellow(`⚠️  ${result.failedStarts} server${result.failedStarts === 1 ? '' : 's'} failed to start`));
      }
    }

    this.emit('allServersStarted', result);
    return result;
  }

  /**
   * Stop all running MCP servers gracefully
   * Follows MCP spec: close stdin → wait → SIGTERM → wait → SIGKILL
   */
  async stopAllServers(options: {
    timeout?: number;
    showProgress?: boolean;
  } = {}): Promise<{
    totalProcesses: number;
    successfulStops: number;
    forcedStops: number;
    errors: Array<{
      processName: string;
      error: string;
    }>;
  }> {
    const { timeout = 10000, showProgress = false } = options;
    const allProcesses = Array.from(this.processes.values());
    
    if (allProcesses.length === 0) {
      return {
        totalProcesses: 0,
        successfulStops: 0,
        forcedStops: 0,
        errors: []
      };
    }

    if (showProgress) {
      console.log(chalk.blue(`🛑 Stopping ${allProcesses.length} MCP server${allProcesses.length === 1 ? '' : 's'}...`));
    }

    const result = {
      totalProcesses: allProcesses.length,
      successfulStops: 0,
      forcedStops: 0,
      errors: [] as Array<{
        processName: string;
        error: string;
      }>
    };

    // Stop all processes in parallel
    const stopPromises = allProcesses.map(async (processInfo) => {
      try {
        if (showProgress) {
          console.log(chalk.gray(`   Stopping ${processInfo.config.installation_name}...`));
        }

        await this.terminateProcess(processInfo, timeout);
        result.successfulStops++;

        if (showProgress) {
          console.log(chalk.green(`   ✅ Stopped ${processInfo.config.installation_name}`));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          processName: processInfo.config.installation_name,
          error: errorMessage
        });

        // Try force kill
        try {
          if (processInfo.process && !processInfo.process.killed) {
            processInfo.process.kill('SIGKILL');
            result.forcedStops++;
            
            if (showProgress) {
              console.log(chalk.yellow(`   ⚠️  Force stopped ${processInfo.config.installation_name}`));
            }
          }
        } catch {
          if (showProgress) {
            console.error(chalk.red(`   ❌ Failed to force stop ${processInfo.config.installation_name}`));
          }
        }
      }
    });

    await Promise.allSettled(stopPromises);

    if (showProgress) {
      console.log(chalk.green(`✅ Stopped ${result.successfulStops + result.forcedStops}/${result.totalProcesses} MCP servers`));
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`⚠️  ${result.errors.length} error${result.errors.length === 1 ? '' : 's'} during shutdown`));
      }
    }

    this.emit('allServersStopped', result);
    return result;
  }

  /**
   * Restart a specific MCP server
   */
  async restartServer(installationName: string, options: {
    timeout?: number;
    showProgress?: boolean;
  } = {}): Promise<ProcessInfo> {
    const { timeout = 10000, showProgress = false } = options;
    
    const processInfo = this.getProcessByName(installationName);
    if (!processInfo) {
      throw new Error(`Process ${installationName} not found`);
    }

    if (showProgress) {
      console.log(chalk.blue(`🔄 Restarting ${installationName}...`));
    }

    // Stop the process
    await this.terminateProcess(processInfo, timeout);

    if (showProgress) {
      console.log(chalk.gray(`   Stopped ${installationName}`));
    }

    // Start it again
    const newProcessInfo = await this.spawnProcess(processInfo.config);

    if (showProgress) {
      console.log(chalk.green(`✅ Restarted ${installationName}`));
    }

    return newProcessInfo;
  }

  /**
   * Get server status for a specific installation
   */
  getServerStatus(installationName: string): {
    exists: boolean;
    status?: ProcessInfo['status'];
    uptime?: number;
    messageCount?: number;
    errorCount?: number;
    lastActivity?: number;
    pid?: number;
  } {
    const processInfo = this.getProcessByName(installationName);
    
    if (!processInfo) {
      return { exists: false };
    }

    return {
      exists: true,
      status: processInfo.status,
      uptime: Date.now() - processInfo.startTime,
      messageCount: processInfo.messageCount,
      errorCount: processInfo.errorCount,
      lastActivity: processInfo.lastActivity,
      pid: processInfo.process.pid
    };
  }

  /**
   * Spawn an MCP server process
   */
  async spawnProcess(config: MCPServerConfig): Promise<ProcessInfo> {
    const processId = uuidv4();
    
    // Silently attempt to spawn MCP server

    try {
      const childProcess = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env },
        cwd: process.cwd()
      });

      const processInfo: ProcessInfo = {
        id: processId,
        config,
        process: childProcess,
        status: 'starting',
        startTime: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        errorCount: 0,
        activeRequests: new Map()
      };

      this.processes.set(processId, processInfo);
      this.processIdsByName.set(config.installation_name, processId);

      this.setupProcessHandlers(processInfo);
      
      // Perform MCP handshake with timeout
      try {
        await this.performMCPHandshake(processInfo);
        processInfo.status = 'running';
        console.log(chalk.green(`✅ MCP server ready: ${config.installation_name}`));
      } catch {
        processInfo.status = 'failed';
        
        // Clean up failed process
        await this.terminateProcess(processInfo, 1000);
        throw new Error(`Server ${config.installation_name} not available`);
      }

      this.emit('processSpawned', processInfo);
      return processInfo;
    } catch (error) {
      // Silently fail - error will be handled by caller
      throw error;
    }
  }

  /**
   * Get process by installation name
   */
  getProcessByName(installationName: string): ProcessInfo | null {
    const processId = this.processIdsByName.get(installationName);
    if (!processId) return null;
    return this.processes.get(processId) || null;
  }

  /**
   * Get all active processes
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Send message to MCP server process
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendMessage(processInfo: ProcessInfo, message: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      // Allow messages during 'starting' phase for handshake, but not if failed/terminated
      if (processInfo.status === 'failed' || processInfo.status === 'terminated' || processInfo.status === 'terminating') {
        reject(new Error(`Process ${processInfo.config.installation_name} is not running (status: ${processInfo.status})`));
        return;
      }

      // Check if the actual child process is still alive
      if (!processInfo.process || processInfo.process.killed || processInfo.process.exitCode !== null) {
        reject(new Error(`Process ${processInfo.config.installation_name} child process has died`));
        return;
      }

      const requestId = message.id;
      if (!requestId) {
        // Notification - no response expected
        const messageStr = JSON.stringify(message) + '\n';
        processInfo.process.stdin?.write(messageStr);
        resolve(null);
        return;
      }

      // Set up response handler
      const timeoutHandle = setTimeout(() => {
        processInfo.activeRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, timeout);

      processInfo.activeRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        startTime: Date.now()
      });

      // Send message
      const messageStr = JSON.stringify(message) + '\n';
      processInfo.process.stdin?.write(messageStr, (error) => {
        if (error) {
          processInfo.activeRequests.delete(requestId);
          clearTimeout(timeoutHandle);
          reject(error);
        }
      });

      processInfo.messageCount++;
      processInfo.lastActivity = Date.now();
    });
  }

  /**
   * Terminate a process
   */
  async terminateProcess(processInfo: ProcessInfo, timeout: number = 10000): Promise<void> {
    if (processInfo.status === 'terminated') {
      return;
    }

    processInfo.status = 'terminating';

    // Cancel active requests
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [requestId, request] of processInfo.activeRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Process terminating'));
    }
    processInfo.activeRequests.clear();

    // Try graceful shutdown first
    if (processInfo.process && !processInfo.process.killed) {
      processInfo.process.kill('SIGTERM');
      
      // Wait for graceful exit
      await new Promise<void>((resolve) => {
        const forceTimeout = setTimeout(() => {
          if (processInfo.process && !processInfo.process.killed) {
            processInfo.process.kill('SIGKILL');
          }
          resolve();
        }, timeout);

        processInfo.process.once('exit', () => {
          clearTimeout(forceTimeout);
          resolve();
        });
      });
    }

    processInfo.status = 'terminated';
    this.processes.delete(processInfo.id);
    this.processIdsByName.delete(processInfo.config.installation_name);
    
    this.emit('processTerminated', processInfo);
  }

  /**
   * Terminate all processes
   */
  async terminateAllProcesses(): Promise<void> {
    const processes = Array.from(this.processes.values());
    const terminationPromises = processes.map(processInfo => 
      this.terminateProcess(processInfo).catch(error => {
        console.error(`Failed to terminate process ${processInfo.config.installation_name}:`, error);
      })
    );
    
    await Promise.all(terminationPromises);
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(processInfo: ProcessInfo): void {
    const { process: childProcess, config } = processInfo;

    // Handle stdout (JSON-RPC responses)
    let buffer = '';
    childProcess.stdout?.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      lines.forEach(line => {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleServerMessage(processInfo, message);
          } catch {
            console.error(chalk.red(`Parse error from ${config.installation_name}:`), line);
          }
        }
      });
    });

    // Handle stderr (logging) - capture informational output, don't treat as errors
    childProcess.stderr?.on('data', (data) => {
      const stderrOutput = data.toString().trim();
      if (stderrOutput) {
        // Use gray color for informational stderr output, not red
        console.log(chalk.gray(`[${config.installation_name} info]:`), stderrOutput);
        // Don't increment error count for normal stderr logging
      }
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      processInfo.status = 'terminated';
      this.processes.delete(processInfo.id);
      this.processIdsByName.delete(config.installation_name);
      this.emit('processExit', processInfo, code, signal);
    });

    // Handle process errors (actual spawn/process errors)
    childProcess.on('error', (error) => {
      processInfo.status = 'failed';
      processInfo.errorCount++;
      console.error(chalk.red(`[${config.installation_name} error]:`), error.message);
      this.emit('processError', processInfo, error);
    });
  }

  /**
   * Handle messages from MCP server
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleServerMessage(processInfo: ProcessInfo, message: any): void {
    processInfo.lastActivity = Date.now();

    if (message.id && processInfo.activeRequests.has(message.id)) {
      // Response to a request
      const request = processInfo.activeRequests.get(message.id)!;
      clearTimeout(request.timeout);
      processInfo.activeRequests.delete(message.id);

      if (message.error) {
        request.reject(new Error(message.error.message || 'MCP server error'));
      } else {
        request.resolve(message.result || message);
      }
    } else if (message.method) {
      // Notification from server
      this.emit('serverNotification', processInfo, message);
    }
  }

  /**
   * Perform MCP protocol handshake
   */
  private async performMCPHandshake(processInfo: ProcessInfo): Promise<void> {
    const initMessage = {
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: {
          name: 'deploystack-gateway',
          version: '1.0.0'
        },
        capabilities: {
          roots: { listChanged: false },
          sampling: {}
        }
      }
    };

    try {
      // Increase timeout to 30 seconds for MCP servers that need to download packages via npx
      console.log(chalk.gray(`   Performing MCP handshake with ${processInfo.config.installation_name}...`));
      const response = await this.sendMessage(processInfo, initMessage, 30000);
      
      if (!response || !response.serverInfo) {
        throw new Error(`Invalid initialization response: ${JSON.stringify(response)}`);
      }

      console.log(chalk.gray(`   MCP handshake successful with ${processInfo.config.installation_name}`));

      // Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };

      await this.sendMessage(processInfo, initializedNotification);
      
    } catch (error) {
      console.error(chalk.red(`   MCP handshake failed for ${processInfo.config.installation_name}:`), error);
      throw new Error(`MCP handshake failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
