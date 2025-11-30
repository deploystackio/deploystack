/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest
} from '@modelcontextprotocol/sdk/types.js';
import { FastifyBaseLogger, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { UnifiedToolDiscoveryManager } from '../services/unified-tool-discovery-manager';
import { ProcessManager } from '../process/manager';
import { ToolSearchService } from '../services/tool-search-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { OAuthTokenService } from '../services/oauth-token-service';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getVersionString } from '../config/version';

/**
 * MCP Server Wrapper
 * Wraps the official MCP SDK server with existing Fastify server and business logic
 */
export class McpServerWrapper {
  private logger: FastifyBaseLogger;
  private toolDiscoveryManager?: UnifiedToolDiscoveryManager;
  private processManager?: ProcessManager;
  private toolSearchService?: ToolSearchService;
  private dynamicConfigManager?: DynamicConfigManager;
  private oauthTokenService?: OAuthTokenService;
  private transports = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();
  private registeredTools = new Set<string>();

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'McpServerWrapper' });

    this.logger.info({
      operation: 'mcp_server_wrapper_created'
    }, 'MCP Server Wrapper created with official SDK');
  }

  /**
   * Set dependencies
   */
  setDependencies(
    toolDiscoveryManager: UnifiedToolDiscoveryManager,
    processManager: ProcessManager,
    toolSearchService: ToolSearchService,
    dynamicConfigManager: DynamicConfigManager
  ): void {
    this.toolDiscoveryManager = toolDiscoveryManager;
    this.processManager = processManager;
    this.toolSearchService = toolSearchService;
    this.dynamicConfigManager = dynamicConfigManager;

    this.logger.debug({
      operation: 'mcp_dependencies_set'
    }, 'MCP server dependencies set');
  }

  /**
   * Set OAuth token service (Phase 10)
   */
  setOAuthTokenService(oauthTokenService: OAuthTokenService): void {
    this.oauthTokenService = oauthTokenService;

    this.logger.debug({
      operation: 'oauth_token_service_set'
    }, 'OAuth token service set');
  }

  /**
   * Setup hierarchical MCP server with only 2 meta-tools
   */
  private setupMcpServer(server: Server): void {
    if (!this.toolDiscoveryManager || !this.toolSearchService) {
      return;
    }

    this.logger.debug({
      operation: 'mcp_server_setup_hierarchical',
      mode: 'hierarchical'
    }, 'Setting up hierarchical MCP server with 2 meta-tools');

    // Handle tools/list - return only 2 meta-tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug({
        operation: 'tools_list_request_hierarchical'
      }, 'Handling tools/list request (hierarchical mode)');

      const metaTools = [
        {
          name: 'discover_mcp_tools',
          description: 'Search for MCP tools using 1-3 keywords only. Examples: "markdown", "github create", "database query". Avoid long descriptions. Use tool name or main function as keywords. Returns tool paths for execute_mcp_tool.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Short search query with 1-3 keywords (e.g., "markdown", "github", "database postgres"). Avoid full sentences.'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
                default: 10
              }
            },
            required: ['query']
          }
        },
        {
          name: 'execute_mcp_tool',
          description: 'Execute a discovered MCP tool by its path. Use after discovering tools with discover_mcp_tools. The tool_path format is "serverName:toolName" (e.g., "figma:get_file", "github:create_issue").',
          inputSchema: {
            type: 'object',
            properties: {
              tool_path: {
                type: 'string',
                description: 'Full tool path from discover_mcp_tools (format: serverName:toolName, e.g., "github:create_issue")'
              },
              arguments: {
                type: 'object',
                description: 'Arguments to pass to the tool (schema varies by tool - check tool description from discovery)'
              }
            },
            required: ['tool_path', 'arguments']
          }
        }
      ];

      this.logger.info({
        operation: 'tools_list_response_hierarchical',
        tool_count: metaTools.length,
        actual_tools_available: this.toolDiscoveryManager!.getAllTools().length
      }, `Returning ${metaTools.length} meta-tools (${this.toolDiscoveryManager!.getAllTools().length} actual tools available via discovery)`);

      return { tools: metaTools };
    });

    // Handle tools/call - route to meta-tool handlers
    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const toolName = request.params?.name;
      const toolArgs = request.params?.arguments || {};

      this.logger.info({
        operation: 'tools_call_request_hierarchical',
        tool_name: toolName
      }, `Handling hierarchical tools/call for ${toolName}`);

      this.logger.debug({
        operation: 'tools_call_request_hierarchical_debug',
        tool_name: toolName,
        args: toolArgs
      }, `Hierarchical tools/call args for ${toolName}`);

      if (toolName === 'discover_mcp_tools') {
        return await this.handleDiscoverTools(toolArgs);
      } else if (toolName === 'execute_mcp_tool') {
        return await this.handleExecuteTool(toolArgs);
      } else {
        throw new Error(`Unknown meta-tool: ${toolName}. Available tools: discover_mcp_tools, execute_mcp_tool`);
      }
    });

    this.logger.info({
      operation: 'mcp_server_setup_complete_hierarchical',
      mode: 'hierarchical',
      meta_tools: 2,
      actual_tools_available: this.toolDiscoveryManager.getAllTools().length
    }, `Hierarchical MCP server setup complete with 2 meta-tools (${this.toolDiscoveryManager.getAllTools().length} tools available)`);
  }

  /**
   * Handle discover_mcp_tools meta-tool
   */
  private async handleDiscoverTools(args: any): Promise<any> {
    if (!this.toolSearchService) {
      throw new Error('Tool search service not available');
    }

    const query = args.query;
    const limit = args.limit || 10;

    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query parameter - must be a non-empty string');
    }

    this.logger.info({
      operation: 'discover_mcp_tools',
      query: query,
      limit: limit
    }, `Discovering tools with query: "${query}"`);

    const startTime = Date.now();
    const results = this.toolSearchService.search(query, limit);
    const searchTime = Date.now() - startTime;

    const response = {
      tools: results.map(result => ({
        tool_path: result.tool_path,
        description: result.description,
        server_name: result.server_name,
        transport: result.transport,
        relevance_score: result.score
      })),
      total_found: results.length,
      search_time_ms: searchTime,
      query: query
    };

    this.logger.info({
      operation: 'discover_mcp_tools_success',
      query: query,
      results_count: results.length,
      search_time_ms: searchTime
    }, `Discovery complete: found ${results.length} tools in ${searchTime}ms`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  /**
   * Handle execute_mcp_tool meta-tool
   */
  private async handleExecuteTool(args: any): Promise<any> {
    if (!this.toolDiscoveryManager) {
      throw new Error('Tool discovery manager not available');
    }

    const toolPath = args.tool_path;
    const toolArguments = args.arguments || {};

    if (!toolPath || typeof toolPath !== 'string') {
      throw new Error('Invalid tool_path parameter - must be a non-empty string in format "serverName:toolName"');
    }

    // Parse tool_path from "serverName:toolName" format to "serverName-toolName" (internal namespaced format)
    const colonIndex = toolPath.indexOf(':');
    if (colonIndex <= 0) {
      throw new Error(`Invalid tool_path format: ${toolPath}. Expected format: "serverName:toolName" (e.g., "github:create_issue")`);
    }

    const serverSlug = toolPath.substring(0, colonIndex);
    const toolName = toolPath.substring(colonIndex + 1);
    const namespacedToolName = `${serverSlug}-${toolName}`;

    this.logger.info({
      operation: 'execute_mcp_tool',
      tool_path: toolPath,
      namespaced_tool_name: namespacedToolName
    }, `Executing tool: ${toolPath} (internal: ${namespacedToolName})`);

    this.logger.debug({
      operation: 'execute_mcp_tool_debug',
      tool_path: toolPath,
      namespaced_tool_name: namespacedToolName,
      arguments: toolArguments
    }, `Tool arguments for ${toolPath}`);

    // Route to existing executeToolCall with namespaced format
    return await this.executeToolCall(namespacedToolName, toolArguments);
  }

  /**
   * Check for dormant stdio processes and respawn them before tool discovery
   */
  private async respawnDormantProcesses(): Promise<void> {
    if (!this.processManager) return;

    const dormantServers = this.processManager.getAllDormantProcessNames();
    if (dormantServers.length === 0) return;

    this.logger.info({
      operation: 'respawning_dormant_processes',
      dormant_count: dormantServers.length,
      dormant_servers: dormantServers
    }, `Found ${dormantServers.length} dormant stdio processes - respawning before tools/list`);

    const respawnPromises = dormantServers.map(async (serverName) => {
      try {
        const startTime = Date.now();
        const processInfo = await this.processManager!.getOrRespawnProcess(serverName);
        const duration = Date.now() - startTime;
        
        this.logger.info({
          operation: 'dormant_process_respawned_for_tools_list',
          server_name: serverName,
          respawn_duration_ms: duration,
          pid: processInfo.process.pid
        }, `Respawned dormant process for tools/list: ${serverName} (${duration}ms)`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'dormant_process_respawn_failed',
          server_name: serverName,
          error: errorMessage
        }, `Failed to respawn dormant process for tools/list: ${errorMessage}`);
      }
    });

    await Promise.all(respawnPromises);
    
    this.logger.info({
      operation: 'dormant_processes_respawned',
      respawned_count: dormantServers.length
    }, `Completed respawning ${dormantServers.length} dormant processes`);
  }

  /**
   * Execute tool call - route to appropriate MCP server
   */
  private async executeToolCall(namespacedToolName: string, toolArgs: any): Promise<any> {
    if (!this.toolDiscoveryManager) {
      throw new Error('Tool discovery manager not available');
    }

    this.logger.info({
      operation: 'mcp_tools_call',
      namespaced_tool_name: namespacedToolName
    }, `Calling namespaced tool: ${namespacedToolName}`);

    // Parse the server slug from the namespaced tool name
    const dashIndex = namespacedToolName.indexOf('-');
    if (dashIndex <= 0) {
      throw new Error(`Invalid tool name format: ${namespacedToolName}. Expected format: serverSlug-toolName`);
    }

    // Find the cached tool to get the original tool name and verify it exists
    const cachedTool = this.toolDiscoveryManager.getTool(namespacedToolName);
    
    if (!cachedTool) {
      const allTools = this.toolDiscoveryManager.getAllTools();
      throw new Error(`Tool not found: ${namespacedToolName}. Available tools: ${allTools.map(t => t.namespacedName).join(', ')}`);
    }

    const serverName = cachedTool.serverName;
    const originalToolName = cachedTool.originalName;
    const transport = cachedTool.transport;

    this.logger.info({
      operation: 'mcp_tools_call_routing',
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      transport: transport
    }, `Routing tool call to ${transport} server: ${serverName}, tool: ${originalToolName}`);

    // Create JSON-RPC request with original tool name
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: `tool-call-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: originalToolName,
        arguments: toolArgs || {}
      }
    };

    // Route based on transport type
    if (transport === 'stdio') {
      const result = await this.handleStdioToolCall(serverName, originalToolName, namespacedToolName, jsonRpcRequest);
      // MCP SDK expects content array format
      return {
        content: result.content || [{ type: 'text', text: JSON.stringify(result) }]
      };
    } else {
      const result = await this.handleHttpToolCall(serverName, originalToolName, namespacedToolName, jsonRpcRequest);
      // MCP SDK expects content array format
      return {
        content: result.content || [{ type: 'text', text: JSON.stringify(result) }]
      };
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
   * Handle tool call for stdio MCP servers via ProcessManager
   */
  private async handleStdioToolCall(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any
  ): Promise<any> {
    if (!this.processManager) {
      throw new Error('Process manager not available');
    }

    const startTime = Date.now();

    this.logger.debug({
      operation: 'mcp_stdio_tool_call',
      server_name: serverName,
      original_tool_name: originalToolName
    }, `Sending tool call to stdio process: ${serverName}`);

    // Get or respawn process if dormant
    const processInfo = await this.processManager.getOrRespawnProcess(serverName);

    if (processInfo.status !== 'running') {
      throw new Error(`stdio MCP server not running: ${serverName} (status: ${processInfo.status})`);
    }

    // Send JSON-RPC request via stdin and await response
    const response = await this.processManager.sendMessage(processInfo, jsonRpcRequest);
    
    const responseTime = Date.now() - startTime;

    if (response.error) {
      this.logger.error({
        operation: 'mcp_stdio_tool_call_error',
        server_name: serverName,
        original_tool_name: originalToolName,
        error: response.error.message
      }, `stdio tool call failed: ${response.error.message}`);
      
      throw new Error(`stdio MCP server error: ${response.error.message}`);
    }

    this.logger.info({
      operation: 'mcp_stdio_tool_call_success',
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      response_time_ms: responseTime
    }, `stdio tool call successful: ${namespacedToolName} -> ${serverName}.${originalToolName} (${responseTime}ms)`);

    return response.result || response;
  }

  /**
   * Handle tool call for HTTP/SSE MCP servers via SDK client
   */
  private async handleHttpToolCall(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any
  ): Promise<any> {
    if (!this.toolDiscoveryManager || !this.dynamicConfigManager) {
      throw new Error('Tool discovery manager or config manager not available');
    }

    const startTime = Date.now();

    this.logger.debug({
      operation: 'mcp_http_tool_call',
      server_name: serverName,
      original_tool_name: originalToolName
    }, `Sending tool call to HTTP server: ${serverName}`);

    const cachedTool = this.toolDiscoveryManager.getTool(namespacedToolName);
    if (!cachedTool) {
      throw new Error(`Tool not found in cache: ${namespacedToolName}`);
    }

    const config = this.dynamicConfigManager.getMcpServerConfig(serverName);
    if (!config || !config.url) {
      throw new Error(`No URL configured for HTTP server: ${serverName}`);
    }

    this.logger.info({
      operation: 'mcp_http_tool_call',
      server_name: serverName,
      original_tool_name: originalToolName,
      server_url: config.url,
      has_query_params: !!config.url_query_params,
      query_param_count: config.url_query_params ? Object.keys(config.url_query_params).length : 0,
      requires_oauth: config.requires_oauth
    }, `Sending tool call to HTTP server: ${serverName}`);

    // Phase 10: OAuth token injection for HTTP/SSE MCP servers
    let headers: Record<string, string> = {};

    if (config.requires_oauth && this.oauthTokenService) {
      if (!config.installation_id || !config.user_id || !config.team_id) {
        throw new Error(
          `OAuth required but missing context for ${serverName}. ` +
          'Installation ID, User ID, and Team ID are required.'
        );
      }

      this.logger.info({
        operation: 'oauth_token_injection_http',
        server_name: serverName,
        installation_id: config.installation_id,
        user_id: config.user_id,
        team_id: config.team_id
      }, 'HTTP server requires OAuth - fetching tokens');

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
            operation: 'oauth_token_expired',
            server_name: serverName,
            expires_at: tokenStatus.expires_at
          }, 'OAuth token is expired - attempting request anyway (backend may have refreshed)');
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
          operation: 'oauth_token_injected_http',
          server_name: serverName,
          expires_at: tokens.expires_at,
          has_refresh_token: !!tokens.refresh_token
        }, 'OAuth token injected into HTTP headers');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'oauth_token_injection_failed_http',
          server_name: serverName,
          error: errorMessage
        }, 'Failed to inject OAuth tokens for HTTP server');
        throw error;
      }
    }

    const client = new Client({
      name: 'deploystack-satellite',
      version: getVersionString()
    });

    // Build URL with query parameters
    const finalUrl = this.buildMcpServerUrl(config.url, config.url_query_params);

    // Create transport
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

        // Add OAuth headers (overwrite to ensure our token is used)
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
      }, 'Patched global fetch to inject OAuth headers for tool execution');
    }

    try {
      await client.connect(transport);

      this.logger.debug({
        operation: 'mcp_http_client_connected',
        server_name: serverName,
        server_url: config.url
      }, `Connected to HTTP MCP server: ${serverName}`);

      const response = await client.callTool({
        name: originalToolName,
        arguments: jsonRpcRequest.params.arguments
      });

      const responseTime = Date.now() - startTime;

      this.logger.info({
        operation: 'mcp_http_tool_call_success',
        server_name: serverName,
        original_tool_name: originalToolName,
        namespaced_tool_name: namespacedToolName,
        response_time_ms: responseTime
      }, `HTTP tool call successful: ${namespacedToolName} -> ${serverName}.${originalToolName} (${responseTime}ms)`);

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'mcp_http_tool_call_error',
        server_name: serverName,
        original_tool_name: originalToolName,
        error: errorMessage,
        response_time_ms: responseTime
      }, `HTTP tool call failed: ${errorMessage}`);

      // Phase 10: Handle OAuth 401 errors
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        this.logger.error({
          operation: 'oauth_token_invalid_or_expired',
          server_name: serverName,
          installation_id: config.installation_id
        }, 'MCP server returned 401 - OAuth token may be expired or invalid');

        // Clear cached token
        if (config.requires_oauth && config.installation_id && config.user_id && config.team_id && this.oauthTokenService) {
          this.oauthTokenService.clearCache(config.installation_id, config.user_id, config.team_id);
        }

        throw new Error(
          `OAuth token expired or invalid for ${serverName}. ` +
          'Please re-authorize this MCP server in the dashboard.'
        );
      }

      if (errorMessage.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to HTTP MCP server: ${serverName}`);
      }
      if (errorMessage.includes('ETIMEDOUT')) {
        throw new Error(`HTTP MCP server timeout: ${serverName}`);
      }

      throw new Error(`HTTP MCP server error: ${errorMessage}`);

    } finally {
      // Restore global fetch if we patched it
      if (originalGlobalFetch) {
        global.fetch = originalGlobalFetch;
        this.logger.debug({
          operation: 'oauth_headers_restored_global_fetch',
          server_name: serverName
        }, 'Restored global fetch after tool execution');
      }

      try {
        await client.close();
        this.logger.debug({
          operation: 'mcp_http_client_closed',
          server_name: serverName
        }, `Closed HTTP MCP client connection for ${serverName}`);
      } catch (closeError) {
        this.logger.warn({
          operation: 'mcp_http_client_close_failed',
          server_name: serverName,
          error: closeError instanceof Error ? closeError.message : String(closeError)
        }, `Failed to close HTTP client connection for ${serverName}`);
      }
    }
  }

  /**
   * Setup Fastify routes for MCP transport
   */
  setupRoutes(fastify: FastifyInstance): void {
    // Get authentication middleware from server instance
    const tokenIntrospectionService = (fastify as any).tokenIntrospectionService;
    const activityTracker = (fastify as any).activityTracker;

    // Handle POST requests for client-to-server communication
    fastify.post('/mcp', {
      preValidation: async (request: FastifyRequest, reply: FastifyReply) => {
        // Apply authentication middleware
        if (tokenIntrospectionService && activityTracker) {
          const { requireAuthentication } = await import('../middleware/auth-middleware');
          const authMiddleware = requireAuthentication(tokenIntrospectionService, activityTracker);
          await authMiddleware(request, reply);
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      const requestBody = request.body as any;
      const isInitRequest = isInitializeRequest(requestBody);

      // Debug logging to understand session handling
      this.logger.info({
        operation: 'mcp_request_received',
        session_id: sessionId,
        has_session_in_map: sessionId ? this.transports.has(sessionId) : false,
        is_initialize_request: isInitRequest,
        request_method: requestBody?.method || 'unknown',
        total_active_sessions: this.transports.size
      }, 'Processing MCP request');

      let transport: StreamableHTTPServerTransport;
      let server: Server;

      if (sessionId && this.transports.has(sessionId)) {
        // Reuse existing transport and server
        const session = this.transports.get(sessionId)!;
        transport = session.transport;
        server = session.server;
      } else if (isInitializeRequest(request.body)) {
        // New initialization request - create low-level Server (or recreate after restart)
        if (sessionId) {
          this.logger.info({
            operation: 'mcp_session_restart',
            old_session_id: sessionId,
            reason: 'stale_session'
          }, 'Recreating MCP session for stale session ID after satellite restart');
        }
        server = new Server(
          {
            name: 'deploystack-satellite',
            version: getVersionString()
          },
          {
            capabilities: {
              tools: {}  // Declare tools capability
            }
          }
        );

        // Check for dormant stdio processes and respawn them
        await this.respawnDormantProcesses();

        // Setup MCP server with hierarchical router (2 meta-tools)
        this.setupMcpServer(server);

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            this.transports.set(newSessionId, { transport, server });
            this.logger.debug({
              operation: 'mcp_session_created',
              session_id: newSessionId
            }, 'New MCP session created');
          },
          enableDnsRebindingProtection: false,
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            this.transports.delete(transport.sessionId);
            this.logger.debug({
              operation: 'mcp_session_closed',
              session_id: transport.sessionId
            }, 'MCP session closed and cleaned up');
          }
        };

        await server.connect(transport);
      } else if (sessionId) {
        // Stale session ID - auto-resurrect the session transparently
        this.logger.info({
          operation: 'mcp_session_resurrection',
          session_id: sessionId,
          request_method: requestBody?.method || 'unknown'
        }, 'Auto-resurrecting stale session after satellite restart');

        // Create new server and transport, but reuse the old session ID
        server = new Server(
          {
            name: 'deploystack-satellite',
            version: getVersionString()
          },
          {
            capabilities: {
              tools: {}
            }
          }
        );

        // Check for dormant stdio processes and respawn them
        await this.respawnDormantProcesses();

        // Setup MCP server with hierarchical router
        this.setupMcpServer(server);

        // Create transport with fixed session ID generator
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId, // Reuse the old session ID!
          onsessioninitialized: (restoredSessionId) => {
            this.transports.set(restoredSessionId, { transport, server });
            this.logger.info({
              operation: 'mcp_session_resurrected',
              session_id: restoredSessionId
            }, 'Session resurrected successfully - client can continue without reconnecting');
          },
          enableDnsRebindingProtection: false,
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            this.transports.delete(transport.sessionId);
            this.logger.debug({
              operation: 'mcp_session_closed',
              session_id: transport.sessionId
            }, 'MCP session closed and cleaned up');
          }
        };

        await server.connect(transport);

        // Bootstrap the transport by processing a synthetic initialize request
        // The transport only sets _initialized=true when it processes an initialize request
        const syntheticInitRequest = {
          jsonrpc: '2.0' as const,
          id: 0,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'resurrected-session',
              version: '1.0.0'
            }
          }
        };

        this.logger.debug({
          operation: 'mcp_bootstrap_transport',
          session_id: sessionId
        }, 'Bootstrapping transport with synthetic initialize request');

        // Create a minimal mock response that captures the initialize response
        let initializeResponseSent = false;
        const mockRes = {
          writeHead: (_status: number, _headers?: any) => {
            // Capture response but don't send to client
            return mockRes;
          },
          write: (_chunk: any) => {
            // Swallow the initialize response
            return true;
          },
          end: (_data?: any) => {
            initializeResponseSent = true;
            return mockRes;
          },
          setHeader: (_name: string, _value: string | string[]) => {
            return mockRes;
          },
          socket: request.raw.socket,
          statusCode: 200,
          statusMessage: 'OK',
          headersSent: false,
        };

        // Process the synthetic initialize request using the actual request with synthetic body
        await transport.handleRequest(request.raw as any, mockRes as any, syntheticInitRequest);

        if (!initializeResponseSent) {
          this.logger.warn({
            operation: 'mcp_bootstrap_failed',
            session_id: sessionId
          }, 'Synthetic initialize request did not complete');
        }
      } else {
        // No session ID at all - reject
        this.logger.warn({
          operation: 'mcp_request_rejected',
          reason: 'missing_session_id',
          request_method: requestBody?.method || 'unknown'
        }, 'Rejecting MCP request - no session ID provided');

        reply.code(400).send({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(request.raw, reply.raw, request.body);
    });

    // Handle GET requests for server-to-client notifications via SSE
    fastify.get('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !this.transports.has(sessionId)) {
        reply.code(400).send('Invalid or missing session ID');
        return;
      }
      
      const session = this.transports.get(sessionId)!;
      await session.transport.handleRequest(request.raw, reply.raw);
    });

    // Handle DELETE requests for session termination  
    fastify.delete('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !this.transports.has(sessionId)) {
        reply.code(400).send('Invalid or missing session ID');
        return;
      }
      
      const session = this.transports.get(sessionId)!;
      await session.transport.handleRequest(request.raw, reply.raw);
    });

    this.logger.info({
      operation: 'mcp_routes_setup'
    }, 'MCP transport routes setup with official SDK (hierarchical mode)');
  }

  /**
   * Get transport statistics
   */
  getStats() {
    return {
      active_sessions: this.transports.size,
      server_info: {
        name: 'deploystack-satellite',
        version: getVersionString(),
        sdk_version: '@modelcontextprotocol/sdk@1.20.1',
        mode: 'hierarchical-router'
      }
    };
  }

  /**
   * Cleanup all sessions and resources
   */
  async cleanup(): Promise<void> {
    // Close all transports
    for (const [sessionId, session] of this.transports) {
      try {
        session.transport.close();
      } catch (error) {
        this.logger.warn({
          operation: 'transport_cleanup_failed',
          session_id: sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to cleanup transport');
      }
    }
    
    this.transports.clear();
    this.registeredTools.clear();
    
    this.logger.info({
      operation: 'mcp_server_cleanup_complete'
    }, 'MCP server cleanup completed');
  }
}
