import { FastifyRequest, FastifyReply, FastifyBaseLogger } from 'fastify';
import { ServerResponse } from 'http';
import { SessionManager } from './session-manager';

export class SSEHandler {
  private logger: FastifyBaseLogger;

  constructor(private sessionManager: SessionManager, logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: 'SSEHandler' });
  }

  /**
   * Establish SSE connection and return session ID
   */
  async establishConnection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    this.logger.info({
      operation: 'sse_connection_establishing',
      userAgent: request.headers['user-agent'],
      remoteAddress: request.ip
    }, 'Establishing SSE connection');

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });

    // Create session and get ID
    const sessionId = this.sessionManager.createSession(
      reply.raw,
      request.headers['user-agent'],
      request.ip
    );

    // Send initial endpoint event immediately
    this.sendEndpointEvent(reply.raw, sessionId);

    // Set up connection cleanup handlers
    this.setupCleanupHandlers(reply.raw, sessionId);

    this.logger.info({
      operation: 'sse_connection_established',
      sessionId,
      endpointUrl: `/message?session=${sessionId}`
    }, 'SSE connection established');
  }

  /**
   * Send initial endpoint event with session URL
   */
  private sendEndpointEvent(stream: ServerResponse, sessionId: string): void {
    const endpointUrl = `/message?session=${sessionId}`;
    
    try {
      stream.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);
      
      this.logger.debug({
        operation: 'sse_endpoint_event_sent',
        sessionId,
        endpointUrl
      }, 'Sent endpoint event');
    } catch (error) {
      this.logger.error({
        operation: 'sse_endpoint_event_failed',
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to send endpoint event');
    }
  }

  /**
   * Set up connection cleanup handlers
   */
  private setupCleanupHandlers(stream: ServerResponse, sessionId: string): void {
    stream.on('close', () => {
      this.logger.info({
        operation: 'sse_connection_closed',
        sessionId
      }, 'SSE connection closed');
      
      this.sessionManager.cleanupSession(sessionId, 'client_close');
    });

    stream.on('error', (error) => {
      this.logger.error({
        operation: 'sse_connection_error',
        sessionId,
        error: error.message
      }, 'SSE connection error');
      
      this.sessionManager.cleanupSession(sessionId, 'error');
    });

    // Handle client disconnect
    stream.on('finish', () => {
      this.logger.debug({
        operation: 'sse_connection_finished',
        sessionId
      }, 'SSE connection finished');
      
      this.sessionManager.cleanupSession(sessionId, 'client_close');
    });
  }

  /**
   * Send JSON-RPC message via SSE to specific session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendMessage(sessionId: string, message: any): boolean {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const success = this.sessionManager.sendToSession(sessionId, {
      id: messageId,
      event: 'message',
      data: JSON.stringify(message)
    });

    if (success) {
      this.logger.debug({
        operation: 'sse_message_sent',
        sessionId,
        messageId,
        method: message?.method
      }, 'SSE message sent');
    } else {
      this.logger.error({
        operation: 'sse_message_send_failed',
        sessionId,
        messageId,
        method: message?.method
      }, 'Failed to send SSE message');
    }

    return success;
  }

  /**
   * Send error via SSE to specific session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendError(sessionId: string, error: any): boolean {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const success = this.sessionManager.sendToSession(sessionId, {
      id: errorId,
      event: 'error',
      data: JSON.stringify(error)
    });

    if (success) {
      this.logger.warn({
        operation: 'sse_error_sent',
        sessionId,
        errorId,
        errorCode: error?.error?.code
      }, 'SSE error sent');
    } else {
      this.logger.error({
        operation: 'sse_error_send_failed',
        sessionId,
        errorId,
        errorCode: error?.error?.code
      }, 'Failed to send SSE error');
    }

    return success;
  }

  /**
   * Send notification via SSE to specific session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendNotification(sessionId: string, notification: any): boolean {
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const success = this.sessionManager.sendToSession(sessionId, {
      id: notificationId,
      event: 'notification',
      data: JSON.stringify(notification)
    });

    if (success) {
      this.logger.debug({
        operation: 'sse_notification_sent',
        sessionId,
        notificationId,
        method: notification?.method
      }, 'SSE notification sent');
    } else {
      this.logger.error({
        operation: 'sse_notification_send_failed',
        sessionId,
        notificationId,
        method: notification?.method
      }, 'Failed to send SSE notification');
    }

    return success;
  }

  /**
   * Get count of active SSE connections
   */
  getConnectionCount(): number {
    return this.sessionManager.getActiveCount();
  }

  /**
   * Send heartbeat to all active connections (optional)
   */
  sendHeartbeat(): void {
    const sessions = this.sessionManager.getAllSessions();
    
    this.logger.debug({
      operation: 'sse_heartbeat_sending',
      sessionCount: sessions.length
    }, 'Sending SSE heartbeat to all sessions');
    
    for (const session of sessions) {
      try {
        if (!session.sseStream.destroyed) {
          session.sseStream.write(`: heartbeat\n\n`);
        }
      } catch {
        // Connection might be dead, cleanup will handle it
        this.logger.warn({
          operation: 'sse_heartbeat_failed',
          sessionId: session.id
        }, 'SSE heartbeat failed for session');
      }
    }
  }
}
