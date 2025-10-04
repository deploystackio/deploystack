import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'pino';
import { MCPServerConfig, ProcessInfo } from './types';

/**
 * Process Manager for MCP server subprocesses
 * Handles spawning, communication, and lifecycle management of stdio-based MCP servers
 * Adapted from gateway for multi-tenant satellite architecture
 */
export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInfo>();
  private processIdsByName = new Map<string, string>();
  private logger: Logger;
  private restartAttempts = new Map<string, number[]>(); // installationName -> crash timestamps

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    
    // Listen for process exits to detect crashes and attempt restart
    this.on('processExit', (processInfo, code, signal) => {
      this.handleProcessExit(processInfo, code, signal);
    });
  }
  
  /**
   * Handle process exit - determine if crash and attempt restart
   */
  private async handleProcessExit(
    processInfo: ProcessInfo,
    code: number | null,
    signal: NodeJS.Signals | null
  ): Promise<void> {
    const uptime = Date.now() - processInfo.startTime;
    const installationName = processInfo.config.installation_name;
    
    // Determine if this was a crash (non-zero exit code) or intentional shutdown
    const wasCrash = code !== 0 && code !== null && processInfo.status !== 'terminating';
    
    if (!wasCrash) {
      this.logger.debug({
        operation: 'process_exit_normal',
        installation_name: installationName,
        exit_code: code,
        signal: signal
      }, 'Process exited normally (not a crash)');
      return;
    }

    // This was a crash
    this.logger.error({
      operation: 'process_crashed',
      installation_name: installationName,
      team_id: processInfo.config.team_id,
      exit_code: code,
      signal: signal,
      uptime_ms: uptime
    }, `MCP process crashed: ${installationName}`);

    // Check if we should attempt restart
    const canRestart = this.shouldAttemptRestart(installationName, uptime);
    
    if (!canRestart) {
      this.logger.error({
        operation: 'restart_limit_exceeded',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        max_attempts: 3
      }, `Max restart attempts (3) exceeded for ${installationName} - marking as permanently failed`);
      
      // Mark as permanently failed (process already removed from maps in exit handler)
      // Emit event so RuntimeState can update status
      this.emit('restartLimitExceeded', processInfo);
      return;
    }

    // Calculate restart delay
    const delay = this.calculateRestartDelay(installationName, uptime);
    
    this.logger.info({
      operation: 'restart_scheduled',
      installation_name: installationName,
      team_id: processInfo.config.team_id,
      delay_ms: delay,
      attempt_number: (this.restartAttempts.get(installationName) || []).length
    }, `Scheduling automatic restart in ${delay}ms`);

    // Wait for backoff period
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Attempt restart
    try {
      this.logger.info({
        operation: 'restart_attempt',
        installation_name: installationName,
        team_id: processInfo.config.team_id
      }, `Attempting automatic restart of ${installationName}`);

      const newProcessInfo = await this.spawnProcess(processInfo.config);
      
      this.logger.info({
        operation: 'restart_success',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        new_pid: newProcessInfo.process.pid
      }, `Automatic restart successful for ${installationName}`);

      this.emit('processRestarted', newProcessInfo, processInfo);
      
    } catch (error) {
      this.logger.error({
        operation: 'restart_failed',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        error: error instanceof Error ? error.message : String(error)
      }, `Automatic restart failed for ${installationName}`);
      
      this.emit('restartFailed', processInfo, error);
    }
  }

  /**
   * Check if restart should be attempted (max 3 attempts in 5 minutes)
   */
  private shouldAttemptRestart(installationName: string, _uptime: number): boolean {
    const now = Date.now();
    const attempts = this.restartAttempts.get(installationName) || [];
    
    // Filter to attempts in last 5 minutes
    const recentAttempts = attempts.filter(ts => now - ts < 5 * 60 * 1000);
    
    // Add this attempt
    recentAttempts.push(now);
    this.restartAttempts.set(installationName, recentAttempts);

    // Max 3 attempts in 5 minutes
    return recentAttempts.length <= 3;
  }

  /**
   * Calculate restart delay based on crash timing
   */
  private calculateRestartDelay(installationName: string, uptime: number): number {
    // If process ran for > 60 seconds before crash, restart immediately
    if (uptime > 60 * 1000) {
      return 0;
    }

    // Process crashed quickly - use exponential backoff
    const attempts = (this.restartAttempts.get(installationName) || []).length;
    const delays = [1000, 5000, 15000]; // 1s, 5s, 15s
    
    return delays[Math.min(attempts - 1, delays.length - 1)] || 0;
  }

  /**
   * Restart a specific MCP server
   */
  async restartServer(installationName: string, timeout: number = 10000): Promise<ProcessInfo> {
    const processInfo = this.getProcessByName(installationName);
    if (!processInfo) {
      throw new Error(`Process ${installationName} not found`);
    }

    this.logger.info({
      operation: 'mcp_server_restart_start',
      installation_name: installationName,
      process_id: processInfo.id
    }, `Restarting MCP server: ${installationName}`);

    // Stop the process
    await this.terminateProcess(processInfo, timeout);

    this.logger.debug({
      operation: 'mcp_server_restart_stopped',
      installation_name: installationName
    }, `Stopped ${installationName}, now restarting`);

    // Start it again
    const newProcessInfo = await this.spawnProcess(processInfo.config);

    this.logger.info({
      operation: 'mcp_server_restart_success',
      installation_name: installationName,
      new_process_id: newProcessInfo.id,
      pid: newProcessInfo.process.pid
    }, `Successfully restarted MCP server: ${installationName}`);

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
   * Spawn an MCP server process (routes to direct or nsjail based on environment)
   */
  async spawnProcess(config: MCPServerConfig): Promise<ProcessInfo> {
    const processId = uuidv4();
    
    this.logger.info({
      operation: 'mcp_server_spawn_start',
      installation_name: config.installation_name,
      installation_id: config.installation_id,
      team_id: config.team_id,
      command: config.command,
      args: config.args
    }, `Spawning MCP server: ${config.installation_name}`);

    try {
      // Determine isolation mode based on environment
      const useNsjail = this.shouldUseNsjail();
      const childProcess = useNsjail 
        ? this.spawnWithNsjail(config)
        : this.spawnDirect(config);

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
        
        this.logger.info({
          operation: 'mcp_server_spawn_success',
          installation_name: config.installation_name,
          installation_id: config.installation_id,
          team_id: config.team_id,
          process_id: processId,
          pid: childProcess.pid
        }, `MCP server ready: ${config.installation_name}`);
      } catch (error) {
        processInfo.status = 'failed';
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'mcp_server_handshake_failed',
          installation_name: config.installation_name,
          installation_id: config.installation_id,
          team_id: config.team_id,
          error: errorMessage
        }, `MCP handshake failed for ${config.installation_name}`);
        
        // Clean up failed process
        await this.terminateProcess(processInfo, 1000);
        throw new Error(`Server ${config.installation_name} not available: ${errorMessage}`);
      }

      this.emit('processSpawned', processInfo);
      return processInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'mcp_server_spawn_failed',
        installation_name: config.installation_name,
        installation_id: config.installation_id,
        team_id: config.team_id,
        error: errorMessage
      }, `Failed to spawn MCP server: ${config.installation_name}`);
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
   * Send message to MCP server process via stdin
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
        
        this.logger.debug({
          operation: 'mcp_notification_sent',
          installation_name: processInfo.config.installation_name,
          method: message.method
        }, `Sent notification: ${message.method}`);
        
        resolve(null);
        return;
      }

      // Set up response handler
      const timeoutHandle = setTimeout(() => {
        processInfo.activeRequests.delete(requestId);
        
        this.logger.error({
          operation: 'mcp_request_timeout',
          installation_name: processInfo.config.installation_name,
          request_id: requestId,
          method: message.method,
          timeout_ms: timeout
        }, `Request timeout: ${requestId}`);
        
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
          
          this.logger.error({
            operation: 'mcp_message_send_failed',
            installation_name: processInfo.config.installation_name,
            request_id: requestId,
            error: error.message
          }, `Failed to send message: ${requestId}`);
          
          reject(error);
        }
      });

      processInfo.messageCount++;
      processInfo.lastActivity = Date.now();
      
      this.logger.debug({
        operation: 'mcp_request_sent',
        installation_name: processInfo.config.installation_name,
        request_id: requestId,
        method: message.method
      }, `Sent request: ${requestId}`);
    });
  }

  /**
   * Terminate a process gracefully (SIGTERM → SIGKILL)
   */
  async terminateProcess(processInfo: ProcessInfo, timeout: number = 10000): Promise<void> {
    if (processInfo.status === 'terminated') {
      return;
    }

    this.logger.info({
      operation: 'mcp_server_terminate_start',
      installation_name: processInfo.config.installation_name,
      process_id: processInfo.id,
      pid: processInfo.process.pid
    }, `Terminating MCP server: ${processInfo.config.installation_name}`);

    processInfo.status = 'terminating';

    // Cancel active requests
    for (const [, request] of processInfo.activeRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Process terminating'));
    }
    processInfo.activeRequests.clear();

    // Try graceful shutdown first
    if (processInfo.process && !processInfo.process.killed) {
      processInfo.process.kill('SIGTERM');
      
      this.logger.debug({
        operation: 'mcp_server_sigterm_sent',
        installation_name: processInfo.config.installation_name,
        pid: processInfo.process.pid
      }, `Sent SIGTERM to ${processInfo.config.installation_name}`);
      
      // Wait for graceful exit
      await new Promise<void>((resolve) => {
        const forceTimeout = setTimeout(() => {
          if (processInfo.process && !processInfo.process.killed) {
            this.logger.warn({
              operation: 'mcp_server_force_kill',
              installation_name: processInfo.config.installation_name,
              pid: processInfo.process.pid
            }, `Force killing ${processInfo.config.installation_name} after timeout`);
            
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
    
    this.logger.info({
      operation: 'mcp_server_terminate_success',
      installation_name: processInfo.config.installation_name,
      process_id: processInfo.id
    }, `Terminated MCP server: ${processInfo.config.installation_name}`);
    
    this.emit('processTerminated', processInfo);
  }

  /**
   * Terminate all processes
   */
  async terminateAllProcesses(): Promise<void> {
    const processes = Array.from(this.processes.values());
    
    this.logger.info({
      operation: 'mcp_terminate_all_start',
      process_count: processes.length
    }, `Terminating all ${processes.length} MCP server processes`);
    
    const terminationPromises = processes.map(processInfo => 
      this.terminateProcess(processInfo).catch(error => {
        this.logger.error({
          operation: 'mcp_terminate_failed',
          installation_name: processInfo.config.installation_name,
          error: error instanceof Error ? error.message : String(error)
        }, `Failed to terminate process ${processInfo.config.installation_name}`);
      })
    );
    
    await Promise.all(terminationPromises);
    
    this.logger.info({
      operation: 'mcp_terminate_all_success',
      process_count: processes.length
    }, `Terminated all ${processes.length} MCP server processes`);
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
          } catch (error) {
            this.logger.error({
              operation: 'mcp_stdout_parse_error',
              installation_name: config.installation_name,
              line: line,
              error: error instanceof Error ? error.message : String(error)
            }, `Failed to parse stdout from ${config.installation_name}`);
          }
        }
      });
    });

    // Handle stderr (informational logging from MCP server)
    childProcess.stderr?.on('data', (data) => {
      const stderrOutput = data.toString().trim();
      if (stderrOutput) {
        // Log informational stderr output at debug level (not errors)
        this.logger.debug({
          operation: 'mcp_stderr_info',
          installation_name: config.installation_name,
          output: stderrOutput
        }, `MCP server info: ${config.installation_name}`);
      }
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      processInfo.status = 'terminated';
      this.processes.delete(processInfo.id);
      this.processIdsByName.delete(config.installation_name);
      
      this.logger.info({
        operation: 'mcp_server_exit',
        installation_name: config.installation_name,
        installation_id: config.installation_id,
        team_id: config.team_id,
        process_id: processInfo.id,
        exit_code: code,
        signal: signal
      }, `MCP server exited: ${config.installation_name} (code: ${code}, signal: ${signal})`);
      
      this.emit('processExit', processInfo, code, signal);
    });

    // Handle process errors (actual spawn/process errors)
    childProcess.on('error', (error) => {
      processInfo.status = 'failed';
      processInfo.errorCount++;
      
      this.logger.error({
        operation: 'mcp_server_error',
        installation_name: config.installation_name,
        installation_id: config.installation_id,
        team_id: config.team_id,
        process_id: processInfo.id,
        error: error.message
      }, `MCP server error: ${config.installation_name}`);
      
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

      const duration = Date.now() - request.startTime;
      
      if (message.error) {
        this.logger.error({
          operation: 'mcp_request_error',
          installation_name: processInfo.config.installation_name,
          request_id: message.id,
          error: message.error.message || 'Unknown MCP error',
          duration_ms: duration
        }, `MCP request failed: ${message.id}`);
        
        request.reject(new Error(message.error.message || 'MCP server error'));
      } else {
        this.logger.debug({
          operation: 'mcp_request_success',
          installation_name: processInfo.config.installation_name,
          request_id: message.id,
          duration_ms: duration
        }, `MCP request succeeded: ${message.id}`);
        
        request.resolve(message.result || message);
      }
    } else if (message.method) {
      // Notification from server
      this.logger.debug({
        operation: 'mcp_server_notification',
        installation_name: processInfo.config.installation_name,
        method: message.method
      }, `Received notification from ${processInfo.config.installation_name}: ${message.method}`);
      
      this.emit('serverNotification', processInfo, message);
    }
  }

  /**
   * Determine if nsjail should be used for process isolation
   */
  private shouldUseNsjail(): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    const isLinux = process.platform === 'linux';
    
    // Use nsjail only in production on Linux
    const shouldUse = isProduction && isLinux;
    
    this.logger.debug({
      operation: 'isolation_mode_check',
      use_nsjail: shouldUse,
      node_env: process.env.NODE_ENV,
      platform: process.platform
    }, `Isolation mode: ${shouldUse ? 'nsjail' : 'direct spawn'}`);
    
    return shouldUse;
  }

  /**
   * Spawn process directly without isolation (development mode)
   */
  private spawnDirect(config: MCPServerConfig) {
    this.logger.info({
      operation: 'spawn_direct',
      installation_name: config.installation_name,
      team_id: config.team_id
    }, 'Spawning process directly (no isolation - development mode)');

    return spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      cwd: process.cwd()
    });
  }

  /**
   * Spawn process with nsjail isolation (production mode on Linux)
   */
  private spawnWithNsjail(config: MCPServerConfig) {
    this.logger.info({
      operation: 'spawn_nsjail',
      installation_name: config.installation_name,
      team_id: config.team_id,
      memory_limit: '100MB',
      cpu_limit: '60s'
    }, 'Spawning process with nsjail isolation');

    // Build nsjail arguments
    const nsjailArgs = [
      '-Mo',                         // Mount mode: once, don't remount
      '--rlimit_as', '100',          // Memory limit: 100MB
      '--rlimit_cpu', '60',           // CPU time limit: 60 seconds
      '--rlimit_nproc', '50',         // Max processes: 50
      '--time_limit', '0',            // No wall-clock time limit
      '--user', '99999',              // Non-root user
      '--group', '99999',             // Non-root group
      '-R', '/usr',                   // Read-only mount: /usr
      '-R', '/lib',                   // Read-only mount: /lib
      '-R', '/lib64',                 // Read-only mount: /lib64
      '-R', '/bin',                   // Read-only mount: /bin
      '-R', '/etc/resolv.conf',       // DNS resolution
      '-T', '/tmp',                   // Writable temp directory
      '--disable_clone_newnet',       // Allow network access
      '--hostname', `mcp-${config.team_id}`, // Team-specific hostname
      // Inject environment variables
      ...Object.entries(config.env).flatMap(([key, value]) => ['-E', `${key}=${value}`]),
      '--',                           // End of nsjail args
      config.command,                 // MCP server command
      ...config.args                  // MCP server arguments
    ];

    return spawn('nsjail', nsjailArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  /**
   * Perform MCP protocol handshake (initialize + initialized notification)
   */
  private async performMCPHandshake(processInfo: ProcessInfo): Promise<void> {
    const initMessage = {
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-05',
        clientInfo: {
          name: 'deploystack-satellite',
          version: '1.0.0'
        },
        capabilities: {
          roots: { listChanged: false },
          sampling: {}
        }
      }
    };

    try {
      this.logger.debug({
        operation: 'mcp_handshake_start',
        installation_name: processInfo.config.installation_name
      }, `Performing MCP handshake with ${processInfo.config.installation_name}`);
      
      // Increase timeout to 30 seconds for MCP servers that need to download packages via npx
      const response = await this.sendMessage(processInfo, initMessage, 30000);
      
      if (!response || !response.serverInfo) {
        throw new Error(`Invalid initialization response: ${JSON.stringify(response)}`);
      }

      this.logger.debug({
        operation: 'mcp_handshake_initialized',
        installation_name: processInfo.config.installation_name,
        server_name: response.serverInfo.name,
        server_version: response.serverInfo.version
      }, `MCP handshake successful with ${processInfo.config.installation_name}`);

      // Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };

      await this.sendMessage(processInfo, initializedNotification);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'mcp_handshake_failed',
        installation_name: processInfo.config.installation_name,
        error: errorMessage
      }, `MCP handshake failed for ${processInfo.config.installation_name}`);
      
      throw new Error(`MCP handshake failed: ${errorMessage}`);
    }
  }
}
