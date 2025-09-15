/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { HttpProxyManager } from './http-proxy-manager';
import { RemoteToolDiscoveryManager } from './remote-tool-discovery-manager';
import { ProxyRequestContext } from '../types/mcp-server';

/**
 * MCP Protocol Handler
 * Handles MCP JSON-RPC protocol methods and integrates with HTTP Proxy Manager
 */
export class McpProtocolHandler {
  private logger: FastifyBaseLogger;
  private httpProxyManager: HttpProxyManager;
  private toolDiscoveryManager: RemoteToolDiscoveryManager;

  constructor(httpProxyManager: HttpProxyManager, toolDiscoveryManager: RemoteToolDiscoveryManager, logger: FastifyBaseLogger) {
    this.httpProxyManager = httpProxyManager;
    this.toolDiscoveryManager = toolDiscoveryManager;
    this.logger = logger.child({ component: 'McpProtocolHandler' });
  }

  /**
   * Handle MCP JSON-RPC request
   */
  async handleMcpRequest(message: any, sessionId?: string): Promise<any> {
    const { method, params, id } = message;

    this.logger.debug({
      operation: 'mcp_request_received',
      method,
      message_id: id,
      session_id: sessionId
    }, `Handling MCP request: ${method}`);

    try {
      let result: any;

      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
        
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        
        case 'tools/call':
          result = await this.handleToolsCall(params, id);
          break;
        
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
        
        case 'resources/templates/list':
          result = await this.handleResourceTemplatesList();
          break;
        
        case 'prompts/list':
          result = await this.handlePromptsList();
          break;
        
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      const response = {
        jsonrpc: '2.0',
        id,
        result
      };

      this.logger.debug({
        operation: 'mcp_request_success',
        method,
        message_id: id,
        session_id: sessionId
      }, `MCP request handled successfully: ${method}`);

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error({
        operation: 'mcp_request_failed',
        method,
        message_id: id,
        session_id: sessionId,
        error: errorMessage
      }, `MCP request failed: ${method} - ${errorMessage}`);

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: errorMessage
        }
      };
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: any): Promise<any> {
    this.logger.info({
      operation: 'mcp_initialize',
      client_info: params?.clientInfo
    }, 'MCP client initializing');

    return {
      serverInfo: {
        name: 'deploystack-satellite',
        version: '1.0.0'
      },
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: { listChanged: false },
        resources: {},
        prompts: {}
      }
    };
  }

  /**
   * Handle tools/list request - returns cached discovered tools from remote MCP servers
   */
  private async handleToolsList(): Promise<any> {
    this.logger.debug({
      operation: 'mcp_tools_list'
    }, 'Listing cached discovered tools from remote MCP servers');

    const cachedTools = this.toolDiscoveryManager.getCachedTools();
    
    const tools = cachedTools.map(tool => ({
      name: tool.namespacedName,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    const result = { tools };

    this.logger.info({
      operation: 'mcp_tools_list_success',
      tool_count: tools.length,
      tools: tools.map(t => t.name),
      discovery_ready: this.toolDiscoveryManager.isReady(),
      result_object: result
    }, `Returning ${tools.length} cached tools from remote MCP servers`);

    this.logger.debug({
      operation: 'mcp_tools_list_debug',
      cached_tools_count: cachedTools.length,
      mapped_tools_count: tools.length,
      result_json: JSON.stringify(result)
    }, 'Debug: tools/list result object');

    return result;
  }

  /**
   * Handle tools/call request - route namespaced tool calls to appropriate remote MCP server
   * Uses OAuth team context to resolve the correct server instance
   */
  private async handleToolsCall(params: any, requestId: any, teamId?: string): Promise<any> {
    const { name: namespacedToolName, arguments: toolArgs } = params;

    if (!namespacedToolName) {
      throw new Error('Tool name is required');
    }

    this.logger.info({
      operation: 'mcp_tools_call',
      namespaced_tool_name: namespacedToolName,
      request_id: requestId,
      team_id: teamId
    }, `Calling namespaced tool: ${namespacedToolName}`);

    // Parse the server slug from the namespaced tool name (e.g., "context7-resolve-library-id" -> "context7")
    const dashIndex = namespacedToolName.indexOf('-');
    if (dashIndex <= 0) {
      throw new Error(`Invalid tool name format: ${namespacedToolName}. Expected format: serverSlug-toolName`);
    }

    const serverSlug = namespacedToolName.substring(0, dashIndex);

    // Find the cached tool to get the original tool name and verify it exists
    const cachedTools = this.toolDiscoveryManager.getCachedTools();
    const cachedTool = cachedTools.find(tool => tool.namespacedName === namespacedToolName);
    
    if (!cachedTool) {
      throw new Error(`Tool not found: ${namespacedToolName}. Available tools: ${cachedTools.map(t => t.namespacedName).join(', ')}`);
    }

    // Use OAuth team context to find the correct server instance
    // The serverName in cachedTool contains the full server name (e.g., "context7-john-R36no6FGoMFEZO9nWJJLT")
    // We need to verify this server belongs to the requesting team
    const serverName = cachedTool.serverName;
    const originalToolName = cachedTool.originalName;

    this.logger.info({
      operation: 'mcp_tools_call_routing',
      server_name: serverName,
      server_slug: serverSlug,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      request_id: requestId,
      team_id: teamId
    }, `Routing tool call to server: ${serverName}, tool: ${originalToolName}`);

    // Create JSON-RPC request for external server with original tool name
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: originalToolName,
        arguments: toolArgs || {}
      }
    };

    // Create proxy context
    const proxyContext: ProxyRequestContext = {
      method: 'tools/call',
      requestId: String(requestId),
      transport: 'streamable-http',
      serverName: serverName
    };

    // Proxy request to external MCP server
    const proxyResult = await this.httpProxyManager.proxyMcpJsonRpcRequest(
      serverName,
      jsonRpcRequest,
      proxyContext
    );

    if (!proxyResult.success) {
      throw new Error(`Proxy request failed: ${proxyResult.error}`);
    }

    // Return the result from the external MCP server
    // The external server should return a JSON-RPC response, we want just the result
    const externalResponse = proxyResult.data as any;
    
    if (externalResponse.error) {
      throw new Error(`External MCP server error: ${externalResponse.error.message}`);
    }

    this.logger.info({
      operation: 'mcp_tools_call_success',
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      request_id: requestId,
      response_time_ms: proxyResult.responseTime
    }, `Tool call successful: ${namespacedToolName} -> ${serverName}.${originalToolName} (${proxyResult.responseTime}ms)`);

    // Return the result from the external server
    return externalResponse.result || externalResponse;
  }

  /**
   * Handle resources/list request - return empty for now
   */
  private async handleResourcesList(): Promise<any> {
    this.logger.debug({
      operation: 'mcp_resources_list'
    }, 'Listing resources (empty)');

    return { resources: [] };
  }

  /**
   * Handle resources/templates/list request - return empty for now
   */
  private async handleResourceTemplatesList(): Promise<any> {
    this.logger.debug({
      operation: 'mcp_resource_templates_list'
    }, 'Listing resource templates (empty)');

    return { resourceTemplates: [] };
  }

  /**
   * Handle prompts/list request - return empty for now
   */
  private async handlePromptsList(): Promise<any> {
    this.logger.debug({
      operation: 'mcp_prompts_list'
    }, 'Listing prompts (empty)');

    return { prompts: [] };
  }

  /**
   * Check if method is supported
   */
  isSupportedMethod(method: string): boolean {
    const supportedMethods = [
      'initialize',
      'tools/list',
      'tools/call',
      'resources/list',
      'resources/templates/list',
      'prompts/list'
    ];

    return supportedMethods.includes(method);
  }

  /**
   * Get handler statistics
   */
  getStats() {
    const proxyStats = this.httpProxyManager.getProxyStats();
    
    return {
      supported_methods: [
        'initialize',
        'tools/list',
        'tools/call',
        'resources/list',
        'resources/templates/list',
        'prompts/list'
      ],
      external_servers: proxyStats.servers,
      total_external_servers: proxyStats.total_servers
    };
  }
}
