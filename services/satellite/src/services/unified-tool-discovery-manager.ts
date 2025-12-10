/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { DynamicConfigManager, DynamicMcpServersConfig, ConfigurationChanges } from './dynamic-config-manager';
import { RemoteToolDiscoveryManager } from './remote-tool-discovery-manager';
import { StdioToolDiscoveryManager } from './stdio-tool-discovery-manager';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';

/**
 * Server availability status for tool filtering (Phase 10)
 */
export type ServerAvailabilityStatus =
  | 'online'
  | 'offline'
  | 'error'
  | 'requires_reauth'
  | 'permanently_failed'
  | 'connecting'
  | 'discovering_tools';

/**
 * Server status tracking entry
 */
export interface ServerStatusEntry {
  status: ServerAvailabilityStatus;
  lastUpdated: Date;
  message?: string;
}

/**
 * Unified cached tool interface that merges both remote and stdio tool types
 */
export interface UnifiedCachedTool {
  serverName: string;           // Installation name (e.g., "filesystem-john-abc123")
  originalName: string;         // Tool name from server (e.g., "read_file")
  namespacedName: string;       // Namespaced name (e.g., "filesystem:read_file")
  description: string;          // Tool description
  inputSchema: any;            // JSON Schema for tool parameters
  transport: 'stdio' | 'http' | 'sse'; // Transport type for routing
  serverSlug: string;           // Server slug for tool_path format (e.g., "brightdata-mcp-1")
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

  /**
   * Tracks disabled tools per installation
   * Key: installation_id, Value: Set of disabled tool names
   */
  private disabledTools: Map<string, Set<string>> = new Map();

  /**
   * Tracks server availability status for tool filtering (Phase 10)
   * Key: serverSlug, Value: ServerStatusEntry
   */
  private serverStatus: Map<string, ServerStatusEntry> = new Map();

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

