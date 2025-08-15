/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';

import type { FastifyCorsOptions } from '@fastify/cors';

import chalk from 'chalk';
import { ProcessManager, ProcessInfo } from '../process/manager';
import { MCPConfigService } from '../mcp';
import { CredentialStorage } from '../auth/storage';
import { TeamMCPConfig, MCPServerConfig } from '../../types/mcp';
import { SessionManager } from './session-manager';
import { SSEHandler } from './sse-handler';
import { ToolDiscoveryManager } from '../../utils/tool-discovery-manager';

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
      console.log(chalk.blue(`   📨 Messages: http://${host}:${port}/message`));
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
    this.fastify.register(require('@fastify/cors'), {
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

    // SSE endpoint - establishes SSE connection for VS Code compatibility
    this.fastify.get('/sse', async (request, reply) => {
      await this.sseHandler.establishConnection(request, reply);
    });

    // Messages endpoint - handles JSON-RPC requests with session context
    this.fastify.post('/message', async (request, reply) => {
      return this.handleSessionMessage(request, reply);
    });

    // Status endpoint
    this.fastify.get('/status', async () => {
      return this.getStatus();
    });

    // Root endpoint - helpful information about available endpoints
    this.fastify.get('/', async () => {
      return {
        name: 'DeployStack Gateway',
        version: '1.0.0',
        description: 'Enterprise MCP Gateway with dual transport support',
        endpoints: {
          sse: '/sse (GET) - Establish SSE connection for VS Code compatibility',
          message: '/message (POST) - Send JSON-RPC messages with session context',
          health: '/health (GET) - Health check and status information',
          status: '/status (GET) - Detailed gateway status'
        },
        usage: {
          vscode: 'Use http://localhost:9095/sse as MCP server URL',
          curl: 'Use session-based messaging after establishing SSE connection'
        }
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
   * Handle session-based MCP JSON-RPC requests (SSE endpoint)
   */
  private async handleSessionMessage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const message = request.body as any;
    const query = request.query as any;
    const sessionId = query.session || request.headers['mcp-session-id'];

    console.log(chalk.blue(`[Session] Processing message: ${message?.method} (session: ${sessionId})`));

    // Validate session ID
    if (!sessionId) {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Missing session ID'
        },
        id: message?.id || null
      };
      this.sseHandler.sendError(sessionId, errorResponse);
      reply.code(400).send(errorResponse);
      return;
    }

    // Validate session exists
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Invalid session ID'
        },
        id: message?.id || null
      };
      reply.code(400).send(errorResponse);
      return;
    }

    // Update session activity
    this.sessionManager.updateActivity(sessionId);

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
      this.sseHandler.sendError(sessionId, errorResponse);
      reply.code(400).send(errorResponse);
      return;
    }

    try {
      let response: any;

      // Handle different MCP methods
      if (message.method === 'initialize') {
        response = await this.handleInitialize(message);
        // Store client info in session
        if (message.params?.clientInfo) {
          this.sessionManager.setClientInfo(sessionId, message.params.clientInfo);
        }
        this.sessionManager.setMcpInitialized(sessionId);
      } else if (message.method === 'notifications/initialized') {
        // Handle initialized notification - no response needed for notifications
        console.log(chalk.green(`[Session] Client initialized: ${sessionId}`));
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
      this.sseHandler.sendMessage(sessionId, response);
      
      // Send acknowledgment to POST request
      reply.code(202).send({ status: 'accepted', messageId: message.id });

    } catch (error) {
      console.error(chalk.red(`[Session] Error processing message: ${sessionId}`), error);
      
      this.sessionManager.incrementErrorCount(sessionId);
      
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error)
        },
        id: message.id
      };

      this.sseHandler.sendError(sessionId, errorResponse);
      reply.code(500).send(errorResponse);
    }
  }

  /**
   * Handle MCP initialize request
   */
  private async handleInitialize(message: any): Promise<any> {
    return {
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
}
