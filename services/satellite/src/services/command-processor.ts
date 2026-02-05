import { FastifyBaseLogger } from 'fastify';
import { SatelliteCommand, CommandResult } from './command-polling-service';
import { DynamicConfigManager } from './dynamic-config-manager';
import { ProcessManager, RuntimeState, MCPServerConfig } from '../process';
import { StdioToolDiscoveryManager } from './stdio-tool-discovery-manager';
import { UnifiedToolDiscoveryManager } from './unified-tool-discovery-manager';
import { RemoteToolDiscoveryManager } from './remote-tool-discovery-manager';
import { maskUrlForLogging } from '../utils/log-masker';
import type { EventBus } from './event-bus';
import { RedeployHandler } from '../lib/redeploy-handler';
import { CredentialValidationHandler } from '../lib/credential-validation-handler';
import { RecoveryHandler } from '../lib/recovery-handler';
import { HealthCheckHandler } from '../lib/health-check-handler';

export interface ProcessInfo {
  id: string;
  server_name: string;
  status: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  performance_metrics?: {
    total_requests: number;
    avg_response_time_ms: number;
  };
}

export class CommandProcessor {
  private logger: FastifyBaseLogger;
  private configManager: DynamicConfigManager;
  private processManager: ProcessManager | null;
  private runtimeState: RuntimeState | null;
  private stdioDiscoveryManager: StdioToolDiscoveryManager | null;
  private unifiedToolDiscoveryManager: UnifiedToolDiscoveryManager | null = null;
  private remoteToolDiscoveryManager: RemoteToolDiscoveryManager | null = null;
  private eventBus: EventBus | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tokenIntrospectionService: any | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private oauthTokenService: any | null = null;
  private processes: Map<string, ProcessInfo> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onConfigurationUpdate?: (config: any) => Promise<void>;
  private backendStatusCallback?: (installationId: string, status: string, statusMessage?: string) => void;
  private redeployHandler: RedeployHandler;
  private credentialValidationHandler: CredentialValidationHandler;
  private recoveryHandler: RecoveryHandler;
  private healthCheckHandler: HealthCheckHandler;

  constructor(
    logger: FastifyBaseLogger,
    configManager: DynamicConfigManager,
    processManager?: ProcessManager,
    runtimeState?: RuntimeState,
    stdioDiscoveryManager?: StdioToolDiscoveryManager
  ) {
    this.logger = logger;
    this.configManager = configManager;
    this.processManager = processManager || null;
    this.runtimeState = runtimeState || null;
    this.stdioDiscoveryManager = stdioDiscoveryManager || null;
    this.redeployHandler = new RedeployHandler({
      logger: this.logger,
      configManager: this.configManager,
      processManager: this.processManager,
      stdioDiscoveryManager: this.stdioDiscoveryManager,
      remoteToolDiscoveryManager: this.remoteToolDiscoveryManager,
      onConfigurationUpdate: () => this.onConfigurationUpdate ? this.onConfigurationUpdate({}) : Promise.resolve()
    });
    this.credentialValidationHandler = new CredentialValidationHandler({
      logger: this.logger,
      configManager: this.configManager,
      eventBus: this.eventBus
    });
    this.recoveryHandler = new RecoveryHandler({
      logger: this.logger,
      configManager: this.configManager,
      remoteToolDiscoveryManager: this.remoteToolDiscoveryManager,
      eventBus: this.eventBus
    });
    this.healthCheckHandler = new HealthCheckHandler({
      logger: this.logger,
      configManager: this.configManager,
      getProcesses: () => this.processes,
      updateProcessHealth: (processId: string, healthStatus: 'healthy' | 'unhealthy' | 'unknown') => {
        const processInfo = this.processes.get(processId);
        if (processInfo) {
          processInfo.health_status = healthStatus;
          this.processes.set(processId, processInfo);
        }
      },
      handleCredentialValidation: (command: SatelliteCommand) => this.handleCredentialValidation(command)
    });
  }

  /**
   * Set callback for configuration updates
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setConfigurationUpdateHandler(handler: (config: any) => Promise<void>): void {
    this.onConfigurationUpdate = handler;
  }

  /**
   * Set unified tool discovery manager for disabled tools tracking
   */
  setUnifiedToolDiscoveryManager(manager: UnifiedToolDiscoveryManager): void {
    this.unifiedToolDiscoveryManager = manager;
  }

