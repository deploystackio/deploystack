import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'pino';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { MCPServerConfig, ProcessInfo } from './types';
import type { EventBus } from '../services/event-bus';
import type { RuntimeState } from './runtime-state';
import { nsjailConfig, mcpCacheBaseDir } from '../config/nsjail';

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
  private eventBus?: EventBus;
  private runtimeState?: RuntimeState;
  private respawningProcesses = new Map<string, Promise<ProcessInfo>>(); // installationName -> respawn promise

  constructor(logger: Logger, eventBus?: EventBus, runtimeState?: RuntimeState) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.runtimeState = runtimeState;
    
    // Listen for process exits to detect crashes and attempt restart
    this.on('processExit', (processInfo, code, signal) => {
      this.handleProcessExit(processInfo, code, signal);
    });
  }
  
  /**
   * Resolve command to full path for nsjail execution
   * nsjail has limited PATH, so we need full paths for common commands
   */
  private resolveCommandPath(command: string): string {
    // Map of common commands to their full paths
    const commandPaths: Record<string, string> = {
      'npx': '/usr/bin/npx',
      'node': '/usr/bin/node',
      'python': '/usr/bin/python',
      'python3': '/usr/bin/python3'
    };
    
    // If command is in our map, return full path
    if (commandPaths[command]) {
      return commandPaths[command];
    }
    
    // If command already starts with /, assume it's a full path
    if (command.startsWith('/')) {
      return command;
    }
    
    // Otherwise, try /usr/bin/ as default
    return `/usr/bin/${command}`;
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
    
    // Check if this is an intentional dormant shutdown (skip crash detection)
    if (processInfo.isDormantShutdown) {
      this.logger.info({
        operation: 'process_exit_dormant',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        exit_code: code,
        signal: signal,
        uptime_ms: uptime
      }, `Process terminated for dormancy (not a crash): ${installationName}`);
      return;
    }
    
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

    // Emit mcp.server.crashed event
    const crashCount = (this.restartAttempts.get(installationName) || []).length;
    const canRestart = this.shouldAttemptRestart(installationName, uptime);
    
    try {
      this.eventBus?.emit('mcp.server.crashed', {
        server_id: processInfo.config.installation_id,
        server_slug: processInfo.config.installation_name,
        team_id: processInfo.config.team_id,
        process_id: processInfo.process.pid || 0,
        exit_code: code || 0,
        signal: signal || 'none',
        uptime_seconds: Math.round(uptime / 1000),
        crash_count: crashCount + 1,
        will_restart: canRestart
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to emit mcp.server.crashed event (non-fatal)');
    }

    // Check if we should attempt restart
    
    if (!canRestart) {
      this.logger.error({
        operation: 'restart_limit_exceeded',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        max_attempts: 3
      }, `Max restart attempts (3) exceeded for ${installationName} - marking as permanently failed`);
      
      // Emit mcp.server.permanently_failed event
      try {
        this.eventBus?.emit('mcp.server.permanently_failed', {
          server_id: processInfo.config.installation_id,
          server_slug: processInfo.config.installation_name,
          team_id: processInfo.config.team_id,
          total_crashes: (this.restartAttempts.get(installationName) || []).length,
          last_error: `Exit code: ${code}, signal: ${signal}`,
          failed_at: new Date().toISOString()
        });
      } catch (error) {
        this.logger.warn({ error }, 'Failed to emit mcp.server.permanently_failed event (non-fatal)');
      }
      
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

      // Emit mcp.server.restarted event
      try {
        this.eventBus?.emit('mcp.server.restarted', {
          server_id: processInfo.config.installation_id,
          server_slug: processInfo.config.installation_name,
          team_id: processInfo.config.team_id,
          old_process_id: processInfo.process.pid || 0,
          new_process_id: newProcessInfo.process.pid || 0,
          restart_reason: 'crash',
          attempt_number: (this.restartAttempts.get(installationName) || []).length
        });
      } catch (error) {
        this.logger.warn({ error }, 'Failed to emit mcp.server.restarted event (non-fatal)');
      }

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
        ? await this.spawnWithNsjail(config)
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
        
        // Emit mcp.server.started event
        const spawnDuration = Date.now() - processInfo.startTime;
        try {
          this.eventBus?.emit('mcp.server.started', {
            server_id: config.installation_id,
            server_slug: config.installation_name,
            team_id: config.team_id,
            process_id: childProcess.pid || 0,
            transport: 'stdio',
            tool_count: 0, // Will be updated by tool discovery
            spawn_duration_ms: spawnDuration
          });
        } catch (error) {
          this.logger.warn({ error }, 'Failed to emit mcp.server.started event (non-fatal)');
        }
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
   * Get all dormant process names from RuntimeState
   */
  getAllDormantProcessNames(): string[] {
    if (!this.runtimeState) {
      return [];
    }
    return this.runtimeState.getAllDormantProcessNames();
  }

  /**
   * Get or respawn a process if it's dormant
   * This method checks active processes first, then dormant configs, and respawns if needed
   * Prevents concurrent respawn attempts for the same process
   */
  async getOrRespawnProcess(installationName: string): Promise<ProcessInfo> {
    // Check if process is already active
    const existingProcess = this.getProcessByName(installationName);
    if (existingProcess && existingProcess.status === 'running') {
      return existingProcess;
    }

    // Check if process is currently being respawned
    const respawningPromise = this.respawningProcesses.get(installationName);
    if (respawningPromise) {
      this.logger.debug({
        operation: 'dormant_process_respawn_waiting',
        installation_name: installationName
      }, `Waiting for in-progress respawn: ${installationName}`);
      return await respawningPromise;
    }

    // Check if process config exists in dormant map
    if (!this.runtimeState) {
      throw new Error(`Process ${installationName} not found and RuntimeState not available`);
    }

    const dormantConfig = this.runtimeState.getDormantConfig(installationName);
    if (!dormantConfig) {
      throw new Error(`Process ${installationName} not found in active or dormant maps`);
    }

    // Start respawning process
    const respawnStartTime = Date.now();
    this.logger.info({
      operation: 'dormant_process_respawn_start',
      installation_name: installationName,
      team_id: dormantConfig.team_id
    }, `Respawning dormant process: ${installationName}`);

    // Create respawn promise to prevent concurrent attempts
    const respawnPromise = (async () => {
      try {
        // Spawn the process
        const processInfo = await this.spawnProcess(dormantConfig);
        
        // Remove from dormant map
        this.runtimeState!.removeDormantConfig(installationName);
        
        const dormantDuration = respawnStartTime - (processInfo.startTime - 1000); // Approximate
        
        this.logger.info({
          operation: 'dormant_process_respawned',
          installation_name: installationName,
          team_id: dormantConfig.team_id,
          respawn_duration_ms: Date.now() - respawnStartTime,
          dormant_duration_ms: dormantDuration,
          pid: processInfo.process.pid
        }, `Dormant process respawned successfully: ${installationName}`);
        
        // Emit mcp.server.respawned event
        try {
          this.eventBus?.emit('mcp.server.respawned', {
            server_id: dormantConfig.installation_id,
            server_slug: installationName,
            team_id: dormantConfig.team_id,
            process_id: processInfo.process.pid || 0,
            dormant_duration_seconds: Math.round(dormantDuration / 1000),
            respawn_duration_ms: Date.now() - respawnStartTime
          });
        } catch (error) {
          this.logger.warn({ error }, 'Failed to emit mcp.server.respawned event (non-fatal)');
        }
        
        this.emit('processRespawned', processInfo);
        return processInfo;
        
      } finally {
        // Remove from respawning map
        this.respawningProcesses.delete(installationName);
      }
    })();

    // Store respawn promise
    this.respawningProcesses.set(installationName, respawnPromise);
    
    return await respawnPromise;
  }

  /**
   * Terminate a process and mark it as dormant for later respawning
   */
  async terminateAndMarkDormant(installationName: string, timeout: number = 10000): Promise<void> {
    const processInfo = this.getProcessByName(installationName);
    if (!processInfo) {
      this.logger.warn({
        operation: 'terminate_dormant_not_found',
        installation_name: installationName
      }, `Process not found for dormant marking: ${installationName}`);
      return;
    }

    if (!this.runtimeState) {
      this.logger.error({
        operation: 'terminate_dormant_no_runtime_state',
        installation_name: installationName
      }, 'Cannot mark process as dormant: RuntimeState not available');
      return;
    }

    const idleDuration = Date.now() - processInfo.lastActivity;
    
    this.logger.info({
      operation: 'process_marked_dormant_start',
      installation_name: installationName,
      team_id: processInfo.config.team_id,
      idle_duration_ms: idleDuration,
      last_activity: new Date(processInfo.lastActivity).toISOString()
    }, `Marking process as dormant due to inactivity: ${installationName}`);

    // Store config in dormant map before terminating
    this.runtimeState.markProcessDormant(installationName, processInfo.config);
    
    // Emit mcp.server.dormant event
    try {
      this.eventBus?.emit('mcp.server.dormant', {
        server_id: processInfo.config.installation_id,
        server_slug: installationName,
        team_id: processInfo.config.team_id,
        process_id: processInfo.process.pid || 0,
        idle_duration_seconds: Math.round(idleDuration / 1000),
        last_activity_at: new Date(processInfo.lastActivity).toISOString()
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to emit mcp.server.dormant event (non-fatal)');
    }
    
    // Terminate the process
    await this.terminateProcess(processInfo, timeout);
    
    this.logger.info({
      operation: 'process_marked_dormant_success',
      installation_name: installationName,
      team_id: processInfo.config.team_id
    }, `Process marked as dormant and terminated: ${installationName}`);
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
   * Ensure team-specific cache directory exists
   */
  private async ensureCacheDirectory(teamId: string): Promise<string> {
    const cacheDir = `${mcpCacheBaseDir}/mcp-cache/${teamId}`;
    
    if (!existsSync(cacheDir)) {
      this.logger.info({
        operation: 'create_cache_directory',
        team_id: teamId,
        cache_dir: cacheDir
      }, `Creating team cache directory: ${cacheDir}`);
      
      try {
        await mkdir(cacheDir, { recursive: true });
        
        this.logger.info({
          operation: 'cache_directory_created',
          team_id: teamId,
          cache_dir: cacheDir
        }, `Team cache directory created successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'cache_directory_creation_failed',
          team_id: teamId,
          cache_dir: cacheDir,
          error: errorMessage
        }, `Failed to create team cache directory`);
        throw new Error(`Failed to create cache directory: ${errorMessage}`);
      }
    }
    
    return cacheDir;
  }

  /**
   * Spawn process with nsjail isolation (production mode on Linux)
   * 
   * Configuration based on empirical testing with npx and Node.js:
   * - Memory: 2048MB (V8 minimum requirement)
   * - Processes: 1000 (npm spawns many child processes)
   * - File descriptors: 1024 (adequate for I/O operations)
   * - File size: 50MB (prevents oversized downloads)
   * - /dev files: Required for Node.js crypto and I/O operations
   * - --proc_rw: Required for pthread_create and thread management
   */
  private async spawnWithNsjail(config: MCPServerConfig) {
    // Ensure team-specific cache directory exists before mounting
    const cacheDir = await this.ensureCacheDirectory(config.team_id);
    
    this.logger.info({
      operation: 'spawn_nsjail',
      installation_name: config.installation_name,
      team_id: config.team_id,
      cache_dir: cacheDir,
      memory_limit_mb: nsjailConfig.memoryLimitMB,
      cpu_time_limit_seconds: nsjailConfig.cpuTimeLimitSeconds,
      max_processes: nsjailConfig.maxProcesses,
      max_open_files: nsjailConfig.maxOpenFiles,
      max_file_size_mb: nsjailConfig.maxFileSizeMB,
      tmpfs_size: nsjailConfig.tmpfsSize
    }, 'Spawning process with nsjail isolation');

    // Get current user UID and GID (deploystack user in production)
    const uid = process.getuid ? process.getuid() : 1000;
    const gid = process.getgid ? process.getgid() : 1000;

    // Resolve command to full path (nsjail requires full paths)
    const fullCommandPath = this.resolveCommandPath(config.command);
    
    this.logger.debug({
      operation: 'command_path_resolved',
      original_command: config.command,
      resolved_command: fullCommandPath
    }, `Resolved command path: ${config.command} -> ${fullCommandPath}`);

    // Build nsjail arguments based on working production configuration
    const nsjailArgs = [
      '-Mo',                                    // Mount mode: once, don't remount
      '--proc_rw',                              // CRITICAL: Required for Node.js pthread_create
      '--user', String(uid),                    // Use current user (deploystack)
      '--group', String(gid),                   // Use current group (deploystack)
      '--rlimit_as', String(nsjailConfig.memoryLimitMB), // Memory limit (MB) - 2048 minimum for V8
      '--rlimit_cpu', String(nsjailConfig.cpuTimeLimitSeconds), // CPU time limit (seconds)
      '--rlimit_nproc', String(nsjailConfig.maxProcesses), // Max processes - 1000 for npm
      '--rlimit_nofile', String(nsjailConfig.maxOpenFiles), // Max file descriptors
      '--rlimit_fsize', String(nsjailConfig.maxFileSizeMB), // Max file size (MB)
      '--time_limit', '0',                      // No wall-clock time limit
      '-R', '/usr',                             // Read-only mount: /usr
      '-R', '/lib',                             // Read-only mount: /lib
      '-R', '/lib64',                           // Read-only mount: /lib64
      '-R', '/bin',                             // Read-only mount: /bin
      '-R', '/sbin',                            // Read-only mount: /sbin
      '-R', '/etc',                             // Read-only mount: /etc (includes resolv.conf)
      '-T', `/tmp:size=${nsjailConfig.tmpfsSize}`, // Writable temp with size limit (100M)
      '-B', `${cacheDir}:/home/npx`,           // Team-specific cache directory mount
      '--bindmount', '/dev/null:/dev/null',    // Required for I/O redirection
      '--bindmount', '/dev/urandom:/dev/urandom', // Required for crypto operations
      '--bindmount', '/dev/zero:/dev/zero',    // Required for memory allocation
      '--symlink', '/proc/self/fd:/dev/fd',    // Required for file descriptor management
      '-E', 'HOME=/home/npx',                  // Set HOME for npx cache
      '-E', 'PATH=/usr/bin:/bin:/usr/local/bin', // Set PATH
      '-E', 'NPM_CONFIG_CACHE=/home/npx/.npm', // npm cache location
      '-E', 'NPM_CONFIG_PREFIX=/home/npx/.npm-global', // npm global prefix
      '-E', 'NPM_CONFIG_UPDATE_NOTIFIER=false', // Disable update notifier
      '-E', 'NO_UPDATE_NOTIFIER=1',            // Disable update notifier (alternative)
      // Inject user-provided environment variables
      ...Object.entries(config.env).flatMap(([key, value]) => ['-E', `${key}=${value}`]),
      '--disable_clone_newnet',                // Allow network access (required for npm downloads)
      '--disable_clone_newcgroup',             // Disable cgroup namespace (causes clone() errors on some kernels)
      '--disable_no_new_privs',                // May be needed for some packages
      '--hostname', `mcp-${config.team_id}`,   // Team-specific hostname
      '--',                                     // End of nsjail args
      fullCommandPath,                          // MCP server command with full path (e.g., /usr/bin/npx)
      ...config.args                            // MCP server arguments
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
