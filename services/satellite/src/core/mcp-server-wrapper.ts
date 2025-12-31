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
import { AsyncLocalStorage } from 'async_hooks';
import { UnifiedToolDiscoveryManager } from '../services/unified-tool-discovery-manager';
import { ProcessManager } from '../process/manager';
import { ToolSearchService } from '../services/tool-search-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { OAuthTokenService } from '../services/oauth-token-service';
import type { EventBus } from '../services/event-bus';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getVersionString } from '../config/version';

/**
 * Buffered request log entry for batching
 */
interface BufferedRequestEntry {
  installation_id: string;
  team_id: string;
  user_id?: string;
  tool_name: string;
  tool_params: Record<string, unknown>;
  tool_response?: unknown;
  response_time_ms: number;
  success: boolean;
  error_message?: string;
  timestamp: string;
}

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
  private transports = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();
  private registeredTools = new Set<string>();

  // Track servers currently undergoing recovery to prevent concurrent re-discoveries
  private recoveryInProgress = new Set<string>();

  // Request log batching for mcp.request.logs events
  private requestLogBuffer: BufferedRequestEntry[] = [];
  private requestLogFlushTimeout: NodeJS.Timeout | null = null;
  private readonly REQUEST_LOG_BATCH_INTERVAL_MS = 3000; // 3 seconds
  private readonly REQUEST_LOG_BATCH_MAX_SIZE = 20; // Max logs before forced flush

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

    this.logger.debug({
      operation: 'mcp_dependencies_set'
    }, 'MCP server dependencies set');
  }

  /**
   * Set OAuth token service (OAuth support)
   */
  setOAuthTokenService(oauthTokenService: OAuthTokenService): void {
    this.oauthTokenService = oauthTokenService;

    this.logger.debug({
      operation: 'oauth_token_service_set'
    }, 'OAuth token service set');
  }

  /**
   * Set EventBus for emitting request logs (Request logging)
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;

    this.logger.debug({
      operation: 'event_bus_set'
    }, 'EventBus set for request log emission');
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
        this.handleServerRecovery(cachedTool.serverName, cachedTool.serverSlug, config).catch(error => {
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
      await this.handleToolExecutionFailure(
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
        this.bufferRequestLogEntry({
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
   * @param serverNameOverride - Optional user's processId for per-user routing (per-user routing)
   */
  private async executeToolCall(namespacedToolName: string, toolArgs: any, serverNameOverride?: string): Promise<any> {
    if (!this.toolDiscoveryManager) {
      throw new Error('Tool discovery manager not available');
    }

    this.logger.info({
      operation: 'mcp_tools_call',
      namespaced_tool_name: namespacedToolName,
      server_name_override: serverNameOverride
    }, `Calling namespaced tool: ${namespacedToolName}${serverNameOverride ? ` (user's processId: ${serverNameOverride})` : ''}`);

    // Validate namespaced tool name format (serverSlug:toolName)
    const colonIndex = namespacedToolName.indexOf(':');
    if (colonIndex <= 0) {
      throw new Error(`Invalid tool name format: ${namespacedToolName}. Expected format: serverSlug:toolName`);
    }

    // Find the cached tool to get the original tool name and verify it exists
    const cachedTool = this.toolDiscoveryManager.getTool(namespacedToolName);

    if (!cachedTool) {
      const allTools = this.toolDiscoveryManager.getAllTools();
      throw new Error(`Tool not found: ${namespacedToolName}. Available tools: ${allTools.map(t => t.namespacedName).join(', ')}`);
    }

    // Per-user routing: Use user's processId if provided, otherwise fall back to cached serverName
    const serverName = serverNameOverride || cachedTool.serverName;
    const originalToolName = cachedTool.originalName;
    const transport = cachedTool.transport;

    this.logger.info({
      operation: 'mcp_tools_call_routing',
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      transport: transport,
      using_override: !!serverNameOverride
    }, `Routing tool call to ${transport} server: ${serverName}, tool: ${originalToolName}${serverNameOverride ? ' (per-user process)' : ''}`);

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
      // Use retry wrapper for HTTP/SSE tool calls
      const result = await this.executeHttpToolCallWithRetry(
        serverName,
        originalToolName,
        namespacedToolName,
        jsonRpcRequest,
        3 // maxRetries
      );
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

    // OAuth: OAuth token injection for HTTP/SSE MCP servers
    let headers: Record<string, string> = {};

    // Add regular headers from config (API keys, custom headers, etc.)
    if (config.headers) {
      Object.assign(headers, config.headers);
      this.logger.debug({
        operation: 'config_headers_added',
        server_name: serverName,
        header_keys: Object.keys(config.headers)
      }, `Added ${Object.keys(config.headers).length} headers from config`);
    }

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

    // Create transport based on configured transport_type
    const transportType = config.transport_type || 'http';
    const serverUrl = new URL(finalUrl);

    this.logger.debug({
      operation: 'transport_selection',
      server_name: serverName,
      transport_type: transportType,
      server_url: config.url
    }, `Using ${transportType} transport for tool call to ${serverName}`);

    const transport = transportType === 'sse'
      ? new SSEClientTransport(serverUrl)
      : new StreamableHTTPClientTransport(serverUrl);

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
        operation: 'headers_patched_global_fetch',
        server_name: serverName,
        headers_to_inject: Object.keys(headers)
      }, `Patched global fetch to inject ${Object.keys(headers).length} headers for tool execution`);
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

      // OAuth: Handle OAuth 401 errors
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
   * Execute HTTP tool call with retry logic
   * Retries connection errors 2-3 times with exponential backoff
   * Does NOT retry auth errors or OAuth errors
   */
  private async executeHttpToolCallWithRetry(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any,
    maxRetries: number = 3
  ): Promise<any> {
    const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'fetch failed', 'network error'];
    const nonRetryableErrors = ['401', '403', 'unauthorized', 'forbidden', 'oauth', 'authorization required'];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Call existing handleHttpToolCall method
        return await this.handleHttpToolCall(serverName, originalToolName, namespacedToolName, jsonRpcRequest);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message.toLowerCase();

        // Check if error is non-retryable (auth/OAuth errors)
        const isNonRetryable = nonRetryableErrors.some(pattern => errorMessage.includes(pattern));
        if (isNonRetryable) {
          this.logger.warn({
            operation: 'http_tool_call_non_retryable_error',
            server_name: serverName,
            attempt,
            error: lastError.message
          }, `Non-retryable error on attempt ${attempt}/${maxRetries} - giving up`);
          throw lastError;
        }

        // Check if error is retryable (connection errors)
        const isRetryable = retryableErrors.some(pattern => errorMessage.includes(pattern));
        if (!isRetryable) {
          this.logger.warn({
            operation: 'http_tool_call_unknown_error',
            server_name: serverName,
            attempt,
            error: lastError.message
          }, `Unknown error on attempt ${attempt}/${maxRetries} - not retrying`);
          throw lastError;
        }

        // Last attempt - don't wait, just throw
        if (attempt === maxRetries) {
          this.logger.error({
            operation: 'http_tool_call_retries_exhausted',
            server_name: serverName,
            total_attempts: maxRetries,
            error: lastError.message
          }, `All ${maxRetries} retry attempts exhausted for ${serverName}`);
          throw lastError;
        }

        // Calculate exponential backoff: 500ms, 1000ms, 2000ms
        const backoffMs = 500 * Math.pow(2, attempt - 1);

        this.logger.warn({
          operation: 'http_tool_call_retry',
          server_name: serverName,
          attempt,
          max_retries: maxRetries,
          backoff_ms: backoffMs,
          error: lastError.message
        }, `Retryable error on attempt ${attempt}/${maxRetries} - retrying in ${backoffMs}ms`);

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Retry logic failed unexpectedly');
  }

  /**
   * Handle tool execution failure - emit status change events
   * Called after retry attempts are exhausted
   */
  private async handleToolExecutionFailure(
    serverName: string,
    serverSlug: string,
    config: any | undefined,
    errorMessage: string
  ): Promise<void> {
    if (!this.toolDiscoveryManager) {
      return;
    }

    this.logger.error({
      operation: 'tool_execution_failed_emitting_status',
      server_name: serverName,
      server_slug: serverSlug,
      error: errorMessage
    }, `Tool execution failed after retries - updating server status`);

    // Import getStatusFromError from RemoteToolDiscoveryManager
    const { RemoteToolDiscoveryManager } = await import('../services/remote-tool-discovery-manager');
    const { status, message } = RemoteToolDiscoveryManager.getStatusFromError(errorMessage);

    // Update local status tracking
    this.toolDiscoveryManager.setServerStatus(serverSlug, status, message);

    // Emit status change to backend (if we have installation context)
    if (config?.installation_id && config?.team_id && this.eventBus) {
      this.eventBus.emit('mcp.server.status_changed', {
        installation_id: config.installation_id,
        team_id: config.team_id,
        user_id: config.user_id || 'unknown',
        status,
        status_message: message,
        timestamp: new Date().toISOString()
      });

      this.logger.info({
        operation: 'server_status_emitted_on_failure',
        server_slug: serverSlug,
        installation_id: config.installation_id,
        status,
        status_message: message
      }, `Emitted status change to backend: ${status}`);
    }
  }

  /**
   * Handle server recovery - trigger tool re-discovery
   * Called when tool succeeds but server was previously offline/error
   */
  private async handleServerRecovery(
    serverName: string,
    serverSlug: string,
    config: any | undefined
  ): Promise<void> {
    if (!this.toolDiscoveryManager) {
      return;
    }

    // Debounce: skip if already recovering
    if (this.recoveryInProgress.has(serverSlug)) {
      this.logger.debug({
        operation: 'server_recovery_skipped_already_in_progress',
        server_slug: serverSlug
      }, 'Skipping re-discovery - already in progress');
      return;
    }

    this.recoveryInProgress.add(serverSlug);

    try {
      this.logger.info({
        operation: 'server_recovery_rediscovery_start',
        server_name: serverName,
        server_slug: serverSlug
      }, `Starting tool re-discovery after server recovery: ${serverSlug}`);

      // Emit "connecting" status to backend
      if (config?.installation_id && config?.team_id && this.eventBus) {
        this.eventBus.emit('mcp.server.status_changed', {
          installation_id: config.installation_id,
          team_id: config.team_id,
          user_id: config.user_id || 'unknown',
          status: 'connecting',
          status_message: 'Server recovered, re-discovering tools',
          timestamp: new Date().toISOString()
        });
      }

      // Update local status
      this.toolDiscoveryManager.setServerStatus(serverSlug, 'connecting', 'Server recovered, re-discovering tools');

      // Get RemoteToolDiscoveryManager instance from UnifiedToolDiscoveryManager
      const remoteToolManager = (this.toolDiscoveryManager as any).remoteToolManager;

      if (!remoteToolManager) {
        throw new Error('RemoteToolDiscoveryManager not available');
      }

      // Trigger tool re-discovery (this will emit "discovering_tools" → "online" statuses)
      await remoteToolManager.discoverServerTools(serverName);

      this.logger.info({
        operation: 'server_recovery_rediscovery_success',
        server_slug: serverSlug
      }, `Tool re-discovery successful after recovery: ${serverSlug}`);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'server_recovery_rediscovery_failed',
        server_slug: serverSlug,
        error: errMsg
      }, `Tool re-discovery failed after recovery: ${errMsg}`);

      // Emit error status
      if (config?.installation_id && config?.team_id && this.eventBus) {
        this.eventBus.emit('mcp.server.status_changed', {
          installation_id: config.installation_id,
          team_id: config.team_id,
          user_id: config.user_id || 'unknown',
          status: 'error',
          status_message: `Re-discovery failed: ${errMsg}`,
          timestamp: new Date().toISOString()
        });
      }

      this.toolDiscoveryManager.setServerStatus(serverSlug, 'error', `Re-discovery failed: ${errMsg}`);

      // Don't throw - recovery failure is non-fatal (tool execution already succeeded)
    } finally {
      this.recoveryInProgress.delete(serverSlug);
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

      // Extract user context from OAuth token for per-user process routing (per-user routing)
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
    // Flush any remaining request logs before cleanup
    await this.flushRequestLogBuffer();

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

  // ==================== Request Log Batching (Request logging) ====================

  /**
   * Buffer a request log entry for batched emission
   */
  private bufferRequestLogEntry(entry: BufferedRequestEntry): void {
    this.requestLogBuffer.push(entry);

    this.logger.debug({
      operation: 'request_log_buffered',
      installation_id: entry.installation_id,
      tool_name: entry.tool_name,
      buffer_size: this.requestLogBuffer.length
    }, `Buffered request log for ${entry.tool_name} (buffer: ${this.requestLogBuffer.length})`);

    // Flush immediately if buffer is full
    if (this.requestLogBuffer.length >= this.REQUEST_LOG_BATCH_MAX_SIZE) {
      this.flushRequestLogBuffer();
    } else {
      this.scheduleRequestLogFlush();
    }
  }

  /**
   * Schedule a request log flush after the batch interval
   */
  private scheduleRequestLogFlush(): void {
    if (this.requestLogFlushTimeout) {
      return; // Already scheduled
    }

    this.requestLogFlushTimeout = setTimeout(() => {
      this.flushRequestLogBuffer();
    }, this.REQUEST_LOG_BATCH_INTERVAL_MS);
  }

  /**
   * Flush all buffered request logs to the backend via EventBus
   */
  private async flushRequestLogBuffer(): Promise<void> {
    if (this.requestLogFlushTimeout) {
      clearTimeout(this.requestLogFlushTimeout);
      this.requestLogFlushTimeout = null;
    }

    if (this.requestLogBuffer.length === 0) {
      return;
    }

    if (!this.eventBus) {
      this.logger.warn({
        operation: 'request_log_flush_skipped',
        buffer_size: this.requestLogBuffer.length,
        reason: 'no_event_bus'
      }, 'Skipping request log flush - EventBus not available');
      this.requestLogBuffer = [];
      return;
    }

    // Group logs by installation_id + team_id for efficient emission
    const groupedLogs = new Map<string, {
      installation_id: string;
      team_id: string;
      requests: Array<{
        user_id?: string;
        tool_name: string;
        tool_params: Record<string, unknown>;
        tool_response?: unknown;
        response_time_ms: number;
        success: boolean;
        error_message?: string;
        timestamp: string;
      }>;
    }>();

    for (const entry of this.requestLogBuffer) {
      const key = `${entry.installation_id}:${entry.team_id}`;

      if (!groupedLogs.has(key)) {
        groupedLogs.set(key, {
          installation_id: entry.installation_id,
          team_id: entry.team_id,
          requests: []
        });
      }

      groupedLogs.get(key)!.requests.push({
        user_id: entry.user_id,
        tool_name: entry.tool_name,
        tool_params: entry.tool_params,
        tool_response: entry.tool_response,
        response_time_ms: entry.response_time_ms,
        success: entry.success,
        error_message: entry.error_message,
        timestamp: entry.timestamp
      });
    }

    const totalLogs = this.requestLogBuffer.length;
    this.requestLogBuffer = [];

    // Emit events for each installation group
    for (const [, data] of groupedLogs) {
      try {
        await this.eventBus.emit('mcp.request.logs', {
          installation_id: data.installation_id,
          team_id: data.team_id,
          requests: data.requests
        });

        this.logger.debug({
          operation: 'request_logs_emitted',
          installation_id: data.installation_id,
          team_id: data.team_id,
          request_count: data.requests.length
        }, `Emitted ${data.requests.length} request logs for installation ${data.installation_id}`);
      } catch (error) {
        this.logger.error({
          operation: 'request_log_emit_failed',
          installation_id: data.installation_id,
          team_id: data.team_id,
          error: error instanceof Error ? error.message : String(error)
        }, `Failed to emit request logs for installation ${data.installation_id}`);
      }
    }

    this.logger.info({
      operation: 'request_log_buffer_flushed',
      total_logs: totalLogs,
      groups: groupedLogs.size
    }, `Flushed ${totalLogs} request logs across ${groupedLogs.size} installations`);
  }
}
