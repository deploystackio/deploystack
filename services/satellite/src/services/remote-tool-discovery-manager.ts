/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DynamicConfigManager, DynamicMcpServersConfig, ConfigurationChanges } from './dynamic-config-manager';
import { McpServerConfig } from './command-polling-service';
import type { EventBus } from './event-bus';
import { maskUrlForLogging } from '../utils/log-masker';
import { OAuthTokenService } from './oauth-token-service';

/**
 * Cached tool information with namespacing
 */
export interface CachedTool {
  originalName: string;
  namespacedName: string; // e.g., "context7:resolve_library_id"
  description: string;
  inputSchema: any;
  serverName: string;
  serverSlug: string;     // Server slug for tool_path format (e.g., "brightdata-mcp-1")
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
  private oauthTokenService?: OAuthTokenService;

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
   * Set OAuth token service (for OAuth-enabled MCP servers)
   */
  setOAuthTokenService(oauthTokenService: OAuthTokenService): void {
    this.oauthTokenService = oauthTokenService;
    this.logger.debug({
      operation: 'tool_discovery_oauth_service_set'
    }, 'OAuth token service set for tool discovery');
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
        
        // Emit mcp.tools.discovered event with token counts
        try {
          const serverConfig = enabledServers[serverName];

          // Import token counter utilities at the top of this file
          const { estimateMcpServerTokens } = await import('../utils/token-counter');

          // Calculate token consumption using existing utility
          const mcpServer = {
            name: serverName,
            tools: serverTools.map(t => ({
              name: t.originalName,
              description: t.description,
              inputSchema: t.inputSchema || {}
            }))
          };

          const tokenEstimate = estimateMcpServerTokens(mcpServer);

          // Build enhanced event payload
          this.eventBus?.emit('mcp.tools.discovered', {
            installation_id: serverConfig.installation_id || serverName,
            installation_name: serverName,
            team_id: serverConfig.team_id || 'unknown',
            server_slug: serverConfig.server_slug || serverName,
            tool_count: serverTools.length,
            total_tokens: tokenEstimate.totalTokens,
            tools: serverTools.map((tool, index) => ({
              tool_name: tool.originalName,
              description: tool.description,
              input_schema: tool.inputSchema,
              token_count: tokenEstimate.tools[index]?.tokens || 0
            })),
            discovered_at: new Date().toISOString()
          });

          this.logger.info({
            operation: 'remote_tools_discovered_event_emitted',
            installation_name: serverName,
            tool_count: serverTools.length,
            total_tokens: tokenEstimate.totalTokens
          }, `Tool discovery event emitted to backend for ${serverName}`);
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

    // Phase 10: OAuth token injection for tool discovery
    let headers: Record<string, string> = {};

    if (config.requires_oauth && this.oauthTokenService) {
      if (!config.installation_id || !config.user_id || !config.team_id) {
        throw new Error(
          `OAuth required but missing context for ${serverName}. ` +
          'Installation ID, User ID, and Team ID are required for tool discovery.'
        );
      }

      this.logger.info({
        operation: 'oauth_token_injection_tool_discovery',
        server_name: serverName,
        installation_id: config.installation_id,
        user_id: config.user_id,
        team_id: config.team_id
      }, 'MCP server requires OAuth for tool discovery - fetching tokens');

      try {
        // Check token status first
        const tokenStatus = await this.oauthTokenService.checkTokenStatus(
          config.installation_id,
          config.user_id,
          config.team_id
        );

        if (!tokenStatus.exists) {
          throw new Error(
            `OAuth authorization required for ${serverName}. ` +
            'Please visit the dashboard to authorize this MCP server.'
          );
        }

        if (tokenStatus.expired) {
          this.logger.warn({
            operation: 'oauth_token_expired_tool_discovery',
            server_name: serverName,
            expires_at: tokenStatus.expires_at
          }, 'OAuth token is expired - attempting tool discovery anyway (backend may have refreshed)');
        }

        // Retrieve tokens
        const tokens = await this.oauthTokenService.getTokens(
          config.installation_id,
          config.user_id,
          config.team_id
        );

        if (!tokens) {
          throw new Error(`Failed to retrieve OAuth tokens for ${serverName}`);
        }

        // Inject OAuth token into Authorization header
        headers['Authorization'] = `Bearer ${tokens.access_token}`;

        this.logger.info({
          operation: 'oauth_token_injected_tool_discovery',
          server_name: serverName,
          expires_at: tokens.expires_at,
          has_refresh_token: !!tokens.refresh_token
        }, 'OAuth token injected for tool discovery');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'oauth_token_injection_failed_tool_discovery',
          server_name: serverName,
          error: errorMessage
        }, 'Failed to inject OAuth tokens for tool discovery');
        throw error;
      }
    }

    // Create transport for the remote server
    const transport = new StreamableHTTPClientTransport(new URL(finalUrl));

