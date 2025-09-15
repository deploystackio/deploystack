import { randomBytes } from 'crypto';
import { ServerResponse } from 'http';
import { FastifyBaseLogger } from 'fastify';

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastActivity: number;
  sseStream: ServerResponse;
  clientInfo?: {
    name: string;
    version: string;
  };
  mcpInitialized: boolean;
  requestCount: number;
  errorCount: number;
}

export class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'SessionManager' });
  }

  /**
   * Generate a cryptographically secure session ID
   */
  private generateSessionId(): string {
    // 32 bytes = 256 bits of entropy, base64url encoded
    return randomBytes(32).toString('base64url');
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
   * Create a new session with SSE stream
   */
  createSession(sseStream: ServerResponse, userAgent?: string, remoteAddress?: string): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session: SessionInfo = {
      id: sessionId,
      createdAt: now,
      lastActivity: now,
      sseStream,
      mcpInitialized: false,
      requestCount: 0,
      errorCount: 0
    };

    this.sessions.set(sessionId, session);
    
    // Schedule cleanup after timeout
    setTimeout(() => {
      this.cleanupIfExpired(sessionId);
    }, this.SESSION_TIMEOUT);

    this.logger.info({
      operation: 'session_created',
      sessionId,
      userAgent,
      remoteAddress
    }, 'Session created');
    
    return sessionId;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionInfo | null {
    if (!this.validateSessionId(sessionId)) {
      return null;
    }
    
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.requestCount++;
      
      this.logger.debug({
        operation: 'session_activity_updated',
        sessionId,
        requestCount: session.requestCount
      }, 'Session activity updated');
    }
  }

  /**
   * Set client info for session
   */
  setClientInfo(sessionId: string, clientInfo: { name: string; version: string }): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clientInfo = clientInfo;
      
      this.logger.info({
        operation: 'session_client_info_set',
        sessionId,
        clientName: clientInfo.name,
        clientVersion: clientInfo.version
      }, 'Session client info set');
    }
  }

  /**
   * Mark session as MCP initialized
   */
  setMcpInitialized(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.mcpInitialized = true;
      
      this.logger.info({
        operation: 'session_mcp_initialized',
        sessionId
      }, 'Session MCP initialized');
    }
  }

  /**
   * Increment error count for session
   */
  incrementErrorCount(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errorCount++;
      
      this.logger.warn({
        operation: 'session_error_incremented',
        sessionId,
        errorCount: session.errorCount
      }, 'Session error count incremented');
    }
  }

  /**
   * Send data to session via SSE stream
   */
  sendToSession(sessionId: string, event: { id?: string; event?: string; data: string }): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.sseStream.destroyed) {
      return false;
    }

    try {
      let sseData = '';
      if (event.id) sseData += `id: ${event.id}\n`;
      if (event.event) sseData += `event: ${event.event}\n`;
      sseData += `data: ${event.data}\n\n`;

      session.sseStream.write(sseData);
      
      this.logger.debug({
        operation: 'session_message_sent',
        sessionId,
        eventType: event.event,
        eventId: event.id
      }, 'Message sent to session');
      
      return true;
    } catch (error) {
      this.logger.error({
        operation: 'session_send_failed',
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to send message to session');
      
      this.cleanupSession(sessionId);
      return false;
    }
  }

  /**
   * Clean up session and associated resources
   */
  cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (!session.sseStream.destroyed) {
        session.sseStream.end();
      }
    } catch {
      // Ignore cleanup errors
    }

    this.sessions.delete(sessionId);
    
    this.logger.info({
      operation: 'session_cleaned_up',
      sessionId,
      uptime: Date.now() - session.createdAt,
      requestCount: session.requestCount,
      errorCount: session.errorCount
    }, 'Session cleaned up');
  }

  /**
   * Clean up session if it has expired
   */
  private cleanupIfExpired(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.logger.info({
        operation: 'session_expired',
        sessionId,
        inactiveTime: Date.now() - session.lastActivity
      }, 'Session expired');
      
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Get count of active sessions
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up all sessions (for shutdown)
   */
  cleanupAllSessions(): void {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      this.cleanupSession(sessionId);
    }
    
    this.logger.info({
      operation: 'all_sessions_cleaned_up',
      sessionCount: sessionIds.length
    }, 'All sessions cleaned up');
  }
}
