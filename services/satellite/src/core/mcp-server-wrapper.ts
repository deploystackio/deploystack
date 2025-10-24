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

/**
 * MCP Server Wrapper
 * Wraps the official MCP SDK server with existing Fastify server and business logic
 */
export class McpServerWrapper {
  private logger: FastifyBaseLogger;
  private toolDiscoveryManager?: UnifiedToolDiscoveryManager;
  private processManager?: ProcessManager;
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
    processManager: ProcessManager
  ): void {
    this.toolDiscoveryManager = toolDiscoveryManager;
    this.processManager = processManager;
    
    this.logger.debug({
      operation: 'mcp_dependencies_set'
    }, 'MCP server dependencies set');
  }

  /**
   * Setup low-level MCP server with manual request handlers
   * This bypasses registerTool to avoid Zod validation issues with dynamic schemas
   */
  private setupMcpServer(server: Server): void {
    if (!this.toolDiscoveryManager) {
      return;
    }

    const cachedTools = this.toolDiscoveryManager.getAllTools();
    
    this.logger.debug({
      operation: 'mcp_server_setup',
      tool_count: cachedTools.length
    }, `Setting up low-level MCP server with ${cachedTools.length} tools`);

    // Handle tools/list - return JSON Schema directly
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug({
        operation: 'tools_list_request'
      }, 'Handling tools/list request');

      // Check for dormant stdio processes and respawn them
      await this.respawnDormantProcesses();

      const tools = this.toolDiscoveryManager!.getAllTools().map(tool => ({
        name: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema  // Return JSON Schema as-is
      }));

      this.logger.info({
        operation: 'tools_list_response',
        tool_count: tools.length
      }, `Returning ${tools.length} tools`);

      return { tools };
    });

    // Handle tools/call - no validation, direct proxy
    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const toolName = request.params?.name;
      const toolArgs = request.params?.arguments || {};

      this.logger.info({
        operation: 'tools_call_request',
        tool_name: toolName,
        args: toolArgs
      }, `Handling tools/call for ${toolName}`);

      return await this.executeToolCall(toolName, toolArgs);
    });

    this.logger.info({
      operation: 'mcp_server_setup_complete',
      tool_count: cachedTools.length
    }, `MCP server setup complete with ${cachedTools.length} tools`);
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
    _jsonRpcRequest: any
  ): Promise<any> {
    if (!this.toolDiscoveryManager) {
      throw new Error('Tool discovery manager not available');
    }

    this.logger.debug({
      operation: 'mcp_http_tool_call',
      server_name: serverName,
      original_tool_name: originalToolName
    }, `Sending tool call to HTTP server: ${serverName}`);

    // Get server configuration for URL
    const cachedTool = this.toolDiscoveryManager.getTool(namespacedToolName);
    if (!cachedTool) {
      throw new Error(`Tool not found in cache: ${namespacedToolName}`);
    }

    // We need to get the server URL from configuration
    // This is a bit tricky since we don't have direct access to config manager
    // For now, we'll use a placeholder approach that should be replaced with proper config access
    throw new Error(`HTTP tool calls require configuration access refactoring: ${namespacedToolName}`);
  }

  /**
   * Setup Fastify routes for MCP transport
   */
  setupRoutes(fastify: FastifyInstance): void {
    // Handle POST requests for client-to-server communication
    fastify.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;
      let server: Server;

      if (sessionId && this.transports.has(sessionId)) {
        // Reuse existing transport and server
        const session = this.transports.get(sessionId)!;
        transport = session.transport;
        server = session.server;
      } else if (!sessionId && isInitializeRequest(request.body)) {
        // New initialization request - create low-level Server
        server = new Server(
          {
            name: 'deploystack-satellite',
            version: '1.0.0'
          },
          {
            capabilities: {
              tools: {}  // Declare tools capability
            }
          }
        );

        // Check for dormant stdio processes and respawn them
        await this.respawnDormantProcesses();

        // Setup MCP server with discovered tools
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
      } else {
        // Invalid request
        reply.code(400).send({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
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
    }, 'MCP transport routes setup with official SDK');
  }



  /**
   * Get transport statistics
   */
  getStats() {
    return {
      active_sessions: this.transports.size,
      server_info: {
        name: 'deploystack-satellite',
        version: '1.0.0',
        sdk_version: '@modelcontextprotocol/sdk@1.20.1',
        mode: 'low-level-server'
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