  /**
   * Set remote tool discovery manager for recovery handling
   */
  setRemoteToolDiscoveryManager(manager: RemoteToolDiscoveryManager): void {
    this.remoteToolDiscoveryManager = manager;
    // Update redeploy handler dependency
    this.redeployHandler = new RedeployHandler({
      logger: this.logger,
      configManager: this.configManager,
      processManager: this.processManager,
      stdioDiscoveryManager: this.stdioDiscoveryManager,
      remoteToolDiscoveryManager: manager,
      onConfigurationUpdate: () => this.onConfigurationUpdate ? this.onConfigurationUpdate({}) : Promise.resolve()
    });
    // Update recovery handler dependency
    this.recoveryHandler = new RecoveryHandler({
      logger: this.logger,
      configManager: this.configManager,
      remoteToolDiscoveryManager: manager,
      eventBus: this.eventBus
    });
  }

  /**
   * Set event bus for status event emission
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
    // Update credential validation handler dependency
    this.credentialValidationHandler = new CredentialValidationHandler({
      logger: this.logger,
      configManager: this.configManager,
      eventBus: eventBus
    });
    // Update recovery handler dependency
    this.recoveryHandler = new RecoveryHandler({
      logger: this.logger,
      configManager: this.configManager,
      remoteToolDiscoveryManager: this.remoteToolDiscoveryManager,
      eventBus: eventBus
    });
  }

  /**
   * Set token introspection service for cache invalidation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setTokenIntrospectionService(service: any): void {
    this.tokenIntrospectionService = service;
  }

  /**
   * Set OAuth token service for cache invalidation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setOAuthTokenService(service: any): void {
    this.oauthTokenService = service;
  }

  /**
   * Set callback for tracking backend status emissions
   */
  setBackendStatusCallback(callback: (installationId: string, status: string, statusMessage?: string) => void): void {
    this.backendStatusCallback = callback;
  }

  /**
   * Emit status change event to backend
   */
  private emitStatusChange(
    installationId: string,
    teamId: string,
    userId: string,
    status: 'provisioning' | 'command_received' | 'connecting' | 'discovering_tools' | 'syncing_tools' | 'online' | 'offline' | 'error' | 'requires_reauth' | 'permanently_failed',
    statusMessage?: string
  ): void {
    if (!this.eventBus) {
      this.logger.debug({
        operation: 'status_change_no_event_bus',
        installation_id: installationId,
        status
      }, 'EventBus not available, skipping status emission');
      return;
    }

    this.eventBus.emit('mcp.server.status_changed', {
      installation_id: installationId,
      team_id: teamId,
      user_id: userId,
      status,
      status_message: statusMessage,
      timestamp: new Date().toISOString()
    });

    // Track backend status emission
    if (this.backendStatusCallback) {
      this.backendStatusCallback(installationId, status, statusMessage);
    }

    this.logger.debug({
      operation: 'status_change_emitted',
      installation_id: installationId,
      team_id: teamId,
      status,
      status_message: statusMessage
    }, `Emitted status change: ${status}`);
  }

  /**
   * Resolve installation_id or server_name to actual server name
   */
  private resolveServerName(command: SatelliteCommand): string | null {
    // Try installation_id first (new format)
    if (command.payload.installation_id) {
      // Look for server config by installation_id
      const currentConfig = this.configManager.getCurrentConfiguration();
      for (const [serverName, config] of Object.entries(currentConfig.servers)) {
        if (config.installation_id === command.payload.installation_id) {
          this.logger.debug({
            operation: 'server_name_resolved',
            command_id: command.id,
            installation_id: command.payload.installation_id,
            resolved_server_name: serverName
          }, `Resolved installation_id to server name: ${serverName}`);
          return serverName;
        }
      }
      
      this.logger.warn({
        operation: 'server_name_resolution_failed',
        command_id: command.id,
        installation_id: command.payload.installation_id
      }, `Could not resolve installation_id to server name: ${command.payload.installation_id}`);
      return null;
    }
    
    // Fall back to server_name (backward compatibility)
    if (command.payload.server_name) {
      return command.payload.server_name;
    }
    
    return null;
  }

