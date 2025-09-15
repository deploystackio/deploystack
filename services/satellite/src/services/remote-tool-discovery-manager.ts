/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { DynamicConfigManager, DynamicMcpServersConfig, ConfigurationChanges } from './dynamic-config-manager';
import { McpServerConfig } from './command-polling-service';

/**
 * Cached tool information with namespacing
 */
export interface CachedTool {
  originalName: string;
  namespacedName: string; // e.g., "context7-resolve_library_id"
  description: string;
  inputSchema: any;
  serverName: string;
  discoveredAt: Date;
}

/**
 * Server tool discovery state
 */
interface ServerToolState {
  serverName: string;
  tools: CachedTool[];
  lastDiscoveryAt: Date;
  discoveryHash: string;
}

/**
 * Remote Tool Discovery Manager
 * Discovers and caches tools from remote MCP servers at startup
 */
export class RemoteToolDiscoveryManager {
  private cachedTools: CachedTool[] = [];
  private serverToolStates: Map<string, ServerToolState> = new Map();
  private isInitialized: boolean = false;
  private logger: FastifyBaseLogger;
  private configManager?: DynamicConfigManager;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'RemoteToolDiscoveryManager' });
  }

  /**
   * Set dynamic configuration manager
   */
  setConfigManager(configManager: DynamicConfigManager): void {
    this.configManager = configManager;
    this.logger.debug({
      operation: 'tool_discovery_config_manager_set'
    }, 'Dynamic configuration manager set for tool discovery');
  }

  /**
   * Initialize tool discovery - called once at startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn({
        operation: 'tool_discovery_already_initialized'
      }, 'Tool discovery manager already initialized');
      return;
    }

    this.logger.info({
      operation: 'tool_discovery_init_start'
    }, 'Starting remote tool discovery...');

    if (!this.configManager) {
      this.logger.warn({
        operation: 'tool_discovery_no_config_manager'
      }, 'No configuration manager set, skipping tool discovery');
      this.isInitialized = true;
      return;
    }

    const enabledServers = this.configManager.getEnabledMcpServers();
    const serverNames = Object.keys(enabledServers);

    this.logger.info({
      operation: 'tool_discovery_servers',
      server_count: serverNames.length,
      servers: serverNames
    }, `Discovering tools from ${serverNames.length} remote MCP servers`);

    // Discover tools from each enabled server
    const allDiscoveredTools: CachedTool[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const serverName of serverNames) {
      try {
        const serverConfig = enabledServers[serverName];
        const serverTools = await this.discoverServerTools(serverName);
        allDiscoveredTools.push(...serverTools);
        
        // Update server tool state for initial discovery
        this.updateServerToolState(serverName, serverTools, serverConfig);
        
        successCount++;

        this.logger.info({
          operation: 'server_discovery_success',
          server_name: serverName,
          tool_count: serverTools.length,
          tools: serverTools.map(t => t.originalName)
        }, `Discovered ${serverTools.length} tools from ${serverName}`);

      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error({
          operation: 'server_discovery_failed',
          server_name: serverName,
          error: errorMessage
        }, `Failed to discover tools from ${serverName}: ${errorMessage}`);
      }
    }

    // Store all discovered tools in cache
    this.cachedTools = allDiscoveredTools;
    this.isInitialized = true;

    this.logger.info({
      operation: 'tool_discovery_complete',
      total_tools: this.cachedTools.length,
      successful_servers: successCount,
      failed_servers: failureCount,
      tools_by_server: this.getToolCountByServer()
    }, `Tool discovery complete: ${this.cachedTools.length} tools from ${successCount}/${serverNames.length} servers`);
  }

  /**
   * Get cached tools - fast response from memory
   */
  getCachedTools(): CachedTool[] {
    if (!this.isInitialized) {
      this.logger.warn({
        operation: 'tools_requested_before_init'
      }, 'Tools requested before initialization - returning empty array');
      return [];
    }

    this.logger.debug({
      operation: 'cached_tools_retrieved',
      tool_count: this.cachedTools.length
    }, `Returning ${this.cachedTools.length} cached tools`);

    return [...this.cachedTools]; // Return copy to prevent external modification
  }

  /**
   * Get tool count by server for logging
   */
  private getToolCountByServer(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const tool of this.cachedTools) {
      counts[tool.serverName] = (counts[tool.serverName] || 0) + 1;
    }
    return counts;
  }

  /**
   * Discover tools from a specific remote MCP server
   */
  private async discoverServerTools(serverName: string): Promise<CachedTool[]> {
    if (!this.configManager) {
      throw new Error('Configuration manager not available');
    }

    const config = this.configManager.getMcpServerConfig(serverName);
    if (!config) {
      throw new Error(`Server configuration not found for: ${serverName}`);
    }

    this.logger.debug({
      operation: 'server_discovery_start',
      server_name: serverName,
      server_url: config.url
    }, `Starting tool discovery for ${serverName}`);

    // Prepare JSON-RPC request for tools/list
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: `discovery-${serverName}-${Date.now()}`,
      method: 'tools/list',
      params: {}
    };

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': 'DeployStack-Satellite/0.1.0',
      'X-Discovery-Request': 'true'
    };

    // Add custom headers from config
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        const processedValue = this.processHeaderValue(value);
        headers[key] = processedValue;
      }
    }

    const startTime = Date.now();

    try {
      // Validate URL for HTTP/SSE transport
      if (!config.url) {
        throw new Error(`MCP server '${serverName}' has no URL configured (required for tool discovery)`);
      }

      // Make HTTP request to remote MCP server
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(jsonRpcRequest),
        signal: AbortSignal.timeout(config.timeout || 30000)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle both JSON and SSE responses
      const contentType = response.headers.get('content-type') || '';
      let responseData: any;

      if (contentType.includes('text/event-stream')) {
        // Parse SSE response
        const sseText = await response.text();
        responseData = this.parseSSEResponse(sseText);
      } else {
        // Parse JSON response
        responseData = await response.json() as any;
      }

      // Check for JSON-RPC error
      if (responseData.error) {
        throw new Error(`JSON-RPC error: ${responseData.error.message} (code: ${responseData.error.code})`);
      }

      // Extract tools from response
      const tools = responseData.result?.tools || [];
      
      if (!Array.isArray(tools)) {
        throw new Error('Invalid response: tools is not an array');
      }

      // Convert to cached tools with namespacing using server_slug for friendly names
      const discoveredAt = new Date();
      const cachedTools: CachedTool[] = tools.map((tool: any) => {
        // Use server_slug from config for friendly namespacing, fallback to server_name
        const friendlyServerName = config.server_slug || config.server_name || serverName;
        
        return {
          originalName: tool.name,
          namespacedName: `${friendlyServerName}-${tool.name}`,
          description: `[${friendlyServerName}] ${tool.description || 'No description'}`,
          inputSchema: tool.inputSchema || {},
          serverName: serverName, // Keep original serverName for routing
          discoveredAt: discoveredAt
        };
      });

      this.logger.debug({
        operation: 'server_discovery_success',
        server_name: serverName,
        response_time_ms: responseTime,
        tool_count: cachedTools.length
      }, `Successfully discovered ${cachedTools.length} tools from ${serverName} in ${responseTime}ms`);

      return cachedTools;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'server_discovery_failed',
        server_name: serverName,
        server_url: config.url,
        response_time_ms: responseTime,
        error: errorMessage
      }, `Tool discovery failed for ${serverName} after ${responseTime}ms`);

      throw error;
    }
  }

  /**
   * Parse SSE response format
   */
  private parseSSEResponse(sseText: string): any {
    // Parse SSE format: "event: message\ndata: {...}\n\n"
    const lines = sseText.split('\n');
    let dataLine = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLine = line.substring(6); // Remove "data: " prefix
        break;
      }
    }
    
    if (!dataLine) {
      throw new Error('No data found in SSE response');
    }
    
    try {
      return JSON.parse(dataLine);
    } catch (error) {
      throw new Error(`Failed to parse SSE data as JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process header values with environment variable substitution
   */
  private processHeaderValue(value: string): string {
    // Replace ${VAR_NAME} with environment variable values
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = process.env[varName];
      if (!envValue) {
        this.logger.warn({
          operation: 'env_var_missing',
          variable_name: varName,
          original_value: value
        }, `Environment variable ${varName} not found, using placeholder`);
        return match; // Keep placeholder if env var not found
      }
      return envValue;
    });
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get discovery statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      total_tools: this.cachedTools.length,
      tools_by_server: this.getToolCountByServer(),
      servers_with_tools: Object.keys(this.getToolCountByServer()).length
    };
  }

  /**
   * Generate server configuration hash for change detection
   */
  private generateServerHash(config: McpServerConfig): string {
    const hashData = {
      url: config.url,
      transport_type: config.transport_type,
      headers: config.headers,
      timeout: config.timeout,
      enabled: config.enabled
    };
    
    const configString = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Update server tool state after discovery
   */
  private updateServerToolState(serverName: string, tools: CachedTool[], config: McpServerConfig): void {
    const discoveryHash = this.generateServerHash(config);
    const state: ServerToolState = {
      serverName,
      tools: [...tools],
      lastDiscoveryAt: new Date(),
      discoveryHash
    };
    
    this.serverToolStates.set(serverName, state);
    
    this.logger.debug({
      operation: 'server_tool_state_updated',
      server_name: serverName,
      tool_count: tools.length,
      discovery_hash: discoveryHash
    }, `Updated tool state for ${serverName}`);
  }

  /**
   * Smart differential configuration update - only discover tools for changed servers
   */
  async handleConfigurationUpdate(config: DynamicMcpServersConfig, changes?: ConfigurationChanges): Promise<void> {
    if (!this.configManager) {
      this.logger.warn({
        operation: 'tool_discovery_no_config_manager'
      }, 'No configuration manager available for differential update');
      return;
    }

    // If not initialized yet, perform full initialization instead of differential update
    if (!this.isInitialized) {
      this.logger.debug({
        operation: 'tool_discovery_first_time_init',
        server_count: Object.keys(config.servers).length
      }, 'Tool discovery not initialized - performing full initialization');
      await this.initialize();
      return;
    }

    // Use provided changes or calculate them if not provided (fallback for backward compatibility)
    const configChanges = changes || this.configManager.getConfigurationChanges(config);
    
    this.logger.debug({
      operation: 'tool_discovery_differential_update',
      server_count: Object.keys(config.servers).length,
      has_changes: configChanges.hasChanges,
      added_servers: configChanges.addedServers,
      removed_servers: configChanges.removedServers,
      modified_servers: configChanges.modifiedServers,
      unchanged_servers: configChanges.unchangedServers
    }, 'Processing differential tool discovery update');

    // If no changes, skip all processing
    if (!configChanges.hasChanges) {
      this.logger.debug({
        operation: 'tool_discovery_no_changes',
        server_count: Object.keys(config.servers).length
      }, 'No configuration changes detected - skipping tool discovery');
      return;
    }

    // Remove tools from removed servers
    if (configChanges.removedServers.length > 0) {
      this.logger.debug({
        operation: 'tool_discovery_cleanup_removed_servers',
        removed_servers: configChanges.removedServers
      }, `Cleaning up tools from ${configChanges.removedServers.length} removed servers`);

      // Remove from cached tools
      this.cachedTools = this.cachedTools.filter(tool => 
        !configChanges.removedServers.includes(tool.serverName)
      );

      // Remove from server states
      configChanges.removedServers.forEach(serverName => {
        this.serverToolStates.delete(serverName);
      });
    }

    // Discover tools for new servers
    const serversToDiscover = [...configChanges.addedServers, ...configChanges.modifiedServers];
    
    if (serversToDiscover.length > 0) {
      this.logger.debug({
        operation: 'tool_discovery_partial_discovery',
        servers_to_discover: serversToDiscover,
        added_count: configChanges.addedServers.length,
        modified_count: configChanges.modifiedServers.length
      }, `Discovering tools for ${serversToDiscover.length} servers (${configChanges.addedServers.length} new, ${configChanges.modifiedServers.length} modified)`);

      let successCount = 0;
      let failureCount = 0;

      for (const serverName of serversToDiscover) {
        try {
          const serverConfig = config.servers[serverName];
          if (!serverConfig || !serverConfig.enabled) {
            this.logger.debug({
              operation: 'server_discovery_skipped',
              server_name: serverName,
              reason: 'disabled_or_missing'
            }, `Skipping discovery for disabled/missing server: ${serverName}`);
            continue;
          }

          // Remove existing tools for this server
          this.cachedTools = this.cachedTools.filter(tool => tool.serverName !== serverName);

          // Discover new tools
          const serverTools = await this.discoverServerTools(serverName);
          
          // Add to cached tools
          this.cachedTools.push(...serverTools);
          
          // Update server tool state
          this.updateServerToolState(serverName, serverTools, serverConfig);
          
          successCount++;

          this.logger.debug({
            operation: 'server_discovery_success',
            server_name: serverName,
            tool_count: serverTools.length,
            tools: serverTools.map(t => t.originalName),
            discovery_type: configChanges.addedServers.includes(serverName) ? 'new' : 'modified'
          }, `Discovered ${serverTools.length} tools from ${serverName}`);

        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          this.logger.error({
            operation: 'server_discovery_failed',
            server_name: serverName,
            error: errorMessage
          }, `Failed to discover tools from ${serverName}: ${errorMessage}`);
        }
      }

      this.logger.debug({
        operation: 'tool_discovery_partial_complete',
        total_tools: this.cachedTools.length,
        successful_discoveries: successCount,
        failed_discoveries: failureCount,
        tools_by_server: this.getToolCountByServer()
      }, `Partial tool discovery complete: ${this.cachedTools.length} total tools, ${successCount}/${serversToDiscover.length} servers updated`);
    }

    // Log unchanged servers (no work needed)
    if (configChanges.unchangedServers.length > 0) {
      this.logger.debug({
        operation: 'tool_discovery_unchanged_servers',
        unchanged_servers: configChanges.unchangedServers,
        unchanged_count: configChanges.unchangedServers.length
      }, `${configChanges.unchangedServers.length} servers unchanged - preserving existing tools`);
    }

    this.logger.debug({
      operation: 'tool_discovery_differential_complete',
      total_tools: this.cachedTools.length,
      total_servers: Object.keys(config.servers).length,
      performance_summary: {
        servers_processed: serversToDiscover.length,
        servers_preserved: configChanges.unchangedServers.length,
        servers_removed: configChanges.removedServers.length
      }
    }, 'Differential tool discovery update completed successfully');
  }
}
