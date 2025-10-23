/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest, FastifyReply, FastifyBaseLogger } from 'fastify';
import { randomBytes } from 'crypto';

export interface StreamableSession {
  id: string;
  createdAt: number;
  lastActivity: number;
  clientInfo?: {
    name: string;
    version: string;
  };
  mcpInitialized: boolean;
  requestCount: number;
  errorCount: number;
}

export class StreamableHTTPHandler {
  private sessions = new Map<string, StreamableSession>();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private eventIdCounter = 0;
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'StreamableHTTPHandler' });
  }

  /**
   * Generate a cryptographically secure session ID
   */
  private generateSessionId(): string {
    // 32 bytes = 256 bits of entropy, base64url encoded
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate unique event ID for SSE resumability
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${++this.eventIdCounter}`;
  }

  /**
   * Validate session ID format
   */
  private validateSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') return false;
    if (sessionId.length < 32) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) return false;
    return true;
  }

  /**
   * Handle unified /mcp endpoint - supports both POST and GET
   */
  async handleMcpEndpoint(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const method = request.method;
    const acceptHeader = request.headers.accept || '';
    const sessionId = request.headers['mcp-session-id'] as string;

    this.logger.info({
      operation: 'mcp_request_received',
      method,
      acceptHeader,
      sessionId: sessionId || 'none',
      userAgent: request.headers['user-agent']
    }, 'MCP request received');

    if (method === 'GET') {
      // GET request - establish SSE stream for server-to-client communication
      await this.handleGetRequest(request, reply);
    } else if (method === 'POST') {
      // POST request - handle JSON-RPC messages
      await this.handlePostRequest(request, reply);
    } else {
      this.logger.warn({
        operation: 'mcp_method_not_allowed',
        method
      }, 'Method not allowed');
      
      reply.code(405).send({ error: 'Method Not Allowed' });
    }
  }

  /**
   * Handle GET request - establish SSE stream
   */
  private async handleGetRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const acceptHeader = request.headers.accept || '';
    
    if (!acceptHeader.includes('text/event-stream')) {
      this.logger.warn({
        operation: 'mcp_get_invalid_accept',
        acceptHeader
      }, 'GET requires Accept: text/event-stream');
      
      reply.code(405).send({ 
        error: 'Method Not Allowed', 
        message: 'GET requires Accept: text/event-stream' 
      });
      return;
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });

    this.logger.info({
      operation: 'mcp_sse_stream_established'
    }, 'MCP SSE stream established');

    // Handle connection cleanup
    request.raw.on('close', () => {
      this.logger.info({
        operation: 'mcp_sse_stream_closed'
      }, 'MCP SSE stream closed');
    });

    request.raw.on('error', (error) => {
      this.logger.error({
        operation: 'mcp_sse_stream_error',
        error: error.message
      }, 'MCP SSE stream error');
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000); // 30 seconds

    // Clean up heartbeat on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
    });
  }

  /**
   * Handle POST request - process JSON-RPC messages
   */
  private async handlePostRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const message = request.body as any;
    const sessionId = request.headers['mcp-session-id'] as string;
    const acceptHeader = request.headers.accept || '';
    
    // Validate JSON-RPC format
    if (!message || message.jsonrpc !== '2.0') {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request'
        },
        id: message?.id || null
      };
      
      this.logger.warn({
        operation: 'mcp_invalid_jsonrpc',
        messageId: message?.id
      }, 'Invalid JSON-RPC request');
      
      reply.code(400).send(errorResponse);
      return;
    }

    // Handle session management for requests that need it
    if (message.method === 'initialize') {
      await this.handleInitializeWithSession(message, sessionId, acceptHeader, reply);
      return;
    }

    // For other requests, validate session if provided
    if (sessionId) {
      if (!this.validateSessionId(sessionId)) {
        this.logger.warn({
          operation: 'mcp_invalid_session_id',
          sessionId,
          messageId: message.id
        }, 'Invalid session ID');
        
        reply.code(400).send({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Invalid session ID' },
          id: message.id
        });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        this.logger.warn({
          operation: 'mcp_session_not_found',
          sessionId,
          messageId: message.id
        }, 'Session not found');
        
        reply.code(404).send({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found' },
          id: message.id
        });
        return;
      }

      // Update session activity
      session.lastActivity = Date.now();
      session.requestCount++;
      
      this.logger.debug({
        operation: 'mcp_session_activity_updated',
        sessionId,
        requestCount: session.requestCount
      }, 'Session activity updated');
    }

    // Determine response mode based on Accept header
    const wantsStreaming = acceptHeader.includes('text/event-stream');
    
    if (wantsStreaming) {
      // Return SSE stream for streaming responses
      await this.handleStreamingResponse(message, sessionId, reply);
    } else {
      // Return standard HTTP JSON response
      await this.handleStandardResponse(message, sessionId, reply);
    }
  }

  /**
   * Handle initialize request with optional session creation
   */
  private async handleInitializeWithSession(
    message: any, 
    sessionId: string | undefined, 
    acceptHeader: string, 
    reply: FastifyReply
  ): Promise<void> {
    let actualSessionId = sessionId;
    
    // Create new session if none provided
    if (!actualSessionId) {
      actualSessionId = this.generateSessionId();
      
      const session: StreamableSession = {
        id: actualSessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        mcpInitialized: false,
        requestCount: 1,
        errorCount: 0
      };

      // Store client info if provided
      if (message.params?.clientInfo) {
        session.clientInfo = message.params.clientInfo;
      }

      this.sessions.set(actualSessionId, session);
      
      // Schedule cleanup after timeout
      setTimeout(() => {
        this.cleanupIfExpired(actualSessionId!);
      }, this.SESSION_TIMEOUT);

      this.logger.info({
        operation: 'mcp_session_created',
        sessionId: actualSessionId,
        clientName: session.clientInfo?.name,
        clientVersion: session.clientInfo?.version
      }, 'MCP session created');
    }

    const initResponse = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
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
      }
    };

    // Mark session as initialized
    const session = this.sessions.get(actualSessionId!);
    if (session) {
      session.mcpInitialized = true;
      
      this.logger.info({
        operation: 'mcp_session_initialized',
        sessionId: actualSessionId
      }, 'MCP session initialized');
    }

    // Set session ID header in response
    reply.header('Mcp-Session-Id', actualSessionId);
    
    // ALWAYS return JSON for initialize, even if Accept includes text/event-stream
    // The SSE stream is established via separate GET request
    reply.code(200).send(initResponse);
    
    this.logger.debug({
      operation: 'mcp_initialize_json_response_sent',
      sessionId: actualSessionId
    }, 'Initialize JSON response sent');
  }

  /**
   * Handle streaming response via SSE
   */
  private async handleStreamingResponse(
    message: any, 
    sessionId: string | undefined, 
    reply: FastifyReply
  ): Promise<void> {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Get MCP protocol handler from server instance
    const mcpProtocolHandler = (reply.server as any).mcpProtocolHandler;
    
    if (!mcpProtocolHandler) {
      this.logger.error({
        operation: 'mcp_protocol_handler_missing',
        method: message.method,
        sessionId
      }, 'MCP protocol handler not available');
      
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal server error - MCP protocol handler not available'
        }
      };
      
      const eventId = this.generateEventId();
      reply.raw.write(`id: ${eventId}\nevent: message\ndata: ${JSON.stringify(errorResponse)}\n\n`);
      return;
    }

    try {
      // Process the message using the MCP protocol handler
      const response = await mcpProtocolHandler.handleMcpRequest(message, sessionId);
      
      // Handle notifications (null response)
      if (response === null) {
        this.logger.debug({
          operation: 'mcp_notification_handled',
          sessionId,
          method: message.method
        }, 'MCP notification handled - no response sent');
        // Don't send anything for notifications
        return;
      }
      
      this.logger.debug({
        operation: 'mcp_streaming_response_before_send',
        sessionId,
        method: message.method,
        response_object: response,
        response_json: JSON.stringify(response)
      }, 'Debug: Streaming response object before sending');
      
      // Send response as SSE event
      const eventId = this.generateEventId();
      reply.raw.write(`id: ${eventId}\nevent: message\ndata: ${JSON.stringify(response)}\n\n`);
      
      this.logger.debug({
        operation: 'mcp_streaming_response_sent',
        sessionId,
        method: message.method,
        eventId,
        success: !response.error
      }, 'MCP streaming response sent');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error({
        operation: 'mcp_streaming_response_failed',
        sessionId,
        method: message.method,
        error: errorMessage
      }, 'MCP streaming response failed');
      
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: errorMessage
        }
      };
      
      const eventId = this.generateEventId();
      reply.raw.write(`id: ${eventId}\nevent: message\ndata: ${JSON.stringify(errorResponse)}\n\n`);
    }
  }

  /**
   * Handle standard HTTP JSON response
   */
  private async handleStandardResponse(
    message: any, 
    sessionId: string | undefined, 
    reply: FastifyReply
  ): Promise<void> {
    // Get MCP protocol handler from server instance
    const mcpProtocolHandler = (reply.server as any).mcpProtocolHandler;
    
    if (!mcpProtocolHandler) {
      this.logger.error({
        operation: 'mcp_protocol_handler_missing',
        method: message.method,
        sessionId
      }, 'MCP protocol handler not available');
      
      reply.code(500).send({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal server error - MCP protocol handler not available'
        }
      });
      return;
    }

    try {
      // Process the message using the MCP protocol handler
      const response = await mcpProtocolHandler.handleMcpRequest(message, sessionId);
      
      // Handle notifications (null response)
      if (response === null) {
        this.logger.debug({
          operation: 'mcp_notification_handled',
          sessionId,
          method: message.method
        }, 'MCP notification handled - no response sent');
        // Don't send anything for notifications
        reply.code(204).send(); // 204 No Content
        return;
      }
      
      this.logger.debug({
        operation: 'mcp_response_before_send',
        sessionId,
        method: message.method,
        response_object: response,
        response_json: JSON.stringify(response)
      }, 'Debug: Response object before sending');
      
      reply.code(200).send(response);
      
      this.logger.debug({
        operation: 'mcp_standard_response_sent',
        sessionId,
        method: message.method,
        success: !response.error
      }, 'MCP standard response sent');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error({
        operation: 'mcp_standard_response_failed',
        sessionId,
        method: message.method,
        error: errorMessage
      }, 'MCP standard response failed');
      
      reply.code(500).send({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: errorMessage
        }
      });
    }
  }

  /**
   * Send message via SSE stream (for external use)
   */
  sendSSEMessage(reply: FastifyReply, message: any, eventType: string = 'message'): boolean {
    try {
      const eventId = this.generateEventId();
      reply.raw.write(`id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(message)}\n\n`);
      
      this.logger.debug({
        operation: 'mcp_sse_message_sent',
        eventType,
        eventId,
        method: message?.method
      }, 'SSE message sent');
      
      return true;
    } catch (error) {
      this.logger.error({
        operation: 'mcp_sse_message_send_failed',
        eventType,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to send SSE message');
      
      return false;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): StreamableSession | null {
    if (!this.validateSessionId(sessionId)) {
      return null;
    }
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.requestCount++;
    }
  }

  /**
   * Increment error count for session
   */
  incrementSessionErrorCount(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errorCount++;
      
      this.logger.warn({
        operation: 'mcp_session_error_incremented',
        sessionId,
        errorCount: session.errorCount
      }, 'Session error count incremented');
    }
  }

  /**
   * Clean up session if it has expired
   */
  private cleanupIfExpired(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.logger.info({
        operation: 'mcp_session_expired',
        sessionId,
        inactiveTime: Date.now() - session.lastActivity
      }, 'MCP session expired');
      
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllSessions(): StreamableSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up all sessions (for shutdown)
   */
  cleanupAllSessions(): void {
    const sessionCount = this.sessions.size;
    this.sessions.clear();
    
    this.logger.info({
      operation: 'mcp_all_sessions_cleaned_up',
      sessionCount
    }, 'All MCP sessions cleaned up');
  }

  /**
   * Get session status for monitoring
   */
  getStatus() {
    return {
      activeSessionCount: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        uptime: Date.now() - session.createdAt,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
        clientInfo: session.clientInfo,
        mcpInitialized: session.mcpInitialized
      }))
    };
  }
}