  /**
   * Process a command from the backend
   */
  async processCommand(command: SatelliteCommand): Promise<CommandResult> {
    const startTime = Date.now();
    
    this.logger.info({
      operation: 'command_process_start',
      command_id: command.id,
      command_type: command.command_type,
      priority: command.priority,
      correlation_id: command.correlation_id,
      installation_id: command.payload.installation_id,
      server_name: command.payload.server_name,
      event: command.payload.event
    }, `Processing command: ${command.command_type}`);

    try {
      let result: CommandResult;

      switch (command.command_type) {
        case 'configure':
          result = await this.handleConfigureCommand(command);
          break;
        case 'spawn':
          result = await this.handleSpawnCommand(command);
          break;
        case 'kill':
          result = await this.handleKillCommand(command);
          break;
        case 'restart':
          result = await this.handleRestartCommand(command);
          break;
        case 'health_check':
          result = await this.handleHealthCheckCommand(command);
          break;
        case 'invalidate_user_token_cache':
          result = await this.handleInvalidateUserTokenCacheCommand(command);
          break;
        default:
          throw new Error(`Unknown command type: ${command.command_type}`);
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.info({
        operation: 'command_process_success',
        command_id: command.id,
        command_type: command.command_type,
        status: result.status,
        processing_time_ms: processingTime
      }, `Command processed successfully: ${command.command_type} (${processingTime}ms)`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const processingTime = Date.now() - startTime;
      
      this.logger.error({
        operation: 'command_process_failed',
        command_id: command.id,
        command_type: command.command_type,
        error: errorMessage,
        processing_time_ms: processingTime
      }, `Command processing failed: ${errorMessage}`);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Handle configure command - update MCP server configuration or handle specific actions
   */
  private async handleConfigureCommand(command: SatelliteCommand): Promise<CommandResult> {
    const payload = command.payload;

    // Check if this is an update_tool_status action
    if (payload.action === 'update_tool_status') {
      return await this.handleUpdateToolStatus(command);
    }

    // Check if this is an mcp_recovery event from backend health check
    if (payload.event === 'mcp_recovery') {
      return await this.handleMcpRecovery(command);
    }

    // Check if this is an mcp_redeploy event (GitHub deployment redeploy)
    if (payload.event === 'mcp_redeploy') {
      return await this.handleMcpRedeploy(command);
    }

    // Default behavior: trigger configuration refresh
    this.logger.info({
      operation: 'command_configure',
      command_id: command.id
    }, 'Processing configure command - triggering config refresh');

    try {
      // Trigger configuration update from backend if handler is available
      if (this.onConfigurationUpdate) {
        this.logger.debug({
          operation: 'command_configure_trigger',
          command_id: command.id
        }, 'Triggering configuration update from backend');

        // This will fetch fresh config from backend and update all services
        await this.onConfigurationUpdate({});
      } else {
        this.logger.warn({
          operation: 'command_configure_no_handler',
          command_id: command.id
        }, 'No configuration update handler available');
      }

      const currentStats = this.configManager.getStats();

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          configuration_applied: true,
          total_servers: currentStats.total_servers,
          enabled_servers: currentStats.enabled_servers,
          startup_time_ms: 0 // Configuration updates are immediate for HTTP servers
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error({
        operation: 'command_configure_failed',
        command_id: command.id,
        error: errorMessage
      }, `Configure command failed: ${errorMessage}`);

      throw error; // Re-throw to be handled by main command processor
    }
  }

  /**
   * Handle update_tool_status action - enable/disable a specific tool
   */
  private async handleUpdateToolStatus(command: SatelliteCommand): Promise<CommandResult> {
    const payload = command.payload;
    const { installation_id, tool_name, is_disabled, team_id, server_slug } = payload;

    this.logger.info({
      operation: 'update_tool_status',
      command_id: command.id,
      installation_id,
      tool_name,
      is_disabled,
      team_id,
      server_slug
    }, `Processing update_tool_status: ${is_disabled ? 'disabling' : 'enabling'} tool ${tool_name}`);

    // Validate required fields
    if (!installation_id || !tool_name || typeof is_disabled !== 'boolean') {
      const errorMsg = 'Missing required fields: installation_id, tool_name, or is_disabled';
      this.logger.error({
        operation: 'update_tool_status_validation_failed',
        command_id: command.id,
        installation_id,
        tool_name,
        is_disabled
      }, errorMsg);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMsg
      };
    }

    // Check if UnifiedToolDiscoveryManager is available
    if (!this.unifiedToolDiscoveryManager) {
      const errorMsg = 'UnifiedToolDiscoveryManager not available - cannot update tool status';
      this.logger.error({
        operation: 'update_tool_status_no_manager',
        command_id: command.id
      }, errorMsg);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMsg
      };
    }

    try {
      // Update the tool status in the unified discovery manager
      this.unifiedToolDiscoveryManager.setToolDisabled(
        installation_id as string,
        tool_name as string,
        is_disabled as boolean
      );

      const action = is_disabled ? 'disabled' : 'enabled';
      this.logger.info({
        operation: 'update_tool_status_success',
        command_id: command.id,
        installation_id,
        tool_name,
        is_disabled,
        team_id,
        server_slug
      }, `Tool ${tool_name} ${action} successfully`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          tool_name,
          is_disabled,
          message: `Tool ${action} successfully`
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error({
        operation: 'update_tool_status_failed',
        command_id: command.id,
        installation_id,
        tool_name,
        error: errorMessage
      }, `Failed to update tool status: ${errorMessage}`);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Handle mcp_recovery event - trigger tool re-discovery for recovered HTTP/SSE server
   * Called when backend detects an HTTP MCP server has recovered via health check
   */
  private async handleMcpRecovery(command: SatelliteCommand): Promise<CommandResult> {
    return await this.recoveryHandler.handleRecovery(command);
  }

  /**
   * Handle mcp_redeploy event - force restart for GitHub deployment redeploy
   * Called when user clicks "Redeploy" button on GitHub-deployed MCP servers
   * Forces restart even if SHA/config is unchanged
   * Stops ALL user instances for the installation and downloads fresh code
   */
  private async handleMcpRedeploy(command: SatelliteCommand): Promise<CommandResult> {
    return await this.redeployHandler.handleRedeploy(command);
  }

  /**
   * Handle spawn command - dispatches to HTTP or stdio handler based on transport_type
   */
  private async handleSpawnCommand(command: SatelliteCommand): Promise<CommandResult> {
    // Check if this is a stdio transport server
    if (command.payload.transport_type === 'stdio') {
      return await this.handleSpawnStdioProcess(command);
    }

    // Otherwise handle as HTTP proxy
    this.logger.debug({
      operation: 'command_spawn',
      command_id: command.id,
      installation_id: command.payload.installation_id,
      server_name: command.payload.server_name
    }, 'Processing spawn command');

    const serverName = this.resolveServerName(command);
    if (!serverName) {
      throw new Error('Server name or installation_id is required for spawn command');
    }

    // Check if server configuration exists
    const serverConfig = this.configManager.getMcpServerConfig(serverName);
    if (!serverConfig) {
      throw new Error(`MCP server configuration not found: ${serverName}`);
    }

    if (!serverConfig.enabled) {
      throw new Error(`MCP server is disabled: ${serverName}`);
    }

    // For HTTP MCP servers, "spawning" means making the server available for proxy requests
    // We don't actually spawn a process, but we track the server as "running"
    const processId = `http-proxy-${serverName}-${Date.now()}`;
    
    const processInfo: ProcessInfo = {
      id: processId,
      server_name: serverName,
      status: 'running', // HTTP servers are immediately available
      health_status: 'unknown', // Will be determined by health checks
      performance_metrics: {
        total_requests: 0,
        avg_response_time_ms: 0
      }
    };

    this.processes.set(processId, processInfo);

    this.logger.info({
      operation: 'http_server_spawned',
      command_id: command.id,
      server_name: serverName,
      process_id: processId,
      server_url: maskUrlForLogging(serverConfig.url, serverConfig.secret_metadata?.query_params),
      installation_id: command.payload.installation_id
    }, `HTTP MCP server proxy ready: ${serverName}`);

    return {
      command_id: command.id,
      status: 'completed',
      result: {
        process_id: processId,
        server_type: 'http_proxy',
        server_url: maskUrlForLogging(serverConfig.url, serverConfig.secret_metadata?.query_params),
        startup_time_ms: 0 // HTTP proxies are immediately available
      }
    };
  }

  /**
   * Handle spawn command for stdio MCP servers
   */
  private async handleSpawnStdioProcess(command: SatelliteCommand): Promise<CommandResult> {
    if (!this.processManager || !this.runtimeState || !this.stdioDiscoveryManager) {
      throw new Error('stdio process management not available - dependencies not initialized');
    }

    const payload = command.payload;

    // Validate required fields
    if (!payload.installation_id || !payload.installation_name || !payload.team_id ||
        !payload.command || !payload.args) {
      throw new Error('Missing required fields in spawn command payload');
    }

    // Check if process already running
    const existing = this.runtimeState.getProcessByName(payload.installation_name as string);
    if (existing && existing.status === 'running') {
      this.logger.warn({
        operation: 'spawn_stdio_already_running',
        installation_name: payload.installation_name,
        team_id: payload.team_id,
        correlation_id: command.correlation_id
      }, 'stdio process already running, skipping spawn');
      return {
        command_id: command.id,
        status: 'completed',
        result: {
          message: 'Process already running',
          process_id: existing.id,
          server_type: 'stdio'
        }
      };
    }

    // Build MCP server config from command payload
    const config: MCPServerConfig = {
      installation_id: payload.installation_id as string,
      installation_name: payload.installation_name as string,
      team_id: payload.team_id as string,
      team_slug: (payload.team_slug as string) || 'unknown',
      server_slug: (payload.server_slug as string) || (payload.installation_name as string),
      user_id: payload.user_id as string,
      command: payload.command as string,
      args: payload.args as string[],
      env: (payload.env as Record<string, string>) || {}
    };

    this.logger.info({
      operation: 'spawn_stdio_start',
      installation_name: config.installation_name,
      team_id: config.team_id,
      command: config.command,
      args: config.args,
      correlation_id: command.correlation_id
    }, `Spawning stdio MCP server from Backend command`);

    // Emit "connecting" status at start
    this.emitStatusChange(
      config.installation_id,
      config.team_id,
      config.user_id || 'unknown',
      'connecting',
      'Connecting to MCP server process'
    );

    try {
      // Spawn process (includes MCP handshake)
      const processInfo = await this.processManager.spawnProcess(config);

      // Add to runtime state
      this.runtimeState.addProcess(
        processInfo,
        config.installation_id,
        config.installation_name,
        config.team_id
      );

      // Emit "discovering_tools" status
      this.emitStatusChange(
        config.installation_id,
        config.team_id,
        config.user_id || 'unknown',
        'discovering_tools',
        'Discovering available tools from MCP server'
      );

      // Discover tools
      try {
        await this.stdioDiscoveryManager.discoverTools(config.installation_name);
      } catch (error) {
        // Tool discovery failure is non-fatal
        this.logger.warn({
          operation: 'spawn_stdio_tool_discovery_failed',
          installation_name: config.installation_name,
          error: error instanceof Error ? error.message : String(error),
          correlation_id: command.correlation_id
        }, 'Tool discovery failed but process running');
      }

      // Emit "online" status on success
      this.emitStatusChange(
        config.installation_id,
        config.team_id,
        config.user_id || 'unknown',
        'online',
        'MCP server is online and ready'
      );

      this.logger.info({
        operation: 'spawn_stdio_success',
        installation_name: config.installation_name,
        team_id: config.team_id,
        pid: processInfo.process.pid,
        process_id: processInfo.id,
        correlation_id: command.correlation_id
      }, `stdio MCP server spawned successfully`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          process_id: processInfo.id,
          server_type: 'stdio',
          pid: processInfo.process.pid,
          startup_time_ms: Date.now() - processInfo.startTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit "error" status on failure
      this.emitStatusChange(
        config.installation_id,
        config.team_id,
        config.user_id || 'unknown',
        'error',
        `Failed to spawn MCP server: ${errorMessage}`
      );

      this.logger.error({
        operation: 'spawn_stdio_failed',
        installation_name: config.installation_name,
        team_id: config.team_id,
        error: errorMessage,
        correlation_id: command.correlation_id
      }, `Failed to spawn stdio MCP server`);

      throw error;
    }
  }

  /**
   * Handle kill command - stop an HTTP MCP server proxy or stdio process
   */
  private async handleKillCommand(command: SatelliteCommand): Promise<CommandResult> {
    this.logger.debug({
      operation: 'command_kill',
      command_id: command.id,
      installation_id: command.payload.installation_id,
      server_name: command.payload.server_name
    }, 'Processing kill command');

    const serverName = this.resolveServerName(command);
    if (!serverName) {
      throw new Error('Server name or installation_id is required for kill command');
    }

    // Find process by server name
    const processEntry = Array.from(this.processes.entries())
      .find(([, process]) => process.server_name === serverName);

    if (!processEntry) {
      throw new Error(`No running process found for server: ${serverName}`);
    }

    const [processId, processInfo] = processEntry;

    // Update process status
    processInfo.status = 'stopped';
    processInfo.health_status = 'unknown';
    this.processes.set(processId, processInfo);

    this.logger.info({
      operation: 'http_server_killed',
      command_id: command.id,
      server_name: serverName,
      process_id: processId,
      installation_id: command.payload.installation_id
    }, `HTTP MCP server proxy stopped: ${serverName}`);

    return {
      command_id: command.id,
      status: 'completed',
      result: {
        process_id: processId,
        server_name: serverName,
        shutdown_time_ms: 0 // HTTP proxies stop immediately
      }
    };
  }

  /**
   * Handle restart command - restart an HTTP MCP server proxy
   */
  private async handleRestartCommand(command: SatelliteCommand): Promise<CommandResult> {
    this.logger.debug({
      operation: 'command_restart',
      command_id: command.id,
      installation_id: command.payload.installation_id,
      server_name: command.payload.server_name
    }, 'Processing restart command');

    const serverName = this.resolveServerName(command);
    if (!serverName) {
      throw new Error('Server name or installation_id is required for restart command');
    }

    // For HTTP servers, restart means refreshing the configuration and resetting metrics
    const serverConfig = this.configManager.getMcpServerConfig(serverName);
    if (!serverConfig) {
      throw new Error(`MCP server configuration not found: ${serverName}`);
    }

    // Find existing process
    const processEntry = Array.from(this.processes.entries())
      .find(([, process]) => process.server_name === serverName);

    let processId: string;
    
    if (processEntry) {
      // Update existing process
      processId = processEntry[0];
      const processInfo = processEntry[1];
      processInfo.status = 'running';
      processInfo.health_status = 'unknown';
      processInfo.performance_metrics = {
        total_requests: 0,
        avg_response_time_ms: 0
      };
      this.processes.set(processId, processInfo);
    } else {
      // Create new process
      processId = `http-proxy-${serverName}-${Date.now()}`;
      const processInfo: ProcessInfo = {
        id: processId,
        server_name: serverName,
        status: 'running',
        health_status: 'unknown',
        performance_metrics: {
          total_requests: 0,
          avg_response_time_ms: 0
        }
      };
      this.processes.set(processId, processInfo);
    }

    this.logger.info({
      operation: 'http_server_restarted',
      command_id: command.id,
      server_name: serverName,
      process_id: processId,
      server_url: maskUrlForLogging(serverConfig.url, serverConfig.secret_metadata?.query_params),
      installation_id: command.payload.installation_id
    }, `HTTP MCP server proxy restarted: ${serverName}`);

    return {
      command_id: command.id,
      status: 'completed',
      result: {
        process_id: processId,
        server_name: serverName,
        server_url: maskUrlForLogging(serverConfig.url, serverConfig.secret_metadata?.query_params),
        restart_time_ms: 0 // HTTP proxies restart immediately
      }
    };
  }

  /**
   * Handle health check command - check health of HTTP MCP servers
   * Supports two modes:
   * 1. General health check (default): Check all running processes
   * 2. Credential validation: Check specific installation's credentials via tools/list
   */
  private async handleHealthCheckCommand(command: SatelliteCommand): Promise<CommandResult> {
    return await this.healthCheckHandler.handleHealthCheck(command);
  }

  /**
   * Handle invalidate_user_token_cache command
   * Invalidates ONLY the specified user's cached tokens (preserves other users' caches)
   */
  private async handleInvalidateUserTokenCacheCommand(command: SatelliteCommand): Promise<CommandResult> {
    const payload = command.payload;
    const userId = payload.user_id as string;
    const userEmail = payload.user_email as string;

    if (!userId) {
      throw new Error('user_id is required for user token cache invalidation');
    }

    this.logger.info({
      operation: 'command_invalidate_user_token_cache',
      command_id: command.id,
      user_id: userId,
      user_email: userEmail
    }, `Invalidating cached tokens for SPECIFIC user: ${userEmail}`);

    try {
      let invalidatedCount = 0;

      // Invalidate TokenIntrospectionService cache (Bearer tokens)
      if (this.tokenIntrospectionService) {
        const count = this.tokenIntrospectionService.invalidateUserTokens(userId);
        invalidatedCount += count;
        this.logger.debug({
          operation: 'token_introspection_cache_invalidated',
          user_id: userId,
          count
        }, `Invalidated ${count} bearer token cache entries for user ${userId}`);
      }

      // Invalidate OAuthTokenService cache (MCP OAuth tokens)
      if (this.oauthTokenService) {
        const count = this.oauthTokenService.clearUserCache(userId);
        invalidatedCount += count;
        this.logger.debug({
          operation: 'oauth_token_cache_invalidated',
          user_id: userId,
          count
        }, `Invalidated ${count} OAuth token cache entries for user ${userId}`);
      }

      this.logger.info({
        operation: 'user_token_cache_invalidated',
        command_id: command.id,
        user_id: userId,
        user_email: userEmail,
        total_invalidated: invalidatedCount
      }, `Successfully invalidated ${invalidatedCount} cached tokens for user ${userEmail}`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          user_id: userId,
          user_email: userEmail,
          invalidated_count: invalidatedCount,
          message: `Invalidated ${invalidatedCount} cached tokens for user ${userEmail}`
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({
        operation: 'command_invalidate_user_token_cache_failed',
        command_id: command.id,
        user_id: userId,
        error: errorMessage
      }, `User token cache invalidation failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Handle credential validation for a specific installation 
   * Tries to call tools/list with the installation's credentials
   */
  private async handleCredentialValidation(command: SatelliteCommand): Promise<CommandResult> {
    return await this.credentialValidationHandler.handleValidation(command);
  }

  /**
   * Check health of a specific HTTP MCP server
   * @deprecated Use healthCheckHandler.checkServerHealth() instead
   */
  private async checkServerHealth(processInfo: ProcessInfo): Promise<{
    health_status: 'healthy' | 'unhealthy' | 'unknown';
    response_time_ms?: number;
    error?: string;
  }> {
    return await this.healthCheckHandler.checkServerHealth(processInfo);
  }

  /**
   * Get all current processes
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get process by ID
   */
  getProcess(processId: string): ProcessInfo | undefined {
    return this.processes.get(processId);
  }

  /**
   * Get processes by server name
   */
  getProcessesByServerName(serverName: string): ProcessInfo[] {
    return Array.from(this.processes.values())
      .filter(process => process.server_name === serverName);
  }

  /**
   * Update process performance metrics
   */
  updateProcessMetrics(processId: string, metrics: { total_requests: number; avg_response_time_ms: number }): void {
    const processInfo = this.processes.get(processId);
    if (processInfo) {
      processInfo.performance_metrics = metrics;
      this.processes.set(processId, processInfo);
    }
  }

  /**
   * Get command processor statistics
   */
  getStats(): {
    total_processes: number;
    running_processes: number;
    stopped_processes: number;
    healthy_processes: number;
    unhealthy_processes: number;
    processes_by_status: Record<string, number>;
  } {
    const allProcesses = Array.from(this.processes.values());
    const runningProcesses = allProcesses.filter(p => p.status === 'running');
    const stoppedProcesses = allProcesses.filter(p => p.status === 'stopped');
    const healthyProcesses = allProcesses.filter(p => p.health_status === 'healthy');
    const unhealthyProcesses = allProcesses.filter(p => p.health_status === 'unhealthy');

    const statusCounts: Record<string, number> = {};
    for (const process of allProcesses) {
      statusCounts[process.status] = (statusCounts[process.status] || 0) + 1;
    }

    return {
      total_processes: allProcesses.length,
      running_processes: runningProcesses.length,
      stopped_processes: stoppedProcesses.length,
      healthy_processes: healthyProcesses.length,
      unhealthy_processes: unhealthyProcesses.length,
      processes_by_status: statusCounts
    };
  }
}
