/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { DynamicConfigManager, DynamicMcpServersConfig, ConfigurationChanges } from './dynamic-config-manager';
import { RemoteToolDiscoveryManager } from './remote-tool-discovery-manager';
import { StdioToolDiscoveryManager } from './stdio-tool-discovery-manager';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';

/**
 * Unified cached tool interface that merges both remote and stdio tool types
 */
export interface UnifiedCachedTool {
  serverName: string;           // Installation name (e.g., "filesystem-john-abc123")
  originalName: string;         // Tool name from server (e.g., "read_file")
  namespacedName: string;       // User-facing name (e.g., "filesystem-read_file")
  description: string;          // Tool description
  inputSchema: any;            // JSON Schema for tool parameters
  transport: 'stdio' | 'http' | 'sse'; // Transport type for routing
  discoveredAt?: Date;          // When the tool was discovered
}

/**
 * UnifiedToolDiscoveryManager
 * 
 * Coordinates tool discovery across both stdio subprocess servers and HTTP/SSE remote servers.
 * Routes discovery requests to the appropriate manager based on transport type.
 * Merges tool caches from both managers for unified tool access.
 */
export class UnifiedToolDiscoveryManager {
  private remoteToolManager: RemoteToolDiscoveryManager;
  private stdioToolManager: StdioToolDiscoveryManager;
  private logger: FastifyBaseLogger;
  private configManager?: DynamicConfigManager;
  private isInitialized: boolean = false;

  constructor(
    remoteToolManager: RemoteToolDiscoveryManager,
    stdioToolManager: StdioToolDiscoveryManager,
    processManager: ProcessManager,
    runtimeState: RuntimeState,
    logger: FastifyBaseLogger
  ) {
    this.remoteToolManager = remoteToolManager;
    this.stdioToolManager = stdioToolManager;
    this.logger = logger.child({ component: 'UnifiedToolDiscoveryManager' });
  }

  /**
   * Set dynamic configuration manager
   */
  setConfigManager(configManager: DynamicConfigManager): void {
    this.configManager = configManager;
    this.remoteToolManager.setConfigManager(configManager);
    
    this.logger.debug({
      operation: 'unified_tool_discovery_config_manager_set'
    }, 'Dynamic configuration manager set for unified tool discovery');
  }

  /**
   * Initialize tool discovery - discovers tools from all servers based on transport type
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn({
        operation: 'unified_tool_discovery_already_initialized'
      }, 'Unified tool discovery manager already initialized');
      return;
    }

    this.logger.info({
      operation: 'unified_tool_discovery_init_start'
    }, 'Starting unified tool discovery (stdio + remote HTTP/SSE)...');

    if (!this.configManager) {
      this.logger.warn({
        operation: 'unified_tool_discovery_no_config_manager'
      }, 'No configuration manager set, skipping tool discovery');
      this.isInitialized = true;
      return;
    }

    const enabledServers = this.configManager.getEnabledMcpServers();
    const serverNames = Object.keys(enabledServers);

    // Separate servers by transport type
    const httpServers: string[] = [];
    const stdioServers: string[] = [];
    
    for (const serverName of serverNames) {
      const config = enabledServers[serverName];
      const transportType = config.transport_type || config.type;
      
      if (transportType === 'stdio') {
        stdioServers.push(serverName);
      } else if (transportType === 'http' || transportType === 'sse') {
        httpServers.push(serverName);
      } else {
        this.logger.warn({
          operation: 'unified_tool_discovery_unknown_transport',
          server_name: serverName,
          transport_type: transportType
        }, `Unknown transport type for server ${serverName}: ${transportType}`);
      }
    }

    this.logger.info({
      operation: 'unified_tool_discovery_servers_categorized',
      total_servers: serverNames.length,
      http_servers: httpServers.length,
      stdio_servers: stdioServers.length,
      http_server_names: httpServers,
      stdio_server_names: stdioServers
    }, `Categorized ${serverNames.length} servers: ${httpServers.length} HTTP/SSE, ${stdioServers.length} stdio`);

    // Discover tools from HTTP/SSE remote servers
    if (httpServers.length > 0) {
      try {
        await this.remoteToolManager.initialize();
        
        this.logger.info({
          operation: 'unified_tool_discovery_remote_complete',
          http_servers: httpServers.length,
          tools_discovered: this.remoteToolManager.getCachedTools().length
        }, `Remote HTTP/SSE tool discovery complete: ${this.remoteToolManager.getCachedTools().length} tools from ${httpServers.length} servers`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'unified_tool_discovery_remote_failed',
          error: errorMessage
        }, `Remote HTTP/SSE tool discovery failed: ${errorMessage}`);
      }
    }

    // Note: stdio tool discovery happens after process spawn, not during initialization
    // The StdioToolDiscoveryManager will discover tools when processes are spawned
    if (stdioServers.length > 0) {
      this.logger.info({
        operation: 'unified_tool_discovery_stdio_deferred',
        stdio_servers: stdioServers.length,
        stdio_server_names: stdioServers
      }, `Stdio tool discovery will occur after process spawning: ${stdioServers.length} stdio servers pending`);
    }

    this.isInitialized = true;

    const totalTools = this.getAllTools().length;
    this.logger.info({
      operation: 'unified_tool_discovery_complete',
      total_tools: totalTools,
      http_tools: this.remoteToolManager.getCachedTools().length,
      stdio_tools: this.stdioToolManager.getAllTools().length,
      http_servers: httpServers.length,
      stdio_servers: stdioServers.length
    }, `Unified tool discovery complete: ${totalTools} total tools`);
  }

  /**
   * Get all cached tools (merged from both stdio and remote HTTP/SSE managers)
   */
  getAllTools(): UnifiedCachedTool[] {
    const remoteTools = this.remoteToolManager.getCachedTools();
    const stdioTools = this.stdioToolManager.getAllTools();

    const unifiedTools: UnifiedCachedTool[] = [
      // Map remote HTTP/SSE tools
      ...remoteTools.map(tool => ({
        serverName: tool.serverName,
        originalName: tool.originalName,
        namespacedName: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        transport: 'http' as const,
        discoveredAt: tool.discoveredAt
      })),
      
      // Map stdio tools
      ...stdioTools.map(tool => ({
        serverName: tool.serverName,
        originalName: tool.originalName,
        namespacedName: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        transport: 'stdio' as const
      }))
    ];

    return unifiedTools;
  }