    // WORKAROUND: Patch global fetch temporarily to inject OAuth headers
    // The MCP SDK doesn't currently support custom headers in StreamableHTTPClientTransport
    let originalGlobalFetch: typeof fetch | null = null;
    if (Object.keys(headers).length > 0) {
      originalGlobalFetch = global.fetch;
      global.fetch = async (input: any, init?: any) => {
        // Properly merge headers (handle both Headers object and plain object)
        const mergedHeaders: Record<string, string> = {};

        // Copy existing headers
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((value: string, key: string) => {
              mergedHeaders[key] = value;
            });
          } else {
            Object.assign(mergedHeaders, init.headers);
          }
        }

        // Add OAuth headers (don't overwrite existing)
        Object.assign(mergedHeaders, headers);

        const modifiedInit = {
          ...init,
          headers: mergedHeaders
        };

        return originalGlobalFetch!(input, modifiedInit);
      };

      this.logger.debug({
        operation: 'oauth_headers_patched_global_fetch',
        server_name: serverName,
        headers_to_inject: Object.keys(headers)
      }, 'Patched global fetch to inject OAuth headers for tool discovery');
    }

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
      // Use server_slug from config for friendly namespacing, fallback to server_name
      const serverSlug = config.server_slug || config.server_name || serverName;

      const cachedTools: CachedTool[] = response.tools.map((tool: any) => {
        return {
          originalName: tool.name,
          namespacedName: `${serverSlug}:${tool.name}`,
          description: `[${serverSlug}] ${tool.description || 'No description'}`,
          inputSchema: tool.inputSchema || {},
          serverName: serverName, // Keep original serverName for routing
          serverSlug: serverSlug, // Store slug for tool_path format
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
      // Restore global fetch if it was patched
      if (originalGlobalFetch) {
        global.fetch = originalGlobalFetch;
      }

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

    // Check if any unchanged servers require OAuth (need re-discovery for token updates)
    const oauthUnchangedServers = configChanges.unchangedServers.filter(serverName => {
      const serverConfig = config.servers[serverName];
      return serverConfig?.requires_oauth === true;
    });

    if (oauthUnchangedServers.length > 0) {
      this.logger.debug({
        operation: 'tool_discovery_oauth_rediscovery',
        oauth_servers: oauthUnchangedServers,
        oauth_server_count: oauthUnchangedServers.length
      }, `Forcing re-discovery for ${oauthUnchangedServers.length} OAuth servers (tokens may have been updated)`);
    }

    // If no changes and no OAuth servers need re-discovery, skip all processing
    if (!configChanges.hasChanges && oauthUnchangedServers.length === 0) {
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

    // Discover tools for new, modified, and OAuth unchanged servers
    // OAuth servers need re-discovery even when config unchanged (for token updates)
    const serversToDiscover = [
      ...configChanges.addedServers,
      ...configChanges.modifiedServers,
      ...oauthUnchangedServers
    ];
    
    if (serversToDiscover.length > 0) {
      this.logger.debug({
        operation: 'tool_discovery_partial_discovery',
        servers_to_discover: serversToDiscover,
        added_count: configChanges.addedServers.length,
        modified_count: configChanges.modifiedServers.length,
        oauth_unchanged_count: oauthUnchangedServers.length
      }, `Discovering tools for ${serversToDiscover.length} servers (${configChanges.addedServers.length} new, ${configChanges.modifiedServers.length} modified, ${oauthUnchangedServers.length} OAuth re-discovery)`);

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

            // Import token counter utilities
            const { estimateMcpServerTokens } = await import('../utils/token-counter');

            // Calculate token consumption
            const mcpServer = {
              name: serverName,
              tools: serverTools.map(t => ({
                name: t.originalName,
                description: t.description,
                inputSchema: t.inputSchema || {}
              }))
            };

            const tokenEstimate = estimateMcpServerTokens(mcpServer);

            if (isNew) {
              this.eventBus?.emit('mcp.tools.discovered', {
                installation_id: serverConfig.installation_id || serverName,
                installation_name: serverName,
                team_id: serverConfig.team_id || 'unknown',
                server_slug: serverConfig.server_slug || serverName,
                tool_count: serverTools.length,
                total_tokens: tokenEstimate.totalTokens,
                tools: serverTools.map((tool, index) => ({
                  tool_name: tool.originalName,
                  description: tool.description,
                  input_schema: tool.inputSchema,
                  token_count: tokenEstimate.tools[index]?.tokens || 0
                })),
                discovered_at: new Date().toISOString()
              });

              this.logger.info({
                operation: 'remote_tools_discovered_event_emitted',
                installation_name: serverName,
                tool_count: serverTools.length,
                total_tokens: tokenEstimate.totalTokens
              }, `Tool discovery event emitted for new server: ${serverName}`);
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
