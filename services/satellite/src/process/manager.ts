import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'pino';
import { rm } from 'fs/promises';
import { MCPServerConfig, ProcessInfo } from './types';
import type { EventBus } from '../services/event-bus';
import type { RuntimeState } from './runtime-state';
import type { BackendClient } from '../services/backend-client';

// Import composed handlers
import { LogBuffer, parseNsjailLog, inferMcpLogLevel } from './log-buffer';
import { ProcessSpawner } from './nsjail-spawner';
import { GitHubDeploymentHandler } from './github-deployment';
import { RestartHandler } from './restart-handler';
import { DormantManager } from './dormant-manager';

/**
 * Process Manager for MCP server subprocesses
 * Handles spawning, communication, and lifecycle management of stdio-based MCP servers
 * Adapted from gateway for multi-tenant satellite architecture
 *
 * This class composes several specialized handlers:
 * - LogBuffer: Batches log entries for efficient emission
 * - ProcessSpawner: Handles direct/nsjail process spawning
 * - GitHubDeploymentHandler: Downloads and prepares GitHub repos
 * - RestartHandler: Manages crash detection and auto-restart
 * - DormantManager: Handles idle process termination and respawning
 */
export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInfo>();
  private processIdsByName = new Map<string, string>();
  private logger: Logger;
  private eventBus?: EventBus;
  private runtimeState?: RuntimeState;
  private backendClient?: BackendClient;

  // Composed handlers
  private logBuffer: LogBuffer;
  private spawner: ProcessSpawner;
  private githubHandler: GitHubDeploymentHandler;
  private restartHandler: RestartHandler;
  private dormantManager: DormantManager;

  constructor(logger: Logger, eventBus?: EventBus, runtimeState?: RuntimeState, backendClient?: BackendClient) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.runtimeState = runtimeState;
    this.backendClient = backendClient;

    // Initialize composed handlers
    this.logBuffer = new LogBuffer(eventBus, logger);
    this.spawner = new ProcessSpawner(logger);
    this.githubHandler = new GitHubDeploymentHandler(logger, this.logBuffer, backendClient);
    this.restartHandler = new RestartHandler(logger, eventBus);
    this.dormantManager = new DormantManager(logger, runtimeState, eventBus);

    // Listen for process exits to detect crashes and attempt restart
    this.on('processExit', (processInfo, code, signal) => {
      this.handleProcessExit(processInfo, code, signal);
    });
  }

  /**
   * Set callback for tracking backend status emissions
   */
  setBackendStatusCallback(callback: (installationId: string, status: string, statusMessage?: string) => void): void {
    this.restartHandler.setBackendStatusCallback(callback);
  }

  /**
   * Set the EventBus reference for this manager and all composed handlers
   * Called after backend registration when EventBus becomes available
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
    this.logBuffer.setEventBus(eventBus);
    this.restartHandler.setEventBus(eventBus);
    this.dormantManager.setEventBus(eventBus);
  }

  /**
   * Handle process exit - delegates to RestartHandler
   */
  private async handleProcessExit(
    processInfo: ProcessInfo,
    code: number | null,
    signal: NodeJS.Signals | null
  ): Promise<void> {
    await this.restartHandler.handleProcessExit(
      processInfo,
      code,
      signal,
      // Spawn callback
      (config) => this.spawnProcess(config),
      // On restart limit exceeded
      (pi) => this.emit('restartLimitExceeded', pi),
      // On restarted
      (newProcess, oldProcess) => this.emit('processRestarted', newProcess, oldProcess),
      // On restart failed
      (pi, error) => this.emit('restartFailed', pi, error)
    );
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
      args: config.args,
      source: config.source
    }, `Spawning MCP server: ${config.installation_name}`);

    try {
      // Handle GitHub repository deployments
      if (this.githubHandler.isGitHubDeployment(config)) {
        config = await this.githubHandler.prepareDeployment(config);
      }

      // Spawn the process (direct or nsjail based on environment)
      const childProcess = await this.spawner.spawn(config);

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

      // Setup process handlers (inline - critical for correct behavior)
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

        // Emit user-visible startup confirmation log
        this.logBuffer.add({
          installation_id: config.installation_id,
          team_id: config.team_id,
          user_id: config.user_id,
          level: 'info',
          message: 'MCP Server started successfully',
          timestamp: new Date().toISOString()
        });

        // Emit mcp.server.started event
        const spawnDuration = Date.now() - processInfo.startTime;
        try {
          this.eventBus?.emit('mcp.server.started', {
            server_id: config.installation_id,
            server_slug: config.installation_name,
            team_id: config.team_id,
            user_id: config.user_id,
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
   * Setup process event handlers for stdout, stderr, exit, and error
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

        // Buffer stderr output for mcp.server.logs event
        // Split by newlines in case there are multiple log lines
        const lines = stderrOutput.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Check if this is an nsjail log
          const nsjailLog = parseNsjailLog(trimmedLine);

          if (nsjailLog) {
            // nsjail log detected - filter out INFO level (infrastructure noise)
            if (nsjailLog.level === 'I') {
              // Skip nsjail INFO logs (Mount, Uid map, Jail parameters, etc.)
              continue;
            }
            // Keep nsjail WARNING/ERROR/FATAL logs with correct level mapping
            const level: 'warn' | 'error' = nsjailLog.level === 'W' ? 'warn' : 'error';
            this.logBuffer.add({
              installation_id: config.installation_id,
              team_id: config.team_id,
              user_id: config.user_id,
              level,
              message: nsjailLog.message,
              timestamp: new Date().toISOString()
            });
          } else {
            // MCP server log - infer level from content
            this.logBuffer.add({
              installation_id: config.installation_id,
              team_id: config.team_id,
              user_id: config.user_id,
              level: inferMcpLogLevel(trimmedLine),
              message: trimmedLine,
              timestamp: new Date().toISOString()
            });
          }
        }
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
    return this.dormantManager.getAllDormantProcessNames();
  }

  /**
   * Remove a server completely (handles both active and dormant states)
   * This is the method to call when a server is being uninstalled
   * Returns info about what was removed
   */
  async removeServerCompletely(
    installationName: string,
    timeout: number = 10000
  ): Promise<{ active: boolean; dormant: boolean }> {
    this.logger.info({
      operation: 'remove_server_completely_start',
      installation_name: installationName
    }, `Removing server completely: ${installationName}`);

    const result = { active: false, dormant: false };

    // Check if active process exists and terminate it
    const processInfo = this.getProcessByName(installationName);
    if (processInfo) {
      this.logger.info({
        operation: 'remove_server_terminating_active',
        installation_name: installationName,
        process_id: processInfo.id,
        status: processInfo.status
      }, `Terminating active process: ${installationName}`);

      // Mark as intentional uninstall shutdown to skip crash detection
      processInfo.isUninstallShutdown = true;

      await this.terminateProcess(processInfo, timeout);
      result.active = true;
    }

    // Check if dormant config exists and remove it
    if (this.runtimeState) {
      const dormantConfig = this.runtimeState.getDormantConfig(installationName);
      if (dormantConfig) {
        this.logger.info({
          operation: 'remove_server_clearing_dormant',
          installation_name: installationName,
          team_id: dormantConfig.team_id
        }, `Clearing dormant config: ${installationName}`);

        this.runtimeState.removeDormantConfig(installationName);
        result.dormant = true;
      }
    }

    // Clean up restart attempts tracking
    this.restartHandler.clearRestartAttempts(installationName);

    this.logger.info({
      operation: 'remove_server_completely_success',
      installation_name: installationName,
      removed_active: result.active,
      removed_dormant: result.dormant
    }, `Server removed completely: ${installationName} (active: ${result.active}, dormant: ${result.dormant})`);

    return result;
  }

  /**
   * Get or respawn a process if it's dormant
   * This method checks active processes first, then dormant configs, and respawns if needed
   * Prevents concurrent respawn attempts for the same process
   */
  async getOrRespawnProcess(installationName: string): Promise<ProcessInfo> {
    const processInfo = await this.dormantManager.getOrRespawnProcess(
      installationName,
      (name) => this.getProcessByName(name),
      (config) => this.spawnProcess(config)
    );

    this.emit('processRespawned', processInfo);
    return processInfo;
  }

  /**
   * Terminate a process and mark it as dormant for later respawning
   */
  async terminateAndMarkDormant(installationName: string, timeout: number = 10000): Promise<void> {
    await this.dormantManager.terminateAndMarkDormant(
      installationName,
      (name) => this.getProcessByName(name),
      (processInfo, t) => this.terminateProcess(processInfo, t),
      timeout
    );
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

    // Cleanup temp directory if this was a GitHub deployment
    // ONLY delete on uninstall - preserve for dormant respawn, crash recovery, etc.
    if (processInfo.config.temp_dir && processInfo.isUninstallShutdown) {
      try {
        this.logger.debug({
          operation: 'temp_dir_cleanup_start',
          installation_name: processInfo.config.installation_name,
          temp_dir: processInfo.config.temp_dir
        }, `Cleaning up temp directory: ${processInfo.config.temp_dir}`);

        await rm(processInfo.config.temp_dir, { recursive: true, force: true });

        this.logger.debug({
          operation: 'temp_dir_cleanup_success',
          installation_name: processInfo.config.installation_name,
          temp_dir: processInfo.config.temp_dir
        }, 'Temp directory cleaned up successfully');
      } catch (error) {
        this.logger.warn({
          operation: 'temp_dir_cleanup_failed',
          installation_name: processInfo.config.installation_name,
          temp_dir: processInfo.config.temp_dir,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to cleanup temp directory (non-fatal)');
      }
    } else if (processInfo.config.temp_dir) {
      // Log that we're preserving the temp directory for potential restart/respawn
      this.logger.debug({
        operation: 'temp_dir_preserved',
        installation_name: processInfo.config.installation_name,
        temp_dir: processInfo.config.temp_dir,
        reason: processInfo.isDormantShutdown ? 'dormant_respawn' : 'potential_restart'
      }, `Preserving temp directory: ${processInfo.config.temp_dir}`);
    }

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
}
