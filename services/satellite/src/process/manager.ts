import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'pino';
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
import { TmpfsManager } from '../lib/tmpfs-manager';
import { CacheManager } from '../lib/cache-manager';
import { MessageHandler } from '../lib/message-handler';
import { TerminationHandler } from '../lib/termination-handler';
import { LogRateLimiter, LogRateLimiterConfig } from './log-rate-limiter';

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
  private tmpfsManager: TmpfsManager;
  private cacheManager: CacheManager;
  private messageHandler: MessageHandler;
  private terminationHandler: TerminationHandler;

  // Log rate limiting
  private logRateLimiters = new Map<string, LogRateLimiter>();
  private readonly logRateLimiterConfig: LogRateLimiterConfig = {
    maxLogsPerSecond: parseInt(process.env.LOG_RATE_LIMIT_PER_SECOND || '20', 10),
    maxLineLengthBytes: parseInt(process.env.LOG_MAX_LINE_LENGTH_BYTES || '1024', 10),
    warningIntervalMs: parseInt(process.env.LOG_RATE_LIMIT_WARNING_INTERVAL_MS || '60000', 10)
  };

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
    this.tmpfsManager = new TmpfsManager(logger);
    this.cacheManager = new CacheManager(logger);
    this.messageHandler = new MessageHandler(logger);
    this.terminationHandler = new TerminationHandler(logger, this.tmpfsManager);

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
      const isGitHub = this.githubHandler.isGitHubDeployment(config);
      this.logger.trace({
        operation: 'github_deployment_check',
        installation_name: config.installation_name,
        source: config.source,
        command: config.command,
        is_github: isGitHub,
        has_backend_client: !!this.githubHandler['backendClient']
      }, `Checking if GitHub deployment: ${isGitHub}`);

      if (isGitHub) {
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

        // Get or create rate limiter for this process
        let rateLimiter = this.logRateLimiters.get(processInfo.id);
        if (!rateLimiter) {
          rateLimiter = new LogRateLimiter(
            config.installation_name,
            this.logRateLimiterConfig,
            this.logger,
            this.eventBus
          );
          this.logRateLimiters.set(processInfo.id, rateLimiter);
        }

        const currentTime = Date.now();

        // Buffer stderr output for mcp.server.logs event
        // Split by newlines in case there are multiple log lines
        const lines = stderrOutput.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Pre-filter nsjail INFO lines before rate limiting (infrastructure noise that
          // would be discarded anyway — don't waste rate limit slots on them)
          const nsjailPreCheck = parseNsjailLog(trimmedLine);
          if (nsjailPreCheck && nsjailPreCheck.level === 'I') {
            continue;
          }

          // Check rate limit (only for lines we'll actually buffer)
          const rateLimitResult = rateLimiter.shouldAcceptLog(trimmedLine, currentTime);
          if (!rateLimitResult.accept) {
            continue;
          }

          // Use truncated message if line was too long
          const finalMessage = rateLimitResult.truncated
            ? rateLimitResult.truncatedMessage!
            : trimmedLine;

          // Re-parse nsjail for WARNING/ERROR/FATAL (truncation may have changed finalMessage)
          const nsjailLog = parseNsjailLog(finalMessage);

          if (nsjailLog) {
            // nsjail WARNING/ERROR/FATAL - map to correct level
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
              level: inferMcpLogLevel(finalMessage),
              message: finalMessage,
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

      // Send exit notification to user-facing logs on non-zero exit (crash)
      if (code !== 0 && code !== null) {
        const exitMessage = signal
          ? `Server process terminated by signal ${signal} (exit code: ${code})`
          : `Server process exited with error (exit code: ${code})`;

        this.logBuffer.add({
          installation_id: config.installation_id,
          team_id: config.team_id,
          user_id: config.user_id,
          level: 'error',
          message: exitMessage,
          timestamp: new Date().toISOString()
        });

        // Flush immediately so crash logs reach the backend without waiting for 3s interval
        this.logBuffer.flush();
      }

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
   * Clear dormant config for a server (forces fresh spawn on next config refresh)
   * Used for redeploy to force fresh download from GitHub
   */
  clearDormantConfig(installationName: string): boolean {
    if (!this.runtimeState) {
      return false;
    }

    const cleared = this.runtimeState.clearDormantConfig(installationName);

    if (cleared) {
      this.logger.info({
        operation: 'dormant_config_cleared',
        installation_name: installationName
      }, `Cleared dormant config for ${installationName} - will force fresh download on respawn`);
    }

    return cleared;
  }

  /**
   * Remove a server completely (handles both active and dormant states, plus cache cleanup)
   * This is the method to call when a server is being uninstalled
   * Returns info about what was removed
   */
  async removeServerCompletely(
    installationName: string,
    timeout: number = 10000
  ): Promise<{ active: boolean; dormant: boolean; cachesCleaned?: string[] }> {
    this.logger.info({
      operation: 'remove_server_completely_start',
      installation_name: installationName
    }, `Removing server completely: ${installationName}`);

    const result = { active: false, dormant: false };
    const cachesCleaned: string[] = [];

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
    let dormantConfig: MCPServerConfig | null | undefined;
    if (this.runtimeState) {
      dormantConfig = this.runtimeState.getDormantConfig(installationName);
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

    // Clean up runtime cache if this was the last server using it
    // Use config from either active process or dormant config
    const config = processInfo?.config || dormantConfig;
    if (config) {
      const runtime = config.runtime || 'node';

      // Check if any other processes (active or dormant) still use this cache
      if (this.runtimeState?.hasProcessesUsingRuntimeCache(config.team_id, runtime)) {
        const activeCount = this.runtimeState.getTeamProcessesByRuntime(config.team_id, runtime).length;
        this.logger.debug({
          operation: 'skip_cache_cleanup_other_servers',
          installation_name: installationName,
          team_id: config.team_id,
          runtime: runtime,
          active_servers_count: activeCount
        }, `Skipping cache cleanup - ${activeCount} other ${runtime} server(s) still active for team`);
      } else {
        // No other servers using this cache - safe to clean
        this.logger.debug({
          operation: 'check_cache_cleanup',
          installation_name: installationName,
          team_id: config.team_id,
          runtime: runtime
        }, `Attempting ${runtime} cache cleanup for team`);

        const cleanupResult = await this.cacheManager.cleanupTeamRuntimeCache(config.team_id, runtime);
        if (cleanupResult.cleaned) {
          cachesCleaned.push(runtime);
        }
      }
    }

    this.logger.info({
      operation: 'remove_server_completely_success',
      installation_name: installationName,
      removed_active: result.active,
      removed_dormant: result.dormant,
      caches_cleaned: cachesCleaned
    }, `Server removed completely: ${installationName} (active: ${result.active}, dormant: ${result.dormant}, caches: ${cachesCleaned.join(', ') || 'none'})`);

    return { ...result, cachesCleaned };
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
    return this.messageHandler.sendMessage(processInfo, message, timeout);
  }

  /**
   * Terminate a process gracefully (SIGTERM → SIGKILL)
   */
  async terminateProcess(processInfo: ProcessInfo, timeout: number = 10000): Promise<void> {
    await this.terminationHandler.terminateProcess(
      processInfo,
      timeout,
      {
        onStateCleanup: (pi) => {
          this.processes.delete(pi.id);
          this.processIdsByName.delete(pi.config.installation_name);
          // Remove rate limiter for this process
          this.logRateLimiters.delete(pi.id);
        },
        onTerminated: (pi) => {
          this.emit('processTerminated', pi);
        }
      }
    );
  }

  /**
   * Terminate all processes
   */
  async terminateAllProcesses(): Promise<void> {
    const processes = Array.from(this.processes.values());
    await this.terminationHandler.terminateAllProcesses(
      processes,
      (pi, timeout) => this.terminateProcess(pi, timeout)
    );
  }
}
