/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { HttpProxyManager } from './http-proxy-manager';
import { UnifiedToolDiscoveryManager } from './unified-tool-discovery-manager';
import { ProxyRequestContext } from '../types/mcp-server';
import { ProcessManager } from '../process/manager';

/**
 * MCP Protocol Handler
 * Handles MCP JSON-RPC protocol methods and integrates with HTTP Proxy Manager
 */
export class McpProtocolHandler {
  private logger: FastifyBaseLogger;
  private httpProxyManager: HttpProxyManager;
  private toolDiscoveryManager: UnifiedToolDiscoveryManager;
  private processManager: ProcessManager;

  constructor(
    httpProxyManager: HttpProxyManager, 
    toolDiscoveryManager: UnifiedToolDiscoveryManager, 
    processManager: ProcessManager,
    logger: FastifyBaseLogger
  ) {
    this.httpProxyManager = httpProxyManager;
    this.toolDiscoveryManager = toolDiscoveryManager;
    this.processManager = processManager;
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
        
        case 'notifications/initialized':
          // MCP notification - no response needed, just log and return null
          this.logger.debug({
            operation: 'mcp_notification_initialized',
            session_id: sessionId
          }, 'MCP client sent initialized notification');
          return null; // Notifications don't get responses
        
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
   * Handle tools/list request - returns cached discovered tools from both stdio and remote MCP servers
   * Automatically respawns dormant stdio processes before returning tool list
   */
  private async handleToolsList(): Promise<any> {
    this.logger.debug({
      operation: 'mcp_tools_list'
    }, 'Listing cached discovered tools from stdio and remote MCP servers');

    // Check for dormant stdio processes and respawn them
    await this.respawnDormantProcesses();

    const cachedTools = this.toolDiscoveryManager.getAllTools();
    
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
    }, `Returning ${tools.length} cached tools from stdio and remote MCP servers`);

    this.logger.debug({
      operation: 'mcp_tools_list_debug',
      cached_tools_count: cachedTools.length,
      mapped_tools_count: tools.length,
      result_json: JSON.stringify(result)
    }, 'Debug: tools/list result object');

    return result;
  }

  /**
   * Check for dormant stdio processes and respawn them before tool discovery
   * This ensures tools/list returns complete tool list even if processes were idle
   */
  private async respawnDormantProcesses(): Promise<void> {
    // Get all dormant process configs from RuntimeState
    // We can't rely on tool list since tools are cleared when processes go dormant
    const dormantServers = this.processManager.getAllDormantProcessNames();

    if (dormantServers.length === 0) {
      return; // No dormant processes
    }

    // Respawn dormant processes if any found
    if (dormantServers.length > 0) {
      this.logger.info({
        operation: 'respawning_dormant_processes',
        dormant_count: dormantServers.length,
        dormant_servers: dormantServers
      }, `Found ${dormantServers.length} dormant stdio processes - respawning before tools/list`);

      const respawnPromises = dormantServers.map(async (serverName) => {
        try {
          const startTime = Date.now();
          
          // This will check dormant map and respawn if needed
          const processInfo = await this.processManager.getOrRespawnProcess(serverName);
          
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

      // Wait for all respawns to complete
      await Promise.all(respawnPromises);

      this.logger.info({
        operation: 'dormant_processes_respawned',
        respawned_count: dormantServers.length
      }, `Completed respawning ${dormantServers.length} dormant processes`);
    }
  }

  /**
   * Handle tools/call request - route namespaced tool calls to appropriate MCP server
   * Routes to stdio ProcessManager or HTTP proxy based on transport type
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
      server_slug: serverSlug,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      transport: transport,
      request_id: requestId,
      team_id: teamId
    }, `Routing tool call to ${transport} server: ${serverName}, tool: ${originalToolName}`);

    // Create JSON-RPC request with original tool name
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: originalToolName,
        arguments: toolArgs || {}
      }
    };

    // Route based on transport type
    if (transport === 'stdio') {
      return this.handleStdioToolCall(serverName, originalToolName, namespacedToolName, jsonRpcRequest, requestId);
    } else {
      return this.handleHttpToolCall(serverName, originalToolName, namespacedToolName, jsonRpcRequest, requestId);
    }
  }

  /**
   * Handle tool call for stdio MCP servers via ProcessManager
   */
  private async handleStdioToolCall(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any,
    requestId: any
  ): Promise<any> {
    const startTime = Date.now();

    this.logger.debug({
      operation: 'mcp_stdio_tool_call',
      server_name: serverName,
      original_tool_name: originalToolName,
      request_id: requestId
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
        request_id: requestId,
        error: response.error.message
      }, `stdio tool call failed: ${response.error.message}`);
      
      throw new Error(`stdio MCP server error: ${response.error.message}`);
    }

    this.logger.info({
      operation: 'mcp_stdio_tool_call_success',
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      request_id: requestId,
      response_time_ms: responseTime
    }, `stdio tool call successful: ${namespacedToolName} -> ${serverName}.${originalToolName} (${responseTime}ms)`);

    return response.result || response;
  }

  /**
   * Handle tool call for HTTP/SSE MCP servers via HttpProxyManager
   */
  private async handleHttpToolCall(
    serverName: string,
    originalToolName: string,
    namespacedToolName: string,
    jsonRpcRequest: any,
    requestId: any
  ): Promise<any> {
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
    const externalResponse = proxyResult.data as any;
    
    if (externalResponse.error) {
      throw new Error(`External MCP server error: ${externalResponse.error.message}`);
    }

    this.logger.info({
      operation: 'mcp_http_tool_call_success',
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      request_id: requestId,
      response_time_ms: proxyResult.responseTime
    }, `HTTP tool call successful: ${namespacedToolName} -> ${serverName}.${originalToolName} (${proxyResult.responseTime}ms)`);

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
      'notifications/initialized',
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
        'notifications/initialized',
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
