import { ServerResponse } from 'http';
import { FastifyBaseLogger } from 'fastify';

/**
 * SSE Ping Service
 *
 * Sends periodic SSE comments (`: ping\n\n`) to keep proxy connections alive.
 * This prevents Cloudflare/nginx from timing out idle SSE connections.
 *
 * SSE comments are ignored by clients but keep the TCP connection active.
 */
export class SsePingService {
  private activeConnections = new Map<string, ServerResponse>();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL_MS = 30000; // 30 seconds
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'SsePingService' });
  }

  /**
   * Start the ping interval
   */
  start(): void {
    if (this.pingInterval) return;

    this.pingInterval = setInterval(() => {
      this.sendPingToAll();
    }, this.PING_INTERVAL_MS);

    this.logger.info({
      operation: 'sse_ping_service_started',
      interval_ms: this.PING_INTERVAL_MS
    }, 'SSE ping service started');
  }

  /**
   * Stop the ping interval and clear all connections
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.activeConnections.clear();

    this.logger.info({
      operation: 'sse_ping_service_stopped'
    }, 'SSE ping service stopped');
  }

  /**
   * Register an SSE connection for ping keep-alive
   */
  registerConnection(sessionId: string, response: ServerResponse): void {
    this.activeConnections.set(sessionId, response);

    // Clean up on close
    response.on('close', () => {
      this.activeConnections.delete(sessionId);
      this.logger.debug({
        operation: 'sse_connection_closed',
        session_id: sessionId,
        active_count: this.activeConnections.size
      }, 'SSE connection closed');
    });

    this.logger.debug({
      operation: 'sse_connection_registered',
      session_id: sessionId,
      active_count: this.activeConnections.size
    }, 'SSE connection registered');
  }

  /**
   * Unregister an SSE connection
   */
  unregisterConnection(sessionId: string): void {
    this.activeConnections.delete(sessionId);
  }

  /**
   * Get the number of active connections
   */
  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Send ping comment to all active SSE connections
   */
  private sendPingToAll(): void {
    // SSE comment format - ignored by clients but keeps connection alive
    const pingComment = ': ping\n\n';
    let sentCount = 0;
    let failedCount = 0;

    for (const [sessionId, response] of this.activeConnections) {
      try {
        if (!response.writableEnded && !response.destroyed) {
          response.write(pingComment);
          sentCount++;
        } else {
          // Connection is closed, remove it
          this.activeConnections.delete(sessionId);
          failedCount++;
        }
      } catch (error) {
        // Connection errored, remove it
        this.activeConnections.delete(sessionId);
        failedCount++;

        this.logger.debug({
          operation: 'sse_ping_error',
          session_id: sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to send SSE ping');
      }
    }

    // Only log if there were connections to ping
    if (sentCount > 0 || failedCount > 0) {
      this.logger.debug({
        operation: 'sse_ping_sent',
        sent: sentCount,
        failed: failedCount,
        active: this.activeConnections.size
      }, `SSE ping sent to ${sentCount} connections`);
    }
  }
}
