/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DynamicConfigManager, DynamicMcpServersConfig, ConfigurationChanges } from './dynamic-config-manager';
import { McpServerConfig } from './command-polling-service';
import type { EventBus } from './event-bus';
import { maskUrlForLogging } from '../utils/log-masker';

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
  private eventBus?: EventBus;

  constructor(logger: FastifyBaseLogger, eventBus?: EventBus) {
    this.logger = logger.child({ component: 'RemoteToolDiscoveryManager' });
    this.eventBus = eventBus;
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

    // Filter out stdio servers - they don't have URLs and are handled by StdioToolDiscoveryManager
    const httpServers = serverNames.filter(name => {
      const config = enabledServers[name];
      return config.transport_type !== 'stdio';
    });

    this.logger.info({
      operation: 'tool_discovery_servers',
      server_count: httpServers.length,
      total_servers: serverNames.length,
      stdio_servers_filtered: serverNames.length - httpServers.length,
      servers: httpServers
    }, `Discovering tools from ${httpServers.length} remote HTTP/SSE MCP servers (${serverNames.length - httpServers.length} stdio servers filtered out)`);

    // Discover tools from each enabled HTTP/SSE server (stdio servers filtered out)
    const allDiscoveredTools: CachedTool[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const serverName of httpServers) {
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
        
        // Emit mcp.tools.discovered event
        try {
          const serverConfig = enabledServers[serverName];
          this.eventBus?.emit('mcp.tools.discovered', {
            server_id: serverConfig.installation_id || serverName,
            server_slug: serverConfig.server_slug || serverName,
            team_id: serverConfig.team_id || 'unknown',
            tool_count: serverTools.length,
            tool_names: serverTools.map(t => t.originalName),
            discovery_duration_ms: 0, // Not tracked in initial discovery
            previous_tool_count: 0
          });
        } catch (error) {
          this.logger.warn({ error }, 'Failed to emit mcp.tools.discovered event (non-fatal)');
        }

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
      this.logger.debug({
        operation: 'tools_requested_before_init'
      }, 'Tools requested before initialization - returning empty array (normal during startup)');
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
   * Discover tools from a specific remote MCP server using official MCP SDK
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
      server_url: maskUrlForLogging(config.url, config.secret_metadata?.query_params),
      has_query_params: !!config.url_query_params,
      query_param_count: config.url_query_params ? Object.keys(config.url_query_params).length : 0
    }, `Starting tool discovery for ${serverName} using MCP SDK`);

    // Validate URL for HTTP/SSE transport
    if (!config.url) {
      throw new Error(`MCP server '${serverName}' has no URL configured (required for tool discovery)`);
    }

    const startTime = Date.now();

    // Create MCP client with official SDK
    const client = new Client({
      name: 'deploystack-satellite',
      version: '1.0.0'
    });

    // Build URL with query parameters
    const finalUrl = this.buildMcpServerUrl(config.url, config.url_query_params);

    // Create transport for the remote server
    const transport = new StreamableHTTPClientTransport(new URL(finalUrl));

    try {
      // Connect to remote MCP server
      await client.connect(transport);

      this.logger.debug({
        operation: 'mcp_client_connected',
        server_name: serverName,
        server_url: maskUrlForLogging(config.url, config.secret_metadata?.query_params)
      }, `Connected to MCP server: ${serverName}`);

      // List tools using official SDK
      const response = await client.listTools();
      const responseTime = Date.now() - startTime;

      this.logger.debug({
        operation: 'mcp_tools_listed',
        server_name: serverName,
        response_time_ms: responseTime,
        tool_count: response.tools.length
      }, `Listed ${response.tools.length} tools from ${serverName} via SDK`);

      // Convert to cached tools with namespacing using server_slug for friendly names
      const discoveredAt = new Date();
      const cachedTools: CachedTool[] = response.tools.map((tool: any) => {
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
        tool_count: cachedTools.length,
        sdk_used: true
      }, `Successfully discovered ${cachedTools.length} tools from ${serverName} using MCP SDK in ${responseTime}ms`);

      return cachedTools;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'server_discovery_failed',
        server_name: serverName,
        server_url: maskUrlForLogging(config.url, config.secret_metadata?.query_params),
        response_time_ms: responseTime,
        error: errorMessage,
        sdk_used: true
      }, `Tool discovery failed for ${serverName} after ${responseTime}ms using MCP SDK: ${errorMessage}`);

      throw error;
    } finally {
      // Always clean up the client connection
      try {
        await client.close();
        this.logger.debug({
          operation: 'mcp_client_closed',
          server_name: serverName
        }, `Closed MCP client connection for ${serverName}`);
      } catch (closeError) {
        this.logger.warn({
          operation: 'mcp_client_close_failed',
          server_name: serverName,
          error: closeError instanceof Error ? closeError.message : String(closeError)
        }, `Failed to close MCP client connection for ${serverName}`);
      }
    }
  }

  /**
   * Build MCP server URL with query parameters
   */
  private buildMcpServerUrl(baseUrl: string, queryParams?: Record<string, string>): string {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);

    // Append each query parameter
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
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
      url_query_params: config.url_query_params,
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

          // Skip stdio servers - they are handled by StdioToolDiscoveryManager
          if (serverConfig.transport_type === 'stdio') {
            this.logger.debug({
              operation: 'server_discovery_skipped',
              server_name: serverName,
              reason: 'stdio_transport',
              transport_type: serverConfig.transport_type
            }, `Skipping stdio server in remote discovery: ${serverName}`);
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
          
          // Emit mcp.tools.discovered or mcp.tools.updated event
          try {
            const serverConfig = config.servers[serverName];
            const isNew = configChanges.addedServers.includes(serverName);
            
            if (isNew) {
              this.eventBus?.emit('mcp.tools.discovered', {
                server_id: serverConfig.installation_id || serverName,
                server_slug: serverConfig.server_slug || serverName,
                team_id: serverConfig.team_id || 'unknown',
                tool_count: serverTools.length,
                tool_names: serverTools.map(t => t.originalName),
                discovery_duration_ms: 0,
                previous_tool_count: 0
              });
            } else {
              // For modified servers, calculate what changed
              const oldState = this.serverToolStates.get(serverName);
              const oldTools = oldState?.tools.map(t => t.originalName) || [];
              const newTools = serverTools.map(t => t.originalName);
              const addedTools = newTools.filter(t => !oldTools.includes(t));
              const removedTools = oldTools.filter(t => !newTools.includes(t));
              
              if (addedTools.length > 0 || removedTools.length > 0) {
                this.eventBus?.emit('mcp.tools.updated', {
                  server_id: serverConfig.installation_id || serverName,
                  server_slug: serverConfig.server_slug || serverName,
                  team_id: serverConfig.team_id || 'unknown',
                  added_tools: addedTools,
                  removed_tools: removedTools,
                  total_tools: serverTools.length
                });
              }
            }
          } catch (error) {
            this.logger.warn({ error }, 'Failed to emit tool discovery event (non-fatal)');
          }

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
