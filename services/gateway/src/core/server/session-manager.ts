import { randomBytes } from 'crypto';
import { ServerResponse } from 'http';
import { logger } from '../../utils/logger';

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
  createSession(sseStream: ServerResponse): string {
    const sessionId = this.generateSessionId();
    
    const session: SessionInfo = {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
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

    logger.info(`Session created: ${sessionId}`, 'session', { sessionId });
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
    }
  }

  /**
   * Set client info for session
   */
  setClientInfo(sessionId: string, clientInfo: { name: string; version: string }): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clientInfo = clientInfo;
    }
  }

  /**
   * Mark session as MCP initialized
   */
  setMcpInitialized(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.mcpInitialized = true;
    }
  }

  /**
   * Increment error count for session
   */
  incrementErrorCount(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errorCount++;
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
      return true;
    } catch (error) {
      logger.error(`Failed to send to session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'session', { sessionId, error });
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
    logger.info(`Session cleaned up: ${sessionId}`, 'session', { sessionId });
  }

  /**
   * Clean up session if it has expired
   */
  private cleanupIfExpired(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      logger.info(`Session expired: ${sessionId}`, 'session', { sessionId });
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
  }
}
