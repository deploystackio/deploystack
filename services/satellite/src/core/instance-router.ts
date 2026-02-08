/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { FastifyInstance, FastifyRequest, FastifyReply, FastifyBaseLogger } from 'fastify';
import { createHash } from 'crypto';
import { McpToolExecutor } from '../lib/mcp-tool-executor';
import { McpSessionManager } from '../lib/mcp-session-manager';
import { UnifiedToolDiscoveryManager } from '../services/unified-tool-discovery-manager';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { ProcessManager } from '../process';
import { McpServerConfig } from '../services/command-polling-service';

interface InstanceContext {
  processId: string;
  serverConfig: McpServerConfig;
  instancePath: string;
}

/**
 * Instance Router
 *
 * Provides direct MCP endpoint for individual instances via path-based routing.
 * Unlike the hierarchical router which uses meta-tools for discovery/execution,
 * this router exposes ALL tools from a specific instance directly.
 *
 * Routes: /i/:instancePath/mcp?token=<instance_token>
 *
 * Authentication: SHA-256 hash comparison of instance token
 * Session Management: Separate session namespace from hierarchical router
 * Tool Execution: Shared McpToolExecutor for consistent behavior
 */
export class InstanceRouter {
  private logger: FastifyBaseLogger;
  private toolExecutor: McpToolExecutor;
  private sessionManager: McpSessionManager;
  private configManager: DynamicConfigManager;
  private toolDiscoveryManager: UnifiedToolDiscoveryManager;
  private processManager: ProcessManager;

  constructor(deps: {
    logger: FastifyBaseLogger;
    toolExecutor: McpToolExecutor;
    sessionManager: McpSessionManager;
    configManager: DynamicConfigManager;
    toolDiscoveryManager: UnifiedToolDiscoveryManager;
    processManager: ProcessManager;
  }) {
    this.logger = deps.logger.child({ component: 'InstanceRouter' });
    this.toolExecutor = deps.toolExecutor;
    this.sessionManager = deps.sessionManager;
    this.configManager = deps.configManager;
    this.toolDiscoveryManager = deps.toolDiscoveryManager;
    this.processManager = deps.processManager;
  }