  /**
   * Get tool by namespaced name (searches both stdio and remote caches)
   */
  getTool(namespacedName: string): UnifiedCachedTool | null {
    // Try stdio first
    const stdioTool = this.stdioToolManager.getTool(namespacedName);
    if (stdioTool) {
      return {
        ...stdioTool,
        transport: 'stdio'
      };
    }

    // Try remote HTTP/SSE
    const remoteTool = this.remoteToolManager.getCachedTools().find(t => t.namespacedName === namespacedName);
    if (remoteTool) {
      return {
        serverName: remoteTool.serverName,
        originalName: remoteTool.originalName,
        namespacedName: remoteTool.namespacedName,
        description: remoteTool.description,
        inputSchema: remoteTool.inputSchema,
        transport: 'http',
        discoveredAt: remoteTool.discoveredAt
      };
    }

    return null;
  }

  /**
   * Handle configuration updates - route to appropriate manager based on transport type
   */
  async handleConfigurationUpdate(config: DynamicMcpServersConfig, changes?: ConfigurationChanges): Promise<void> {
    if (!this.isInitialized) {
      this.logger.debug({
        operation: 'unified_tool_discovery_first_time_init',
        server_count: Object.keys(config.servers).length
      }, 'Unified tool discovery not initialized - performing full initialization');
      await this.initialize();
      return;
    }

    this.logger.debug({
      operation: 'unified_tool_discovery_config_update',
      server_count: Object.keys(config.servers).length,
      has_changes: changes?.hasChanges || false
    }, 'Processing configuration update for unified tool discovery');

    // Separate servers by transport type for targeted updates
    const httpServers: string[] = [];
    const stdioServers: string[] = [];
    
    for (const [serverName, serverConfig] of Object.entries(config.servers)) {
      const transportType = serverConfig.transport_type || serverConfig.type;
      
      if (transportType === 'stdio') {
        stdioServers.push(serverName);
      } else if (transportType === 'http' || transportType === 'sse') {
        httpServers.push(serverName);
      }
    }

    // Update remote HTTP/SSE tool discovery
    try {
      await this.remoteToolManager.handleConfigurationUpdate(config, changes);
      
      this.logger.debug({
        operation: 'unified_tool_discovery_remote_updated',
        http_servers: httpServers.length,
        tools_cached: this.remoteToolManager.getCachedTools().length
      }, `Remote HTTP/SSE tool discovery updated: ${this.remoteToolManager.getCachedTools().length} tools from ${httpServers.length} servers`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'unified_tool_discovery_remote_update_failed',
        error: errorMessage
      }, `Remote HTTP/SSE tool discovery update failed: ${errorMessage}`);
    }

    // Note: stdio tool discovery updates happen automatically via ProcessManager events
    // When processes are spawned/terminated, StdioToolDiscoveryManager handles it
    if (stdioServers.length > 0) {
      this.logger.debug({
        operation: 'unified_tool_discovery_stdio_managed_by_process_events',
        stdio_servers: stdioServers.length
      }, `Stdio tool updates managed by process lifecycle events: ${stdioServers.length} stdio servers`);
    }

    const totalTools = this.getAllTools().length;
    this.logger.debug({
      operation: 'unified_tool_discovery_update_complete',
      total_tools: totalTools,
      http_tools: this.remoteToolManager.getCachedTools().length,
      stdio_tools: this.stdioToolManager.getAllTools().length
    }, `Configuration update applied: ${totalTools} total tools available`);
  }

  /**
   * Trigger stdio tool discovery for a specific server (called after process spawn)
   */
  async discoverStdioTools(installationName: string): Promise<void> {
    try {
      this.logger.info({
        operation: 'unified_tool_discovery_stdio_trigger',
        installation_name: installationName
      }, `Triggering stdio tool discovery for: ${installationName}`);

      const tools = await this.stdioToolManager.discoverTools(installationName);

      this.logger.info({
        operation: 'unified_tool_discovery_stdio_success',
        installation_name: installationName,
        tools_discovered: tools.length,
        total_tools: this.getAllTools().length
      }, `Stdio tool discovery complete: ${tools.length} tools from ${installationName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'unified_tool_discovery_stdio_failed',
        installation_name: installationName,
        error: errorMessage
      }, `Stdio tool discovery failed for ${installationName}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get unified discovery statistics
   */
  getStats() {
    const remoteStats = this.remoteToolManager.getStats();
    const stdioStats = this.stdioToolManager.getStats();

    return {
      initialized: this.isInitialized,
      total_tools: this.getAllTools().length,
      remote_http_sse: {
        total_tools: remoteStats.total_tools,
        servers_with_tools: remoteStats.servers_with_tools,
        tools_by_server: remoteStats.tools_by_server
      },
      stdio: {
        total_tools: stdioStats.total_tools,
        total_servers: stdioStats.total_servers,
        tools_by_server: stdioStats.tools_by_server
      }
    };
  }
}
