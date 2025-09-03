/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

import chalk from 'chalk';
import { ProcessManager, ProcessInfo } from '../process/manager';
import { MCPConfigService } from '../mcp';
import { CredentialStorage } from '../auth/storage';
import { TeamMCPConfig, MCPServerConfig } from '../../types/mcp';
import { StreamableHTTPHandler } from './streamable-http-handler';
import { SessionManager } from './session-manager';
import { SSEHandler } from './sse-handler';
import { ToolDiscoveryManager } from '../../utils/tool-discovery-manager';
import { logger } from '../../utils/logger';

export interface ProxyServerOptions {
  port?: number;
  host?: string;
}

export class ProxyServer {
  private fastify: FastifyInstance;
  private processManager: ProcessManager;
  private mcpConfigService: MCPConfigService;
  private toolDiscoveryManager: ToolDiscoveryManager;
  private credentialStorage: CredentialStorage;
  private streamableHandler: StreamableHTTPHandler;
  private sessionManager: SessionManager;
  private sseHandler: SSEHandler;
  private isRunning = false;
  private teamConfig: TeamMCPConfig | null = null;

  constructor(
    processManager?: ProcessManager,
    mcpConfigService?: MCPConfigService,
    credentialStorage?: CredentialStorage
  ) {
    // Use provided instances or create new ones (for backward compatibility)
    this.processManager = processManager || new ProcessManager();
    this.mcpConfigService = mcpConfigService || new MCPConfigService();
    this.credentialStorage = credentialStorage || new CredentialStorage();
    this.toolDiscoveryManager = new ToolDiscoveryManager();
    this.streamableHandler = new StreamableHTTPHandler();
    this.sessionManager = new SessionManager();
    this.sseHandler = new SSEHandler(this.sessionManager);

    this.fastify = Fastify({
      logger: false, // We'll handle logging ourselves
      keepAliveTimeout: 65000,
      requestTimeout: 30000,
      bodyLimit: 1048576 // 1MB
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  /**
   * Start the proxy server
   */
  async start(port: number = 9095, host: string = 'localhost'): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    try {
      // Load team MCP configuration
      await this.loadTeamConfig();

      // Start the HTTP server
      await this.fastify.listen({ port, host });
      this.isRunning = true;

      console.log(chalk.green(`🚀 DeployStack Gateway listening at:`));
      console.log(chalk.blue(`   📡 SSE endpoint: http://${host}:${port}/sse`));
      console.log(chalk.blue(`   📡 Messages: http://${host}:${port}/message`));
      console.log(chalk.blue(`   📡 MCP endpoint: http://${host}:${port}/mcp`));
      console.log(chalk.gray(`   📊 Health check: http://${host}:${port}/health`));
      
      if (this.teamConfig) {
        console.log(chalk.blue(`🤖 Ready to serve ${this.teamConfig.servers.length} MCP server${this.teamConfig.servers.length === 1 ? '' : 's'} for team: ${this.teamConfig.team_name}`));
      } else {
        console.log(chalk.yellow('⚠️  No MCP configuration found - run "deploystack mcp --refresh" to download team configurations'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to start server:'), error);
      throw error;
    }
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log(chalk.yellow('🛑 Shutting down DeployStack Gateway...'));

    try {
      // Clean up all sessions
      this.streamableHandler.cleanupAllSessions();
      this.sessionManager.cleanupAllSessions();

      // Terminate all MCP processes
      await this.processManager.terminateAllProcesses();

      // Close HTTP server
      await this.fastify.close();
      this.isRunning = false;

      console.log(chalk.green('✅ DeployStack Gateway stopped successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Error during shutdown:'), error);
      throw error;
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    const processes = this.processManager.getAllProcesses();
    
    return {
      isRunning: this.isRunning,
      teamConfig: this.teamConfig ? {
        teamId: this.teamConfig.team_id,
        teamName: this.teamConfig.team_name,
        serverCount: this.teamConfig.servers.length,
        lastUpdated: this.teamConfig.last_updated
      } : null,
      processes: processes.map(p => ({
        id: p.id,
        name: p.config.installation_name,
        status: p.status,
        runtime: p.config.runtime,
        uptime: Date.now() - p.startTime,
        messageCount: p.messageCount,
        errorCount: p.errorCount,
        lastActivity: p.lastActivity
      }))
    };
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security headers - simplified to avoid TypeScript issues
    this.fastify.register(helmet as any);

    // CORS configuration
    this.fastify.register(cors as any, {
      origin: ['http://localhost:3000', 'https://claude.ai'],
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Accept',
        'Mcp-Session-Id',
        'Last-Event-ID'
      ],
      credentials: false
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Add request logging
    this.fastify.addHook('onRequest', async (request) => {
      console.log(chalk.blue(`📥 ${request.method} ${request.url}`));
      if (request.headers['user-agent']) {
        console.log(chalk.gray(`   User-Agent: ${request.headers['user-agent']}`));
      }
    });

    // Health check endpoint
    this.fastify.get('/health', async () => {
      const status = this.getStatus();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        gateway: status
      };
    });

    // SSE endpoint - GET for establishing SSE connections
    this.fastify.get('/sse', async (request, reply) => {
      await this.sseHandler.establishConnection(request, reply);
    });

    // Message endpoint - POST for sending messages via SSE transport
    this.fastify.post('/message', async (request, reply) => {
      await this.handleMessageRequest(request, reply);
    });

    // Unified MCP endpoint - supports both POST and GET for Streamable HTTP
    this.fastify.all('/mcp', async (request, reply) => {
      await this.handleMcpRequest(request, reply);
    });

    // Status endpoint
    this.fastify.get('/status', async () => {
      return this.getStatus();
    });

    // MCP Server Management API endpoints for selective restart
    this.fastify.post('/api/mcp/servers', async (request, reply) => {
      await this.handleAddServer(request, reply);
    });

    this.fastify.delete('/api/mcp/servers/:serverName', async (request, reply) => {
      await this.handleRemoveServer(request, reply);
    });

    this.fastify.post('/api/mcp/servers/:serverName/restart', async (request, reply) => {
      await this.handleRestartServer(request, reply);
    });

    // Logs streaming endpoint - real-time log streaming via SSE
    this.fastify.get('/logs/stream', async (request, reply) => {
      await this.handleLogsStream(request, reply);
    });

    // Root endpoint - helpful information about available endpoints
    this.fastify.get('/', async () => {
      return {
        name: 'DeployStack Gateway',
        version: '1.0.0',
        description: 'Enterprise MCP Gateway with Streamable HTTP transport',
        endpoints: {
          sse: '/sse (GET) - SSE connection endpoint for legacy MCP clients',
          message: '/message (POST) - Message sending endpoint for SSE transport',
          mcp: '/mcp (GET/POST) - Unified MCP endpoint with Streamable HTTP support',
          health: '/health (GET) - Health check and status information',
          status: '/status (GET) - Detailed gateway status'
        },
        usage: {
          legacy: 'Use http://localhost:9095/sse + http://localhost:9095/message for SSE transport',
          modern: 'Use http://localhost:9095/mcp for Streamable HTTP transport'
        },
        specification: 'MCP 2025-03-26 with dual transport support (SSE + Streamable HTTP)'
      };
    });
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    this.fastify.setErrorHandler(async (error, request, reply) => {
      const jsonRpcId = (request.body as any)?.id || null;

      console.error(chalk.red('Request error:'), error);

      if (error.statusCode === 400) {
        reply.code(400);
        return {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request'
          },
          id: jsonRpcId
        };
      }

      if (error.statusCode === 429) {
        reply.code(429);
        return {
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'Rate limit exceeded'
          },
          id: jsonRpcId
        };
      }

      // Default server error
      reply.code(500);
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: jsonRpcId
      };
    });

    this.fastify.setNotFoundHandler(async (request, reply) => {
      reply.code(404);
      return {
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        statusCode: 404
      };
    });
  }

  /**
   * Handle message requests for SSE transport
   */
  private async handleMessageRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const message = request.body as any;
    const query = request.query as any;
    const sessionId = query.session as string;

    logger.info(`SSE message request: ${message?.method}`, 'sse', {
      sessionId,
      method: message?.method,
      messageId: message?.id,
      userAgent: request.headers['user-agent']
    });

    if (!sessionId) {
      reply.code(400).send({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Missing session parameter'
        },
        id: message?.id || null
      });
      return;
    }

    // Validate session exists
    if (!this.sessionManager.getSession(sessionId)) {
      reply.code(404).send({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Session not found'
        },
        id: message?.id || null
      });
      return;
    }

    try {
      // Process the JSON-RPC message using the same logic as MCP endpoint
      let response: any;

      // Handle different MCP methods
      if (message.method === 'initialize') {
        response = await this.handleInitializeSSE(message, sessionId, reply);
        return; // Initialize handles its own response
      } else if (message.method === 'notifications/initialized') {
        // Handle initialized notification - no response needed for notifications
        logger.info(`SSE client initialized: ${sessionId}`, 'sse', { sessionId });
        reply.code(202).send({ status: 'accepted', messageId: message.id });
        return;
      } else if (message.method === 'tools/list') {
        response = await this.handleToolsList(message);
      } else if (message.method === 'tools/call') {
        response = await this.handleToolCall(message);
      } else if (message.method === 'resources/list') {
        response = await this.handleResourcesList(message);
      } else if (message.method === 'resources/templates/list') {
        response = await this.handleResourceTemplatesList(message);
      } else if (message.method === 'prompts/list') {
        response = await this.handlePromptsList(message);
      } else {
        // Forward to appropriate MCP server
        response = await this.forwardToMcpServer(message);
      }

      // Send response via SSE
      const success = this.sseHandler.sendMessage(sessionId, response);
      
      if (success) {
        reply.code(200).send({ status: 'sent', messageId: message.id });
      } else {
        reply.code(500).send({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Failed to send message via SSE'
          },
          id: message.id
        });
      }

    } catch (error) {
      logger.error(`SSE message handling error: ${error instanceof Error ? error.message : String(error)}`, 'sse', {
        sessionId,
        method: message?.method,
        error: error instanceof Error ? error.message : String(error)
      });
      
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error)
        },
        id: message?.id || null
      };

      // Try to send error via SSE, fallback to HTTP response
      const success = this.sseHandler.sendError(sessionId, errorResponse);
      
      if (!success) {
        reply.code(500).send(errorResponse);
      } else {
        reply.code(500).send({ status: 'error_sent', messageId: message?.id });
      }
    }
  }

  /**
   * Handle MCP initialize request for SSE transport
   */
  private async handleInitializeSSE(
    message: any, 
    sessionId: string, 
    reply: FastifyReply
  ): Promise<void> {
    const initResponse = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        serverInfo: {
          name: 'deploystack-gateway',
          version: '1.0.0'
        },
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: false },
          resources: {},
          prompts: {}
        }
      }
    };

    // Send response via SSE
    const success = this.sseHandler.sendMessage(sessionId, initResponse);
    
    if (success) {
      reply.code(200).send({ status: 'initialized', sessionId });
    } else {
      reply.code(500).send({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Failed to send initialize response via SSE'
        },
        id: message.id
      });
    }
  }

  /**
   * Handle unified MCP endpoint requests
   */
  private async handleMcpRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const method = request.method;
    const message = request.body as any;
    const sessionId = request.headers['mcp-session-id'] as string;
    const acceptHeader = request.headers.accept || '';

    console.log(chalk.blue(`[MCP] ${method} request, method: ${message?.method}, session: ${sessionId || 'none'}`));

    try {
      if (method === 'GET') {
        // GET request - establish SSE stream for server-to-client communication
        await this.streamableHandler.handleMcpEndpoint(request, reply);
        return;
      }

      if (method === 'POST') {
        // POST request - handle JSON-RPC messages
        await this.handleJsonRpcMessage(message, sessionId, acceptHeader, reply);
        return;
      }

      // Other methods not supported
      reply.code(405).send({ error: 'Method Not Allowed' });
    } catch (error) {
      console.error(chalk.red('[MCP] Error handling request:'), error);
      
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error)
        },
        id: message?.id || null
      };

      if (sessionId) {
        this.streamableHandler.incrementSessionErrorCount(sessionId);
      }

      reply.code(500).send(errorResponse);
    }
  }

  /**
   * Handle JSON-RPC message processing
   */
  private async handleJsonRpcMessage(
    message: any,
    sessionId: string | undefined,
    acceptHeader: string,
    reply: FastifyReply
  ): Promise<void> {
    // Validate JSON-RPC format
    if (!message || message.jsonrpc !== '2.0' || !message.method) {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request'
        },
        id: message?.id || null
      };
      reply.code(400).send(errorResponse);
      return;
    }

    // Update session activity if session exists
    if (sessionId) {
      this.streamableHandler.updateSessionActivity(sessionId);
    }

    let response: any;

    // Handle different MCP methods
    if (message.method === 'initialize') {
      response = await this.handleInitialize(message, sessionId, reply);
      return; // Initialize handles its own response
    } else if (message.method === 'notifications/initialized') {
      // Handle initialized notification - no response needed for notifications
      console.log(chalk.green(`[MCP] Client initialized: ${sessionId || 'no-session'}`));
      reply.code(202).send({ status: 'accepted', messageId: message.id });
      return;
    } else if (message.method === 'tools/list') {
      response = await this.handleToolsList(message);
    } else if (message.method === 'tools/call') {
      response = await this.handleToolCall(message);
    } else if (message.method === 'resources/list') {
      response = await this.handleResourcesList(message);
    } else if (message.method === 'resources/templates/list') {
      response = await this.handleResourceTemplatesList(message);
    } else if (message.method === 'prompts/list') {
      response = await this.handlePromptsList(message);
    } else {
      // Forward to appropriate MCP server
      response = await this.forwardToMcpServer(message);
    }

    // Determine response mode based on Accept header
    const wantsStreaming = acceptHeader.includes('text/event-stream');
    
    if (wantsStreaming) {
      // Return SSE stream for streaming responses
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      this.streamableHandler.sendSSEMessage(reply, response, 'message');
    } else {
      // Return standard HTTP JSON response
      reply.code(200).send(response);
    }
  }

  /**
   * Handle MCP initialize request
   */
  private async handleInitialize(
    message: any, 
    sessionId: string | undefined, 
    reply: FastifyReply
  ): Promise<void> {
    let actualSessionId = sessionId;
    
    // Create new session if none provided
    if (!actualSessionId) {
      actualSessionId = `session-${Date.now()}`;
      console.log(chalk.blue(`[MCP] Created session: ${actualSessionId}`));
    }

    const initResponse = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        serverInfo: {
          name: 'deploystack-gateway',
          version: '1.0.0'
        },
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: false },
          resources: {},
          prompts: {}
        }
      }
    };

    // Set session ID header in response
    reply.header('Mcp-Session-Id', actualSessionId);
    reply.code(200).send(initResponse);
  }

  /**
   * Handle tools/list request - return actual MCP tools with namespacing
   */
  private async handleToolsList(message: any): Promise<any> {
    if (!this.teamConfig || this.teamConfig.servers.length === 0) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: []
        }
      };
    }

    const allTools: any[] = [];

    // Get cached tools for the team
    const cachedTools = await this.toolDiscoveryManager.getCachedTeamTools(this.teamConfig.team_id);
    
    if (cachedTools.length > 0) {
      // Use cached tools
      console.log(chalk.gray(`📋 Using cached tools (${cachedTools.length} tools from cache)`));
      
      for (const tool of cachedTools) {
        allTools.push({
          name: tool.namespacedName,
          description: `[${tool.serverName}] ${tool.description}`,
          inputSchema: tool.inputSchema
        });
      }
    } else {
      // No cached tools, try to discover tools from each server
      console.log(chalk.yellow(`⚠️  No cached tools found, attempting live discovery...`));
      
      for (const serverConfig of this.teamConfig.servers) {
        try {
          // Try to get cached tools for this specific server
          const serverTools = await this.toolDiscoveryManager.getCachedServerTools(
            this.teamConfig.team_id, 
            serverConfig.installation_name
          );
          
          if (serverTools && serverTools.length > 0) {
            // Use cached server tools
            for (const tool of serverTools) {
              allTools.push({
                name: `${serverConfig.installation_name}-${tool.name}`,
                description: `[${serverConfig.installation_name}] ${tool.description}`,
                inputSchema: tool.inputSchema
              });
            }
          } else {
            // No cached tools for this server, try live discovery
            try {
              const freshTools = await this.toolDiscoveryManager.discoverServerTools(
                this.teamConfig.team_id,
                this.teamConfig.team_name,
                serverConfig,
                {
                  showProgress: false,
                  forceRefresh: true
                }
              );
              
              for (const tool of freshTools) {
                allTools.push({
                  name: `${serverConfig.installation_name}-${tool.name}`,
                  description: `[${serverConfig.installation_name}] ${tool.description}`,
                  inputSchema: tool.inputSchema
                });
              }
              
              console.log(chalk.green(`✅ Discovered ${freshTools.length} tools from ${serverConfig.installation_name}`));
            } catch (error) {
              console.warn(chalk.yellow(`⚠️  Failed to discover tools from ${serverConfig.installation_name}: ${error instanceof Error ? error.message : String(error)}`));
              
              // Add a fallback server management tool
              allTools.push({
                name: serverConfig.installation_name,
                description: `${serverConfig.installation_name} MCP server (tool discovery failed)`,
                inputSchema: {
                  type: "object",
                  properties: {
                    action: {
                      type: "string",
                      enum: ["enable", "disable", "status"],
                      description: "Action to perform on the MCP server"
                    }
                  },
                  required: ["action"]
                }
              });
            }
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  Error processing server ${serverConfig.installation_name}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }

    console.log(chalk.blue(`🛠️  Exposing ${allTools.length} tools to MCP client`));

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: allTools
      }
    };
  }

  /**
   * Handle tools/call request - route namespaced tool calls to appropriate MCP servers
   */
  private async handleToolCall(message: any): Promise<any> {
    const toolName = message.params?.name;
    if (!toolName) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid params: missing tool name'
        },
        id: message.id
      };
    }

    console.log(chalk.blue(`🔧 Tool call: ${toolName}`));

    // Handle namespaced tools (serverName-toolName)
    const dashIndex = toolName.lastIndexOf('-');
    if (dashIndex > 0) {
      const serverName = toolName.substring(0, dashIndex);
      const originalToolName = toolName.substring(dashIndex + 1);
      
      const serverConfig = this.teamConfig?.servers.find(s => s.installation_name === serverName);
      if (!serverConfig) {
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: server ${serverName} not found`
          },
          id: message.id
        };
      }

      try {
        console.log(chalk.gray(`   Routing to server: ${serverName}, tool: ${originalToolName}`));
        
        const processInfo = await this.getOrSpawnProcess(serverConfig);
        
        const forwardedMessage = {
          ...message,
          params: {
            ...message.params,
            name: originalToolName
          }
        };

        const response = await this.processManager.sendMessage(processInfo, forwardedMessage);
        
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: response
        };
      } catch (error) {
        console.error(chalk.red(`   Error calling tool ${originalToolName} on ${serverName}:`), error);
        return {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: message.id
        };
      }
    }

    // Handle direct server management tools (fallback server toggles)
    const serverConfig = this.teamConfig?.servers.find(s => s.installation_name === toolName);
    if (serverConfig) {
      const action = message.params?.arguments?.action || 'status';
      
      // Find the installation for description
      const installation = this.teamConfig?.installations.find(
        inst => inst.installation_name === toolName
      );

      try {
        let result: any;
        
        switch (action) {
          case 'enable':
            // Try to spawn the process
            try {
              await this.getOrSpawnProcess(serverConfig);
              result = {
                server: toolName,
                action: 'enabled',
                status: 'running',
                message: `${toolName} MCP server has been enabled and is running`
              };
            } catch (error) {
              result = {
                server: toolName,
                action: 'enable_failed',
                status: 'failed',
                message: `Failed to enable ${toolName}: ${error instanceof Error ? error.message : String(error)}`
              };
            }
            break;
            
          case 'disable':
            // Terminate the process if running
            const processInfo = this.processManager.getProcessByName(toolName);
            if (processInfo) {
              await this.processManager.terminateProcess(processInfo, 5000);
              result = {
                server: toolName,
                action: 'disabled',
                status: 'stopped',
                message: `${toolName} MCP server has been disabled`
              };
            } else {
              result = {
                server: toolName,
                action: 'already_disabled',
                status: 'stopped',
                message: `${toolName} MCP server was already disabled`
              };
            }
            break;
            
          case 'status':
          default:
            // Check process status
            const process = this.processManager.getProcessByName(toolName);
            const isRunning = process && process.status === 'running';
            
            result = {
              server: toolName,
              action: 'status_check',
              status: isRunning ? 'running' : 'stopped',
              description: installation?.server?.description || 'No description available',
              runtime: serverConfig.runtime,
              message: `${toolName} MCP server is ${isRunning ? 'running' : 'stopped'}`,
              uptime: process ? Date.now() - process.startTime : 0,
              messageCount: process?.messageCount || 0,
              errorCount: process?.errorCount || 0
            };
            break;
        }

        return {
          jsonrpc: '2.0',
          id: message.id,
          result: result
        };
        
      } catch (error) {
        return {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: message.id
        };
      }
    }

    // Handle legacy namespaced tools (serverName__toolName) - for backward compatibility
    const parts = toolName.split('__');
    if (parts.length === 2) {
      const [serverName, originalToolName] = parts;
      
      const serverConfig = this.teamConfig?.servers.find(s => s.installation_name === serverName);
      if (!serverConfig) {
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: server ${serverName} not found`
          },
          id: message.id
        };
      }

      try {
        const processInfo = await this.getOrSpawnProcess(serverConfig);
        
        const forwardedMessage = {
          ...message,
          params: {
            ...message.params,
            name: originalToolName
          }
        };

        const response = await this.processManager.sendMessage(processInfo, forwardedMessage);
        
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: response
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: message.id
        };
      }
    }

    // Unknown tool format
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not found: tool "${toolName}" not found. Expected format: serverName-toolName`
      },
      id: message.id
    };
  }

  /**
   * Handle resources/list request - return empty resources for now
   */
  private async handleResourcesList(message: any): Promise<any> {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        resources: []
      }
    };
  }

  /**
   * Handle resources/templates/list request - return empty templates for now
   */
  private async handleResourceTemplatesList(message: any): Promise<any> {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        resourceTemplates: []
      }
    };
  }

  /**
   * Handle prompts/list request - return empty prompts for now
   */
  private async handlePromptsList(message: any): Promise<any> {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        prompts: []
      }
    };
  }

  /**
   * Forward request to MCP server (for other methods)
   */
  private async forwardToMcpServer(message: any): Promise<any> {
    // For now, forward to the first available server
    // TODO: Implement proper routing logic
    if (!this.teamConfig || this.teamConfig.servers.length === 0) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found: no MCP servers available'
        },
        id: message.id
      };
    }

    const serverConfig = this.teamConfig.servers[0];
    const processInfo = await this.getOrSpawnProcess(serverConfig);
    const response = await this.processManager.sendMessage(processInfo, message);
    
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: response
    };
  }

  /**
   * Get existing process or spawn new one
   */
  private async getOrSpawnProcess(serverConfig: MCPServerConfig): Promise<ProcessInfo> {
    let processInfo = this.processManager.getProcessByName(serverConfig.installation_name);
    
    if (!processInfo || processInfo.status !== 'running') {
      processInfo = await this.processManager.spawnProcess(serverConfig);
    }
    
    return processInfo;
  }

  /**
   * Handle logs streaming endpoint - real-time log streaming via SSE
   */
  private async handleLogsStream(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as any;
    const lines = parseInt(query.lines || '50', 10);
    const level = query.level as any;
    const component = query.component as string;

    logger.info('Logs stream connection established', 'proxy', { 
      userAgent: request.headers['user-agent'],
      lines,
      level,
      component 
    });

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send recent logs
    const recentLogs = logger.filterLogs(level, component, lines);
    for (const logEntry of recentLogs) {
      const sseData = `data: ${JSON.stringify(logEntry)}\n\n`;
      reply.raw.write(sseData);
    }

    // Listen for new log entries
    const logHandler = (logEntry: any) => {
      // Apply filters
      if (level) {
        const levelPriority: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
        const minPriority = levelPriority[level];
        const entryPriority = levelPriority[logEntry.level];
        if (entryPriority < minPriority) {
          return;
        }
      }

      if (component && logEntry.component !== component) {
        return;
      }

      // Send log entry via SSE
      const sseData = `data: ${JSON.stringify(logEntry)}\n\n`;
      try {
        reply.raw.write(sseData);
      } catch {
        // Connection closed, remove listener
        logger.removeListener('log', logHandler);
      }
    };

    logger.on('log', logHandler);

    // Handle client disconnect
    request.raw.on('close', () => {
      logger.removeListener('log', logHandler);
      logger.info('Logs stream connection closed', 'proxy');
    });

    request.raw.on('error', () => {
      logger.removeListener('log', logHandler);
      logger.warn('Logs stream connection error', 'proxy');
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        logger.removeListener('log', logHandler);
      }
    }, 30000); // 30 seconds

    // Clean up heartbeat on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
    });
  }

  /**
   * Load team MCP configuration
   */
  private async loadTeamConfig(): Promise<void> {
    try {
      const credentials = await this.credentialStorage.getCredentials();
      if (!credentials?.selectedTeam) {
        console.log(chalk.yellow('⚠️  No team selected - use "deploystack teams --switch <team-number>" to select a team'));
        return;
      }

      this.teamConfig = await this.mcpConfigService.getMCPConfig(credentials.selectedTeam.id);
      
      if (!this.teamConfig) {
        console.log(chalk.yellow('⚠️  No MCP configuration found - use "deploystack mcp --refresh" to download team configurations'));
        return;
      }

      console.log(chalk.blue(`📋 Loaded MCP configuration for team: ${this.teamConfig.team_name}`));
      console.log(chalk.gray(`   Servers available: ${this.teamConfig.servers.map(s => s.installation_name).join(', ')}`));
    } catch (error) {
      console.error(chalk.red('Failed to load team MCP configuration:'), error);
    }
  }

  /**
   * Handle adding a new MCP server (selective restart API)
   */
  private async handleAddServer(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const config = body.config as MCPServerConfig;

      if (!config || !config.installation_name) {
        reply.code(400).send({
          error: 'Invalid request',
          message: 'Missing server configuration'
        });
        return;
      }

      console.log(chalk.blue(`[API] Adding MCP server: ${config.installation_name}`));

      // Check if server already exists
      const existingProcess = this.processManager.getProcessByName(config.installation_name);
      if (existingProcess && existingProcess.status === 'running') {
        reply.code(409).send({
          error: 'Server already exists',
          message: `MCP server ${config.installation_name} is already running`
        });
        return;
      }

      // Spawn the new process
      const processInfo = await this.processManager.spawnProcess(config);
      
      console.log(chalk.green(`[API] Successfully added MCP server: ${config.installation_name}`));

      reply.code(201).send({
        success: true,
        message: `MCP server ${config.installation_name} added successfully`,
        server: {
          name: config.installation_name,
          status: processInfo.status,
          pid: processInfo.process.pid
        }
      });

    } catch (error) {
      console.error(chalk.red(`[API] Error adding server:`), error);
      
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle removing an MCP server (selective restart API)
   */
  private async handleRemoveServer(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const serverName = params.serverName;

      if (!serverName) {
        reply.code(400).send({
          error: 'Invalid request',
          message: 'Missing server name'
        });
        return;
      }

      console.log(chalk.blue(`[API] Removing MCP server: ${serverName}`));

      // Find the process
      const processInfo = this.processManager.getProcessByName(serverName);
      if (!processInfo) {
        reply.code(404).send({
          error: 'Server not found',
          message: `MCP server ${serverName} not found`
        });
        return;
      }

      // Terminate the process
      await this.processManager.terminateProcess(processInfo, 10000);
      
      console.log(chalk.green(`[API] Successfully removed MCP server: ${serverName}`));

      reply.code(200).send({
        success: true,
        message: `MCP server ${serverName} removed successfully`
      });

    } catch (error) {
      console.error(chalk.red(`[API] Error removing server:`), error);
      
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle restarting an MCP server (selective restart API)
   */
  private async handleRestartServer(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const serverName = params.serverName;
      const config = body.config as MCPServerConfig;

      if (!serverName) {
        reply.code(400).send({
          error: 'Invalid request',
          message: 'Missing server name'
        });
        return;
      }

      if (!config || !config.installation_name) {
        reply.code(400).send({
          error: 'Invalid request',
          message: 'Missing server configuration'
        });
        return;
      }

      console.log(chalk.blue(`[API] Restarting MCP server: ${serverName}`));

      // Find the existing process
      const existingProcess = this.processManager.getProcessByName(serverName);
      if (!existingProcess) {
        // Server doesn't exist, just start it
        const processInfo = await this.processManager.spawnProcess(config);
        
        console.log(chalk.green(`[API] Started MCP server: ${serverName} (was not running)`));

        reply.code(200).send({
          success: true,
          message: `MCP server ${serverName} started successfully`,
          server: {
            name: config.installation_name,
            status: processInfo.status,
            pid: processInfo.process.pid
          }
        });
        return;
      }

      // Restart the existing process
      const processInfo = await this.processManager.restartServer(serverName, {
        timeout: 10000,
        showProgress: false
      });
      
      console.log(chalk.green(`[API] Successfully restarted MCP server: ${serverName}`));

      reply.code(200).send({
        success: true,
        message: `MCP server ${serverName} restarted successfully`,
        server: {
          name: config.installation_name,
          status: processInfo.status,
          pid: processInfo.process.pid
        }
      });

    } catch (error) {
      console.error(chalk.red(`[API] Error restarting server:`), error);
      
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