  /**
   * Setup MCP server for a specific instance
   * Returns ALL tools from this instance directly (not meta-tools)
   */
  setupInstanceMcpServer(server: Server, processId: string): void {
    // Register tools/list handler - return ALL tools from this instance
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = this.toolDiscoveryManager.getAllTools();

      // Filter to only tools from THIS instance's process
      const instanceTools = allTools.filter(tool => tool.serverName === processId);

      this.logger.info({
        operation: 'instance_tools_list',
        process_id: processId,
        tool_count: instanceTools.length
      }, `Listing ${instanceTools.length} tools for instance ${processId}`);

      // Return actual tool definitions (NOT meta-tools, NO namespacing)
      return {
        tools: instanceTools.map(tool => ({
          name: tool.originalName, // Original tool name (NOT namespaced)
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Register tools/call handler - execute on THIS instance
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: toolArgs } = request.params;

      this.logger.info({
        operation: 'instance_tool_call',
        process_id: processId,
        tool_name: toolName
      }, `Executing tool ${toolName} on instance ${processId}`);

      // Execute tool on this specific instance
      // Need to convert tool name to namespaced format for executor
      const namespacedToolName = `${processId}:${toolName}`;

      const result = await this.toolExecutor.executeToolCall(
        namespacedToolName,
        toolArgs || {},
        processId // Force routing to this specific process
      );

      return result;
    });

    this.logger.info({
      operation: 'instance_mcp_server_setup',
      process_id: processId
    }, `Instance MCP server setup complete for ${processId}`);
  }

  /**
   * Find instance by path slug
   */
  private findInstanceByPath(instancePath: string): { processId: string; config: McpServerConfig } | null {
    const allConfigs = this.configManager.getEnabledMcpServers();

    for (const [processId, config] of Object.entries(allConfigs)) {
      if (config.instance_path === instancePath) {
        return { processId, config };
      }
    }

    return null;
  }

  /**
   * Validate instance token
   */
  private validateInstanceToken(
    token: string,
    expectedHash: string
  ): boolean {
    // Hash the incoming token
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Compare with stored hash
    return tokenHash === expectedHash;
  }

  /**
   * Create JSON-RPC error response
   */
  private createJsonRpcError(code: number, message: string) {
    return {
      jsonrpc: '2.0' as const,
      error: { code, message },
      id: null,
    };
  }

  /**
   * Respawn dormant process if needed
   */
  private async ensureProcessActive(processId: string, serverConfig: McpServerConfig): Promise<void> {
    // Only relevant for stdio processes
    if (serverConfig.transport_type !== 'stdio' && serverConfig.type !== 'stdio') {
      return;
    }

    try {
      await this.processManager.getOrRespawnProcess(processId);

      this.logger.debug({
        operation: 'instance_process_ensured_active',
        process_id: processId
      }, `Ensured process ${processId} is active for instance request`);
    } catch (error) {
      this.logger.warn({
        operation: 'instance_process_respawn_failed',
        process_id: processId,
        error: error instanceof Error ? error.message : String(error)
      }, `Failed to ensure process ${processId} is active, continuing anyway`);
    }
  }

  /**
   * Register Fastify routes for path-based instance access
   */
  setupRoutes(fastify: FastifyInstance): void {
    // Shared authentication middleware for all instance routes
    const authenticateInstance = async (request: FastifyRequest, reply: FastifyReply) => {
      const { instancePath } = request.params as { instancePath: string };
      const { token } = request.query as { token?: string };

      // 1. Find instance by path
      const instanceConfig = this.findInstanceByPath(instancePath);
      if (!instanceConfig) {
        return reply.status(404).type('application/json').send(
          JSON.stringify(this.createJsonRpcError(-32004, 'Instance not found'))
        );
      }

      // 2. Validate token exists
      if (!token || !token.startsWith('ds_inst_')) {
        return reply.status(401).type('application/json').send(
          JSON.stringify(this.createJsonRpcError(-32001, 'Missing or invalid token format'))
        );
      }

      // 3. Validate token hash
      if (!instanceConfig.config.instance_token_hash) {
        this.logger.error({
          operation: 'instance_auth_missing_hash',
          instance_path: instancePath,
          process_id: instanceConfig.processId
        }, 'Instance config missing token hash');

        return reply.status(500).type('application/json').send(
          JSON.stringify(this.createJsonRpcError(-32000, 'Instance authentication not configured'))
        );
      }

      const isValid = this.validateInstanceToken(token, instanceConfig.config.instance_token_hash);
      if (!isValid) {
        this.logger.warn({
          operation: 'instance_auth_failed',
          instance_path: instancePath,
          process_id: instanceConfig.processId
        }, 'Invalid instance token');

        return reply.status(401).type('application/json').send(
          JSON.stringify(this.createJsonRpcError(-32001, 'Invalid token'))
        );
      }

      // 4. Store authenticated context on request
      (request as any).instanceAuth = {
        processId: instanceConfig.processId,
        serverConfig: instanceConfig.config,
        instancePath: instancePath
      } as InstanceContext;

      this.logger.debug({
        operation: 'instance_auth_success',
        instance_path: instancePath,
        process_id: instanceConfig.processId
      }, 'Instance authentication successful');
    };

    // POST /i/:instancePath/mcp - Client-to-server MCP messages
    fastify.post('/i/:instancePath/mcp', {
      preValidation: authenticateInstance
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { processId, serverConfig } = (request as any).instanceAuth as InstanceContext;
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      const requestBody = request.body as any;
      const isInitRequest = requestBody?.method === 'initialize';

      this.logger.info({
        operation: 'instance_mcp_request',
        process_id: processId,
        session_id: sessionId,
        has_session: sessionId ? this.sessionManager.hasSession(sessionId) : false,
        is_initialize: isInitRequest,
        method: requestBody?.method || 'unknown'
      }, 'Processing instance MCP request');

      let transport: StreamableHTTPServerTransport;
      let server: Server;

      // Ensure process is active before creating session
      if (isInitRequest) {
        await this.ensureProcessActive(processId, serverConfig);
      }

      if (sessionId && this.sessionManager.hasSession(sessionId)) {
        // Reuse existing session
        const session = this.sessionManager.getSession(sessionId)!;
        transport = session.transport;
        server = session.server;
      } else if (isInitRequest) {
        // New session
        if (sessionId) {
          this.logger.info({
            operation: 'instance_session_recreate',
            session_id: sessionId,
            process_id: processId
          }, 'Recreating instance session after restart');
        }

        const sessionEntry = this.sessionManager.createSession((server) => {
          this.setupInstanceMcpServer(server, processId);
        });

        transport = sessionEntry.transport;
        server = sessionEntry.server;
        await server.connect(transport);
      } else if (sessionId) {
        // Resurrect stale session
        this.logger.info({
          operation: 'instance_session_resurrection',
          session_id: sessionId,
          process_id: processId
        }, 'Resurrecting instance session');

        await this.ensureProcessActive(processId, serverConfig);

        const sessionEntry = this.sessionManager.createSessionWithId(
          sessionId,
          (server) => {
            this.setupInstanceMcpServer(server, processId);
          }
        );

        transport = sessionEntry.transport;
        server = sessionEntry.server;
        await server.connect(transport);

        // Bootstrap transport with synthetic initialize
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

        const mockRes = {
          writeHead: () => mockRes,
          write: () => true,
          end: () => mockRes,
          setHeader: () => mockRes,
          socket: request.raw.socket,
          statusCode: 200,
          statusMessage: 'OK',
          headersSent: false,
        };

        await transport.handleRequest(request.raw as any, mockRes as any, syntheticInitRequest);
      } else {
        // No session ID - reject
        reply.code(400).send(this.createJsonRpcError(-32000, 'No session ID provided'));
        return;
      }

      // Handle the request
      await transport.handleRequest(request.raw, reply.raw, request.body);
    });

    // GET /i/:instancePath/mcp - SSE for server-to-client notifications
    fastify.get('/i/:instancePath/mcp', {
      preValidation: authenticateInstance
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !this.sessionManager.hasSession(sessionId)) {
        reply.code(400).send('Invalid or missing session ID');
        return;
      }

      const session = this.sessionManager.getSession(sessionId)!;
      await session.transport.handleRequest(request.raw, reply.raw);
    });

    // DELETE /i/:instancePath/mcp - Session termination
    fastify.delete('/i/:instancePath/mcp', {
      preValidation: authenticateInstance
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !this.sessionManager.hasSession(sessionId)) {
        reply.code(400).send('Invalid or missing session ID');
        return;
      }

      const session = this.sessionManager.getSession(sessionId)!;
      await session.transport.handleRequest(request.raw, reply.raw);
    });

    this.logger.info({
      operation: 'instance_routes_registered'
    }, 'Instance router routes registered at /i/:instancePath/mcp');
  }
}
