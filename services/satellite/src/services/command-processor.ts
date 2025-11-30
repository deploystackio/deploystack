import { FastifyBaseLogger } from 'fastify';
import { SatelliteCommand, CommandResult } from './command-polling-service';
import { DynamicConfigManager } from './dynamic-config-manager';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';
import { StdioToolDiscoveryManager } from './stdio-tool-discovery-manager';
import { UnifiedToolDiscoveryManager } from './unified-tool-discovery-manager';
import { MCPServerConfig } from '../process/types';
import { maskUrlForLogging } from '../utils/log-masker';

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
  private processes: Map<string, ProcessInfo> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onConfigurationUpdate?: (config: any) => Promise<void>;

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
      server_slug: (payload.server_slug as string) || (payload.installation_name as string),
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
   */
  private async handleHealthCheckCommand(command: SatelliteCommand): Promise<CommandResult> {
    this.logger.debug({
      operation: 'command_health_check',
      command_id: command.id
    }, 'Processing health check command');

    const healthResults: Array<{
      server_name: string;
      process_id: string;
      status: string;
      health_status: string;
      response_time_ms?: number;
      error?: string;
    }> = [];

    // Check health of all running processes
    for (const [processId, processInfo] of this.processes.entries()) {
      if (processInfo.status === 'running') {
        const healthResult = await this.checkServerHealth(processInfo);
        healthResults.push({
          server_name: processInfo.server_name,
          process_id: processId,
          status: processInfo.status,
          health_status: healthResult.health_status,
          response_time_ms: healthResult.response_time_ms,
          error: healthResult.error
        });

        // Update process health status
        processInfo.health_status = healthResult.health_status;
        this.processes.set(processId, processInfo);
      }
    }

    this.logger.info({
      operation: 'health_check_completed',
      command_id: command.id,
      servers_checked: healthResults.length,
      healthy_servers: healthResults.filter(r => r.health_status === 'healthy').length
    }, `Health check completed: ${healthResults.length} servers checked`);

    return {
      command_id: command.id,
      status: 'completed',
      result: {
        health_check_results: healthResults,
        total_servers: healthResults.length,
        healthy_servers: healthResults.filter(r => r.health_status === 'healthy').length
      }
    };
  }

  /**
   * Check health of a specific HTTP MCP server
   */
  private async checkServerHealth(processInfo: ProcessInfo): Promise<{
    health_status: 'healthy' | 'unhealthy' | 'unknown';
    response_time_ms?: number;
    error?: string;
  }> {
    const serverConfig = this.configManager.getMcpServerConfig(processInfo.server_name);
    if (!serverConfig) {
      return {
        health_status: 'unknown',
        error: 'Server configuration not found'
      };
    }

    const startTime = Date.now();

    try {
      // Validate URL for HTTP/SSE transport
      if (!serverConfig.url) {
        return {
          health_status: 'unknown',
          error: 'No URL configured for health check'
        };
      }

      // Perform a simple health check by sending a tools/list request
      const response = await fetch(serverConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...serverConfig.headers
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'health-check',
          method: 'tools/list',
          params: {}
        }),
        signal: AbortSignal.timeout(serverConfig.timeout || 10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          health_status: 'healthy',
          response_time_ms: responseTime
        };
      } else {
        return {
          health_status: 'unhealthy',
          response_time_ms: responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        health_status: 'unhealthy',
        response_time_ms: responseTime,
        error: errorMessage
      };
    }
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
