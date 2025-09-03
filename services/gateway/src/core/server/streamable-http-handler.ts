/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import chalk from 'chalk';

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

    console.log(chalk.blue(`[MCP] ${method} request, Accept: ${acceptHeader}, Session: ${sessionId || 'none'}`));

    if (method === 'GET') {
      // GET request - establish SSE stream for server-to-client communication
      await this.handleGetRequest(request, reply);
    } else if (method === 'POST') {
      // POST request - handle JSON-RPC messages
      await this.handlePostRequest(request, reply);
    } else {
      reply.code(405).send({ error: 'Method Not Allowed' });
    }
  }

  /**
   * Handle GET request - establish SSE stream
   */
  private async handleGetRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const acceptHeader = request.headers.accept || '';
    
    if (!acceptHeader.includes('text/event-stream')) {
      reply.code(405).send({ error: 'Method Not Allowed', message: 'GET requires Accept: text/event-stream' });
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

    console.log(chalk.green('[MCP] SSE stream established'));

    // Handle connection cleanup
    request.raw.on('close', () => {
      console.log(chalk.yellow('[MCP] SSE stream closed'));
    });

    request.raw.on('error', (error) => {
      console.error(chalk.red('[MCP] SSE stream error:'), error);
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
        reply.code(400).send({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Invalid session ID' },
          id: message.id
        });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
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

    // Mark session as initialized
    const session = this.sessions.get(actualSessionId!);
    if (session) {
      session.mcpInitialized = true;
    }

    // Set session ID header in response
    reply.header('Mcp-Session-Id', actualSessionId);
    
    // Determine response mode
    const wantsStreaming = acceptHeader.includes('text/event-stream');
    
    if (wantsStreaming) {
      // Return SSE stream
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Mcp-Session-Id': actualSessionId
      });

      const eventId = this.generateEventId();
      reply.raw.write(`id: ${eventId}\nevent: message\ndata: ${JSON.stringify(initResponse)}\n\n`);
    } else {
      // Return standard JSON response
      reply.code(200).send(initResponse);
    }
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

    // This will be implemented by the calling code to process the message
    // For now, just acknowledge that streaming is supported
    const eventId = this.generateEventId();
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: { status: 'streaming_supported' }
    };
    
    reply.raw.write(`id: ${eventId}\nevent: message\ndata: ${JSON.stringify(response)}\n\n`);
  }

  /**
   * Handle standard HTTP JSON response
   */
  private async handleStandardResponse(
    message: any, 
    sessionId: string | undefined, 
    reply: FastifyReply
  ): Promise<void> {
    // This will be implemented by the calling code to process the message
    // For now, just return a basic response
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: { status: 'standard_response_supported' }
    };
    
    reply.code(200).send(response);
  }

  /**
   * Send message via SSE stream (for external use)
   */
  sendSSEMessage(reply: FastifyReply, message: any, eventType: string = 'message'): boolean {
    try {
      const eventId = this.generateEventId();
      reply.raw.write(`id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(message)}\n\n`);
      return true;
    } catch (error) {
      console.error(chalk.red('[MCP] Failed to send SSE message:'), error);
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
    }
  }

  /**
   * Clean up session if it has expired
   */
  private cleanupIfExpired(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      console.log(chalk.yellow(`[MCP] Session expired: ${sessionId}`));
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
    this.sessions.clear();
    console.log(chalk.gray('[MCP] All sessions cleaned up'));
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
