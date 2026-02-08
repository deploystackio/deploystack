/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest
} from '@modelcontextprotocol/sdk/types.js';
import { FastifyBaseLogger, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AsyncLocalStorage } from 'async_hooks';
import { UnifiedToolDiscoveryManager } from '../services/unified-tool-discovery-manager';
import { ProcessManager } from '../process';
import { ToolSearchService } from '../services/tool-search-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { OAuthTokenService } from '../services/oauth-token-service';
import { SsePingService } from '../services/sse-ping-service';
import type { EventBus } from '../services/event-bus';
import { getVersionString } from '../config/version';
import { McpToolExecutor } from '../lib/mcp-tool-executor';
import { McpSessionManager } from '../lib/mcp-session-manager';

/**
 * User request context extracted from OAuth token
 * Stored in AsyncLocalStorage for per-user process routing
 */
interface UserRequestContext {
  user_id: string;
  team_id: string;
}

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
  private eventBus?: EventBus;
  private ssePingService?: SsePingService;
  private registeredTools = new Set<string>();

  // Extracted modules for code reuse
  private toolExecutor?: McpToolExecutor;
  private sessionManager?: McpSessionManager;

  // AsyncLocalStorage for per-user request context (Per-User Process Routing)
  private readonly userContextStore = new AsyncLocalStorage<UserRequestContext>();

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

    // Initialize tool executor with dependencies
    this.toolExecutor = new McpToolExecutor(
      this.logger,
      processManager,
      toolDiscoveryManager,
      dynamicConfigManager,
      this.oauthTokenService,
      this.eventBus
    );

    // Initialize session manager
    this.sessionManager = new McpSessionManager(this.logger);

    this.logger.debug({
      operation: 'mcp_dependencies_set'
    }, 'MCP server dependencies set, executor and session manager initialized');
  }

  /**
   * Set OAuth token service (OAuth support)
   */
  setOAuthTokenService(oauthTokenService: OAuthTokenService): void {
    this.oauthTokenService = oauthTokenService;

    // Re-initialize toolExecutor if dependencies are already set
    if (this.processManager && this.toolDiscoveryManager && this.dynamicConfigManager) {
      this.toolExecutor = new McpToolExecutor(
        this.logger,
        this.processManager,
        this.toolDiscoveryManager,
        this.dynamicConfigManager,
        oauthTokenService,
        this.eventBus
      );
    }

    this.logger.debug({
      operation: 'oauth_token_service_set'
    }, 'OAuth token service set');
  }

  /**
   * Set EventBus for emitting request logs (Request logging)
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;

    // Re-initialize toolExecutor if dependencies are already set
    if (this.processManager && this.toolDiscoveryManager && this.dynamicConfigManager) {
      this.toolExecutor = new McpToolExecutor(
        this.logger,
        this.processManager,
        this.toolDiscoveryManager,
        this.dynamicConfigManager,
        this.oauthTokenService,
        eventBus
      );
    }

    this.logger.debug({
      operation: 'event_bus_set'
    }, 'EventBus set for request log emission');
  }

  /**
   * Set SSE ping service for keep-alive (Proxy timeout prevention)
   */
  setSsePingService(ssePingService: SsePingService): void {
    this.ssePingService = ssePingService;

    this.logger.debug({
      operation: 'sse_ping_service_set'
    }, 'SSE ping service set for keep-alive');
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
          description: 'Search for MCP tools using 1-3 keywords only. Examples: "markdown", "github create", "database query". Use "*" to list all available tools (max 20). Avoid long descriptions. Use tool name or main function as keywords. Returns tool paths for execute_mcp_tool.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Short search query with 1-3 keywords (e.g., "markdown", "github", "database postgres"). Use "*" to list all tools. Avoid full sentences.'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10, max: 20 for wildcard)',
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
    if (!this.toolSearchService || !this.dynamicConfigManager) {
      throw new Error('Tool search service or config manager not available');
    }

    const query = args.query;
    const limit = args.limit || 10;

    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query parameter - must be a non-empty string');
    }

    // Get user context for per-user tool filtering (per-user routing)
    const userContext = this.userContextStore.getStore();

    // Handle wildcard query "*" - list all tools (max 20)
    const isWildcard = query.trim() === '*';
    const wildcardLimit = 20;

    this.logger.info({
      operation: 'discover_mcp_tools',
      query: query,
      limit: isWildcard ? wildcardLimit : limit,
      is_wildcard: isWildcard,
      user_id: userContext?.user_id,
      has_user_context: !!userContext
    }, `Discovering tools with query: "${query}"${isWildcard ? ' (wildcard mode)' : ''}${userContext ? ` (user: ${userContext.user_id})` : ''}`);

    const startTime = Date.now();

    let results;
    let totalAvailable = 0;
    let truncationMessage: string | undefined;

    if (isWildcard) {
      // Wildcard: return all tools up to max 20
      results = this.toolSearchService.listAll(wildcardLimit);
      totalAvailable = this.toolSearchService.getEnabledToolCount();

      if (totalAvailable > wildcardLimit) {
        truncationMessage = `Showing ${wildcardLimit} of ${totalAvailable} available tools. Use specific keywords (e.g., "github", "database", "markdown") to find additional tools not shown here.`;
      }
    } else {
      // Normal search
      results = this.toolSearchService.search(query, limit);
    }

    // Per-user routing: Filter results to only show user's installations
    if (userContext) {
      const userConfigs = this.dynamicConfigManager.getConfigsForUser(userContext.user_id);
      const userServerNames = new Set(userConfigs.map(config => config.name));

      this.logger.debug({
        operation: 'discover_mcp_tools_user_filter',
        user_id: userContext.user_id,
        user_server_count: userServerNames.size,
        user_servers: Array.from(userServerNames),
        results_before_filter: results.length
      }, `Filtering tools to user's ${userServerNames.size} installations`);

      results = results.filter(tool => userServerNames.has(tool.server_name));

      this.logger.debug({
        operation: 'discover_mcp_tools_user_filtered',
        user_id: userContext.user_id,
        results_after_filter: results.length
      }, `Filtered to ${results.length} tools from user's installations`);
    }

    const searchTime = Date.now() - startTime;

    const response: any = {
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

    // Add truncation notice for wildcard queries with more tools available
    if (truncationMessage) {
      response.notice = truncationMessage;
      response.total_available = totalAvailable;
    }

    this.logger.info({
      operation: 'discover_mcp_tools_success',
      query: query,
      results_count: results.length,
      search_time_ms: searchTime,
      is_wildcard: isWildcard,
      total_available: totalAvailable,
      was_truncated: !!truncationMessage
    }, `Discovery complete: found ${results.length} tools in ${searchTime}ms${truncationMessage ? ` (truncated from ${totalAvailable})` : ''}`);

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

    // Validate tool_path format (serverSlug:toolName)
    const colonIndex = toolPath.indexOf(':');
    if (colonIndex <= 0) {
      throw new Error(`Invalid tool_path format: ${toolPath}. Expected format: "serverSlug:toolName" (e.g., "github:create_issue")`);
    }

    // tool_path format matches internal namespaced format (unified to colon separator)
    const namespacedToolName = toolPath;

    this.logger.info({
      operation: 'execute_mcp_tool',
      tool_path: toolPath
    }, `Executing tool: ${toolPath}`);

    this.logger.debug({
      operation: 'execute_mcp_tool_debug',
      tool_path: toolPath,
      arguments: toolArguments
    }, `Tool arguments for ${toolPath}`);

    // Check if tool exists and get cached tool info for disabled check
    // Note: getTool searches unfiltered cache, so we can find tools from offline servers
    const cachedTool = this.toolDiscoveryManager.getTool(namespacedToolName);
    if (!cachedTool) {
      const allTools = this.toolDiscoveryManager.getAllTools();
      throw new Error(`Tool not found: ${namespacedToolName}. Available tools: ${allTools.map(t => t.namespacedName).join(', ')}`);
    }

    // OAuth: Check if server is available before executing tool
    const serverStatus = this.toolDiscoveryManager.getServerStatus(cachedTool.serverSlug);
    if (serverStatus && serverStatus.status !== 'online') {
      // Allow execution attempts for 'offline' and 'error' states to detect recovery
      // Block execution only for transitional states and permanent failures
      const allowRecoveryAttempt = serverStatus.status === 'offline' || serverStatus.status === 'error';
      const shouldBlock = !allowRecoveryAttempt;

      if (shouldBlock) {
        this.logger.warn({
          operation: 'execute_mcp_tool_server_unavailable',
          tool_path: toolPath,
          server_slug: cachedTool.serverSlug,
          server_status: serverStatus.status,
          status_message: serverStatus.message
        }, `Tool execution blocked - server is ${serverStatus.status}: ${toolPath}`);

        return this.createUnavailableServerResponse(toolPath, cachedTool.serverSlug, serverStatus.status, serverStatus.message);
      } else {
        // Server is offline/error - allow execution attempt to detect recovery
        this.logger.info({
          operation: 'execute_mcp_tool_recovery_attempt',
          tool_path: toolPath,
          server_slug: cachedTool.serverSlug,
          server_status: serverStatus.status,
          status_message: serverStatus.message
        }, `Allowing tool execution to detect potential server recovery: ${toolPath}`);
      }
    }

    // Per-user routing: Get user-specific config for per-user process routing
    // Extract server_slug from tool_path (format: "serverSlug:toolName")
    const serverSlug = toolPath.substring(0, colonIndex);
    const userContext = this.userContextStore.getStore();

    let config: any | undefined;

    if (userContext && this.dynamicConfigManager) {
      // Find the user's specific installation for this server
      config = this.dynamicConfigManager.findConfigByServerAndUser(serverSlug, userContext.user_id);

      if (!config) {
        this.logger.error({
          operation: 'execute_mcp_tool_user_no_config',
          tool_path: toolPath,
          server_slug: serverSlug,
          user_id: userContext.user_id
        }, `User does not have access to server: ${serverSlug}`);

        throw new Error(
          `You do not have access to server '${serverSlug}'. ` +
          `Please check your team's MCP server installations.`
        );
      }

      this.logger.debug({
        operation: 'execute_mcp_tool_user_config_found',
        tool_path: toolPath,
        server_slug: serverSlug,
        user_id: userContext.user_id,
        installation_name: config.name
      }, `Found user's config for ${serverSlug}: ${config.name}`);
    } else {
      // Fallback: No user context (backward compatibility)
      config = this.dynamicConfigManager?.getMcpServerConfig(cachedTool.serverName);
    }

    // Check if tool is disabled
    if (config?.installation_id) {
      const isDisabled = this.toolDiscoveryManager.isToolDisabled(
        config.installation_id,
        cachedTool.originalName
      );

      if (isDisabled) {
        this.logger.warn({
          operation: 'execute_mcp_tool_disabled',
          tool_path: toolPath,
          installation_id: config.installation_id,
          tool_name: cachedTool.originalName
        }, `Tool execution blocked - tool is disabled: ${toolPath}`);

        return this.createDisabledToolResponse(toolPath);
      }
    }

    // Execute tool with request logging (Request logging)
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let result: any;

    // Get server status BEFORE execution to detect recovery
    const serverStatusBefore = this.toolDiscoveryManager.getServerStatus(cachedTool.serverSlug);
    const wasOfflineOrError = serverStatusBefore?.status === 'offline' ||
                              serverStatusBefore?.status === 'error' ||
                              serverStatusBefore?.status === 'requires_reauth';

    try {
      // Per-user routing: Pass user's processId for per-user routing
      const serverNameOverride = config?.name; // This is the user's processId
      result = await this.executeToolCall(namespacedToolName, toolArguments, serverNameOverride);
      success = true;

      // SUCCESS PATH: Check if server was previously offline/error
      if (wasOfflineOrError) {
        this.logger.info({
          operation: 'server_recovery_detected',
          server_slug: cachedTool.serverSlug,
          server_name: cachedTool.serverName,
          previous_status: serverStatusBefore?.status,
          tool_name: namespacedToolName
        }, `Server ${cachedTool.serverSlug} recovered - triggering re-discovery`);

        // Trigger re-discovery asynchronously (don't block tool response)
        this.toolExecutor!.handleServerRecovery(cachedTool.serverName, cachedTool.serverSlug, config).catch(error => {
          this.logger.error({
            operation: 'server_recovery_failed',
            server_slug: cachedTool.serverSlug,
            error: error instanceof Error ? error.message : String(error)
          }, `Failed to re-discover tools after recovery: ${error}`);
        });
      }

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);

      // FAILURE PATH: Emit status change after retries exhausted
      await this.toolExecutor!.handleToolExecutionFailure(
        cachedTool.serverName,
        cachedTool.serverSlug,
        config,
        errorMessage
      );

      throw error;
    } finally {
      const responseTimeMs = Date.now() - startTime;

      // Check if request logging is enabled (default: true for backward compatibility)
      const loggingEnabled = config?.settings?.request_logging_enabled !== false;

      // Buffer request log if we have installation context and logging is enabled
      if ((config?.installation_id && config?.team_id) && loggingEnabled) {
        this.toolExecutor!.bufferRequestLogEntry({
          installation_id: config.installation_id,
          team_id: config.team_id,
          user_id: config.user_id,
          tool_name: toolPath,
          tool_params: toolArguments,
          tool_response: result,
          response_time_ms: responseTimeMs,
          success,
          error_message: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    }

    return result;
  }

  /**
   * Create LLM-friendly error response for disabled tools
   */
  private createDisabledToolResponse(toolPath: string): any {
    const message = [
      `Tool '${toolPath}' has been disabled by the team administrator.`,
      '',
      'This tool is currently unavailable and cannot be executed.',
      '',
      'Recommended actions:',
      '1. Use discover_mcp_tools to find alternative tools that can accomplish your task',
      '2. Contact your team administrator if you need this tool enabled',
      '',
      `Disabled tool: ${toolPath}`
    ].join('\n');

    return {
      content: [{
        type: 'text',
        text: message
      }],
      isError: true
    };
  }

  /**
   * Create LLM-friendly error response for unavailable servers (OAuth support)
   */
  private createUnavailableServerResponse(
    toolPath: string,
    serverSlug: string,
    status: string,
    statusMessage?: string
  ): any {
    const statusMessages: Record<string, string> = {
      'offline': 'The server is currently offline or unreachable.',
      'error': 'The server encountered an error and is not operational.',
      'requires_reauth': 'The server requires re-authentication. Please re-authorize this MCP server in the dashboard.',
      'permanently_failed': 'The server has permanently failed and cannot be used.',
      'connecting': 'The server is currently connecting. Please try again in a moment.',
      'discovering_tools': 'The server is still discovering tools. Please try again in a moment.'
    };

    const statusDescription = statusMessages[status] || `The server is in ${status} state.`;

    const message = [
      `Tool '${toolPath}' cannot be executed because the MCP server '${serverSlug}' is unavailable.`,
      '',
      `Status: ${status}`,
      statusDescription,
      statusMessage ? `Details: ${statusMessage}` : '',
      '',
      'Recommended actions:',
      '1. Use discover_mcp_tools to find alternative tools from other servers',
      status === 'requires_reauth'
        ? '2. Visit the dashboard to re-authorize this MCP server'
        : '2. Wait for the server to come back online and try again',
      '',
      `Unavailable server: ${serverSlug}`
    ].filter(Boolean).join('\n');

    return {
      content: [{
        type: 'text',
        text: message
      }],
      isError: true
    };
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
   * @param namespacedToolName - Tool path in format "serverSlug:toolName"
   * @param toolArgs - Arguments to pass to the tool
   * @param serverNameOverride - Optional user's processId for per-user routing
   */
  private async executeToolCall(namespacedToolName: string, toolArgs: any, serverNameOverride?: string): Promise<any> {
    if (!this.toolExecutor) {
      throw new Error('Tool executor not initialized');
    }
    return this.toolExecutor.executeToolCall(namespacedToolName, toolArgs, serverNameOverride);
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
        has_session_in_map: sessionId ? this.sessionManager!.hasSession(sessionId) : false,
        is_initialize_request: isInitRequest,
        request_method: requestBody?.method || 'unknown',
        total_active_sessions: this.sessionManager!.sessionCount
      }, 'Processing MCP request');

      let transport: StreamableHTTPServerTransport;
      let server: Server;

      if (sessionId && this.sessionManager!.hasSession(sessionId)) {
        // Reuse existing transport and server
        const session = this.sessionManager!.getSession(sessionId)!;
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

        // Check for dormant stdio processes and respawn them
        await this.respawnDormantProcesses();

        // Create session using session manager
        const sessionEntry = this.sessionManager!.createSession(
          (server) => {
            // Setup MCP server with hierarchical router (2 meta-tools)
            this.setupMcpServer(server);
          }
        );

        transport = sessionEntry.transport;
        server = sessionEntry.server;
        await server.connect(transport);
      } else if (sessionId) {
        // Stale session ID - auto-resurrect the session transparently
        this.logger.info({
          operation: 'mcp_session_resurrection',
          session_id: sessionId,
          request_method: requestBody?.method || 'unknown'
        }, 'Auto-resurrecting stale session after satellite restart');

        // Check for dormant stdio processes and respawn them
        await this.respawnDormantProcesses();

        // Create session with fixed ID using session manager
        const sessionEntry = this.sessionManager!.createSessionWithId(
          sessionId,
          (server) => {
            // Setup MCP server with hierarchical router
            this.setupMcpServer(server);
          }
        );

        transport = sessionEntry.transport;
        server = sessionEntry.server;
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

      // Extract user context from OAuth token for per-user process routing
      const userContext: UserRequestContext | undefined = request.auth ? {
        user_id: request.auth.user.id,
        team_id: request.auth.team.id
      } : undefined;

      // Handle the request with user context stored in AsyncLocalStorage
      if (userContext) {
        await this.userContextStore.run(userContext, async () => {
          await transport.handleRequest(request.raw, reply.raw, request.body);
        });
      } else {
        // No authentication - handle request without user context (backward compatibility)
        await transport.handleRequest(request.raw, reply.raw, request.body);
      }
    });

    // Handle GET requests for server-to-client notifications via SSE
    fastify.get('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !this.sessionManager!.hasSession(sessionId)) {
        reply.code(400).send('Invalid or missing session ID');
        return;
      }

      // Register connection for SSE ping keep-alive (prevents proxy timeout)
      if (this.ssePingService) {
        this.ssePingService.registerConnection(sessionId, reply.raw);
      }

      const session = this.sessionManager!.getSession(sessionId)!;
      await session.transport.handleRequest(request.raw, reply.raw);
    });

    // Handle DELETE requests for session termination
    fastify.delete('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !this.sessionManager!.hasSession(sessionId)) {
        reply.code(400).send('Invalid or missing session ID');
        return;
      }

      const session = this.sessionManager!.getSession(sessionId)!;
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
      active_sessions: this.sessionManager!.sessionCount,
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
    // Flush any remaining request logs before cleanup
    await this.toolExecutor!.flushRequestLogBuffer();

    // Cleanup session manager
    await this.sessionManager!.cleanup();

    this.registeredTools.clear();

    this.logger.info({
      operation: 'mcp_server_cleanup_complete'
    }, 'MCP server cleanup completed');
  }
}