    // Phase 10: Wire up status callbacks from discovery managers
    this.remoteToolManager.setStatusCallback((serverSlug, status, message) => {
      this.setServerStatus(serverSlug, status, message);
    });
    this.stdioToolManager.setStatusCallback((serverSlug, status, message) => {
      this.setServerStatus(serverSlug, status, message);
    });
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
   * Filters out tools from unavailable servers (Phase 10)
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
        serverSlug: tool.serverSlug,
        discoveredAt: tool.discoveredAt
      })),

      // Map stdio tools
      ...stdioTools.map(tool => ({
        serverName: tool.serverName,
        originalName: tool.originalName,
        namespacedName: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        transport: 'stdio' as const,
        serverSlug: tool.serverSlug
      }))
    ];

    // Filter out tools from unavailable servers (Phase 10)
    return unifiedTools.filter(tool => {
      const status = this.serverStatus.get(tool.serverSlug);
      // If no status recorded, assume available (unknown = available)
      if (!status) return true;
      // Only include tools from 'online' servers
      return status.status === 'online';
    });
  }

  /**
   * Get all cached tools WITHOUT status filtering (for debug/internal use)
   */
  getAllToolsUnfiltered(): UnifiedCachedTool[] {
    const remoteTools = this.remoteToolManager.getCachedTools();
    const stdioTools = this.stdioToolManager.getAllTools();

    return [
      ...remoteTools.map(tool => ({
        serverName: tool.serverName,
        originalName: tool.originalName,
        namespacedName: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        transport: 'http' as const,
        serverSlug: tool.serverSlug,
        discoveredAt: tool.discoveredAt
      })),
      ...stdioTools.map(tool => ({
        serverName: tool.serverName,
        originalName: tool.originalName,
        namespacedName: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        transport: 'stdio' as const,
        serverSlug: tool.serverSlug
      }))
    ];
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
        transport: 'stdio',
        serverSlug: stdioTool.serverSlug
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
        serverSlug: remoteTool.serverSlug,
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

  // =========================================================================
  // DISABLED TOOLS MANAGEMENT
  // =========================================================================

  /**
   * Mark a tool as disabled or enabled for an installation
   */
  setToolDisabled(installationId: string, toolName: string, disabled: boolean): void {
    if (!this.disabledTools.has(installationId)) {
      this.disabledTools.set(installationId, new Set());
    }

    const tools = this.disabledTools.get(installationId)!;
    if (disabled) {
      tools.add(toolName);
      this.logger.info({
        operation: 'tool_disabled',
        installation_id: installationId,
        tool_name: toolName
      }, `Tool disabled: ${toolName}`);
    } else {
      tools.delete(toolName);
      this.logger.info({
        operation: 'tool_enabled',
        installation_id: installationId,
        tool_name: toolName
      }, `Tool enabled: ${toolName}`);
    }
  }

  /**
   * Check if a tool is disabled for an installation
   */
  isToolDisabled(installationId: string, toolName: string): boolean {
    const tools = this.disabledTools.get(installationId);
    return tools?.has(toolName) ?? false;
  }

  /**
   * Get all disabled tools for an installation
   */
  getDisabledTools(installationId: string): string[] {
    const tools = this.disabledTools.get(installationId);
    return tools ? Array.from(tools) : [];
  }

  /**
   * Clear all disabled tools for an installation (used when installation is removed)
   */
  clearDisabledTools(installationId: string): void {
    if (this.disabledTools.has(installationId)) {
      const toolCount = this.disabledTools.get(installationId)!.size;
      this.disabledTools.delete(installationId);
      this.logger.debug({
        operation: 'disabled_tools_cleared',
        installation_id: installationId,
        cleared_count: toolCount
      }, `Cleared disabled tools for installation: ${installationId}`);
    }
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

  // =========================================================================
  // SERVER STATUS TRACKING (Phase 10)
  // =========================================================================

  /**
   * Set server availability status (Phase 10)
   * Called by discovery managers when discovery succeeds or fails
   */
  setServerStatus(
    serverSlug: string,
    status: ServerAvailabilityStatus,
    message?: string
  ): void {
    const previousStatus = this.serverStatus.get(serverSlug);
    const statusChanged = !previousStatus || previousStatus.status !== status;

    this.serverStatus.set(serverSlug, {
      status,
      lastUpdated: new Date(),
      message
    });

    if (statusChanged) {
      this.logger.info({
        operation: 'server_status_changed',
        server_slug: serverSlug,
        previous_status: previousStatus?.status || 'unknown',
        new_status: status,
        message
      }, `Server ${serverSlug} status changed: ${previousStatus?.status || 'unknown'} -> ${status}`);
    } else {
      this.logger.debug({
        operation: 'server_status_updated',
        server_slug: serverSlug,
        status,
        message
      }, `Server ${serverSlug} status updated: ${status}`);
    }
  }

  /**
   * Get server availability status (Phase 10)
   */
  getServerStatus(serverSlug: string): ServerStatusEntry | undefined {
    return this.serverStatus.get(serverSlug);
  }

  /**
   * Get all server statuses (Phase 10)
   */
  getAllServerStatuses(): Map<string, ServerStatusEntry> {
    return new Map(this.serverStatus);
  }

  /**
   * Check if a server is available for tool execution (Phase 10)
   */
  isServerAvailable(serverSlug: string): boolean {
    const status = this.serverStatus.get(serverSlug);
    // If no status recorded, assume available (unknown = available)
    if (!status) return true;
    return status.status === 'online';
  }

  /**
   * Clear server status (used when server is removed)
   */
  clearServerStatus(serverSlug: string): void {
    if (this.serverStatus.has(serverSlug)) {
      this.serverStatus.delete(serverSlug);
      this.logger.debug({
        operation: 'server_status_cleared',
        server_slug: serverSlug
      }, `Cleared status for server: ${serverSlug}`);
    }
  }

  /**
   * Get server status statistics (Phase 10)
   */
  getServerStatusStats(): {
    total: number;
    online: number;
    offline: number;
    error: number;
    requires_reauth: number;
    other: number;
  } {
    const stats = {
      total: this.serverStatus.size,
      online: 0,
      offline: 0,
      error: 0,
      requires_reauth: 0,
      other: 0
    };

    for (const entry of this.serverStatus.values()) {
      switch (entry.status) {
        case 'online':
          stats.online++;
          break;
        case 'offline':
          stats.offline++;
          break;
        case 'error':
          stats.error++;
          break;
        case 'requires_reauth':
          stats.requires_reauth++;
          break;
        default:
          stats.other++;
      }
    }

    return stats;
  }
}
