/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { UnifiedToolDiscoveryManager } from '../services/unified-tool-discovery-manager';
import { ProcessManager } from '../process';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { OAuthTokenService } from '../services/oauth-token-service';
import type { EventBus } from '../services/event-bus';
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
 * MCP Tool Executor
 *
 * Handles tool execution for stdio and HTTP/SSE MCP servers.
 * Extracted from mcp-server-wrapper.ts to enable code reuse between
 * hierarchical router and path-based router.
 *
 * Features:
 * - Tool execution routing (stdio vs HTTP/SSE)
 * - OAuth token injection for HTTP/SSE servers
 * - Retry logic with exponential backoff
 * - Server recovery detection and re-discovery
 * - Request logging with batching
 */
export class McpToolExecutor {
  private requestLogBuffer: BufferedRequestEntry[] = [];
  private requestLogFlushTimeout: NodeJS.Timeout | null = null;
  private readonly REQUEST_LOG_BATCH_INTERVAL_MS = 3000; // 3 seconds
  private readonly REQUEST_LOG_BATCH_MAX_SIZE = 20; // Max logs before forced flush

  // Track servers currently undergoing recovery to prevent concurrent re-discoveries
  private recoveryInProgress = new Set<string>();

  constructor(
    private logger: FastifyBaseLogger,
    private processManager: ProcessManager,
    private toolDiscoveryManager: UnifiedToolDiscoveryManager,
    private dynamicConfigManager: DynamicConfigManager,
    private oauthTokenService?: OAuthTokenService,
    private eventBus?: EventBus
  ) {
    this.logger = logger.child({ component: 'McpToolExecutor' });
  }

  /**
   * Execute tool call - route to appropriate MCP server
   * @param namespacedToolName - Tool path in format "serverSlug:toolName"
   * @param toolArgs - Arguments to pass to the tool
   * @param serverNameOverride - Optional user's processId for per-user routing
   */
  async executeToolCall(namespacedToolName: string, toolArgs: any, serverNameOverride?: string): Promise<any> {
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

    // Use user's processId if provided, otherwise fall back to cached serverName
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
   * Handle tool call for stdio MCP servers via ProcessManager
   */
  private async handleStdioToolCall(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any
  ): Promise<any> {
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
   * Handle tool call for HTTP/SSE MCP servers via SDK client
   */
  private async handleHttpToolCall(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any
  ): Promise<any> {
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

    // OAuth token injection for HTTP/SSE MCP servers
    let headers: Record<string, string> = {};

    // Always set WAF-friendly User-Agent for remote HTTP/SSE servers
    headers['User-Agent'] = 'Mozilla/5.0 (compatible; DeployStack-Satellite/1.0; +https://deploystack.io)';

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

      // Handle OAuth 401 errors
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
  async handleToolExecutionFailure(
    serverName: string,
    serverSlug: string,
    config: any | undefined,
    errorMessage: string
  ): Promise<void> {
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

    // Attempt immediate recovery for connection errors (not auth errors which need user intervention)
    if (status === 'offline' || status === 'error') {
      this.handleServerRecovery(serverName, serverSlug, config).catch(err => {
        this.logger.debug({
          operation: 'immediate_recovery_attempt_failed',
          server_slug: serverSlug,
          error: err instanceof Error ? err.message : String(err)
        }, 'Immediate recovery attempt failed - will retry on next tool call or backend health check');
      });
    }
  }

  /**
   * Handle server recovery - trigger tool re-discovery
   * Called when tool succeeds but server was previously offline/error,
   * OR immediately after tool failure (immediate recovery attempt)
   */
  async handleServerRecovery(
    serverName: string,
    serverSlug: string,
    config: any | undefined
  ): Promise<void> {
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

  // ==================== Request Log Batching ====================

  /**
   * Buffer a request log entry for batched emission
   */
  bufferRequestLogEntry(entry: BufferedRequestEntry): void {
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
  async flushRequestLogBuffer(): Promise<void> {
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

  /**
   * Cleanup executor resources
   */
  async cleanup(): Promise<void> {
    this.logger.info({
      operation: 'tool_executor_cleanup_start'
    }, 'Cleaning up tool executor');

    // Flush any remaining request logs
    await this.flushRequestLogBuffer();

    // Clear recovery tracking
    this.recoveryInProgress.clear();

    this.logger.info({
      operation: 'tool_executor_cleanup_complete'
    }, 'Tool executor cleanup completed');
  }
}
