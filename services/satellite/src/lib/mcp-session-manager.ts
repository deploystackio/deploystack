 
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'crypto';
import { getVersionString } from '../config/version';

/**
 * Session entry stored in the session map
 */
interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
}

/**
 * MCP Session Manager
 *
 * Manages MCP Server and StreamableHTTPServerTransport lifecycle.
 * Extracted from mcp-server-wrapper.ts to enable code reuse between
 * hierarchical router and path-based router.
 */
export class McpSessionManager {
  private transports = new Map<string, SessionEntry>();

  constructor(private logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'McpSessionManager' });
  }

  /**
   * Get an existing session by ID
   */
  getSession(sessionId: string): SessionEntry | undefined {
    return this.transports.get(sessionId);
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.transports.has(sessionId);
  }

  /**
   * Create a new MCP session with transport
   *
   * @param setupServerHandler - Callback to register request handlers on the server
   * @param onSessionCreated - Optional callback invoked when session is initialized
   * @returns Session entry with transport and server
   */
  createSession(
    setupServerHandler: (server: Server) => void,
    onSessionCreated?: (sessionId: string) => void
  ): SessionEntry {
    // Create MCP Server instance
    const server = new Server(
      {
        name: 'deploystack-satellite',
        version: getVersionString()
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.logger.debug({
      operation: 'mcp_server_created'
    }, 'Created new MCP Server instance');

    // Register request handlers via callback
    setupServerHandler(server);

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        this.transports.set(sessionId, { transport, server });
        this.logger.debug({
          operation: 'mcp_session_created',
          session_id: sessionId,
          total_sessions: this.transports.size
        }, `New MCP session created: ${sessionId}`);

        // Invoke optional callback
        if (onSessionCreated) {
          onSessionCreated(sessionId);
        }
      },
      enableDnsRebindingProtection: false,
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        this.deleteSession(transport.sessionId);
      }
    };

    this.logger.info({
      operation: 'mcp_session_initialized',
      total_sessions: this.transports.size
    }, 'MCP session initialized with transport');

    return { transport, server };
  }

  /**
   * Create a session with a fixed session ID (for resurrection)
   *
   * @param sessionId - Fixed session ID to reuse
   * @param setupServerHandler - Callback to register request handlers
   * @param onSessionCreated - Optional callback invoked when session is initialized
   * @returns Session entry with transport and server
   */
  createSessionWithId(
    sessionId: string,
    setupServerHandler: (server: Server) => void,
    onSessionCreated?: (sessionId: string) => void
  ): SessionEntry {
    // Create MCP Server instance
    const server = new Server(
      {
        name: 'deploystack-satellite',
        version: getVersionString()
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.logger.debug({
      operation: 'mcp_server_created_with_id',
      session_id: sessionId
    }, 'Created new MCP Server instance with fixed session ID');

    // Register request handlers via callback
    setupServerHandler(server);

    // Create transport with fixed session ID
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId, // Reuse the old session ID!
      onsessioninitialized: (restoredSessionId) => {
        this.transports.set(restoredSessionId, { transport, server });
        this.logger.info({
          operation: 'mcp_session_resurrected',
          session_id: restoredSessionId,
          total_sessions: this.transports.size
        }, 'Session resurrected successfully - client can continue without reconnecting');

        // Invoke optional callback
        if (onSessionCreated) {
          onSessionCreated(restoredSessionId);
        }
      },
      enableDnsRebindingProtection: false,
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        this.deleteSession(transport.sessionId);
      }
    };

    this.logger.info({
      operation: 'mcp_session_initialized_with_id',
      session_id: sessionId,
      total_sessions: this.transports.size
    }, 'MCP session initialized with fixed ID for resurrection');

    return { transport, server };
  }

  /**
   * Delete a session and close its transport
   */
  deleteSession(sessionId: string): void {
    const session = this.transports.get(sessionId);
    if (session) {
      try {
        session.transport.close();
      } catch (error) {
        this.logger.warn({
          operation: 'transport_close_failed',
          session_id: sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to close transport during session deletion');
      }

      this.transports.delete(sessionId);
      this.logger.debug({
        operation: 'mcp_session_deleted',
        session_id: sessionId,
        remaining_sessions: this.transports.size
      }, `MCP session deleted: ${sessionId}`);
    }
  }

  /**
   * Get the total number of active sessions
   */
  get sessionCount(): number {
    return this.transports.size;
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.transports.keys());
  }

  /**
   * Cleanup all sessions and close transports
   */
  async cleanup(): Promise<void> {
    this.logger.info({
      operation: 'session_manager_cleanup_start',
      session_count: this.transports.size
    }, `Cleaning up ${this.transports.size} sessions`);

    for (const [sessionId, session] of this.transports) {
      try {
        session.transport.close();
        this.logger.debug({
          operation: 'session_closed',
          session_id: sessionId
        }, `Closed session ${sessionId}`);
      } catch (error) {
        this.logger.warn({
          operation: 'session_close_failed',
          session_id: sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, `Failed to close session ${sessionId}`);
      }
    }

    this.transports.clear();

    this.logger.info({
      operation: 'session_manager_cleanup_complete'
    }, 'Session manager cleanup completed');
  }
}
