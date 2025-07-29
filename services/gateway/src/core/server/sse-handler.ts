import { FastifyRequest, FastifyReply } from 'fastify';
import { ServerResponse } from 'http';
import chalk from 'chalk';
import { SessionManager } from './session-manager';

export class SSEHandler {
  constructor(private sessionManager: SessionManager) {}

  /**
   * Establish SSE connection and return session ID
   */
  async establishConnection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    console.log(chalk.blue('[SSE] Establishing connection'));

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
    const sessionId = this.sessionManager.createSession(reply.raw);

    // Send initial endpoint event immediately
    this.sendEndpointEvent(reply.raw, sessionId);

    // Set up connection cleanup handlers
    this.setupCleanupHandlers(reply.raw, sessionId);

    console.log(chalk.green(`[SSE] Connection established: ${sessionId}`));
  }

  /**
   * Send initial endpoint event with session URL
   */
  private sendEndpointEvent(stream: ServerResponse, sessionId: string): void {
    const endpointUrl = `/message?session=${sessionId}`;
    
    try {
      stream.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);
      console.log(chalk.gray(`[SSE] Sent endpoint event: ${endpointUrl}`));
    } catch (error) {
      console.error(chalk.red(`[SSE] Failed to send endpoint event:`), error);
    }
  }

  /**
   * Set up connection cleanup handlers
   */
  private setupCleanupHandlers(stream: ServerResponse, sessionId: string): void {
    stream.on('close', () => {
      console.log(chalk.yellow(`[SSE] Connection closed: ${sessionId}`));
      this.sessionManager.cleanupSession(sessionId);
    });

    stream.on('error', (error) => {
      console.error(chalk.red(`[SSE] Connection error: ${sessionId}`), error);
      this.sessionManager.cleanupSession(sessionId);
    });

    // Handle client disconnect
    stream.on('finish', () => {
      console.log(chalk.gray(`[SSE] Connection finished: ${sessionId}`));
      this.sessionManager.cleanupSession(sessionId);
    });
  }

  /**
   * Send JSON-RPC message via SSE to specific session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendMessage(sessionId: string, message: any): boolean {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return this.sessionManager.sendToSession(sessionId, {
      id: messageId,
      event: 'message',
      data: JSON.stringify(message)
    });
  }

  /**
   * Send error via SSE to specific session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendError(sessionId: string, error: any): boolean {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return this.sessionManager.sendToSession(sessionId, {
      id: errorId,
      event: 'error',
      data: JSON.stringify(error)
    });
  }

  /**
   * Send notification via SSE to specific session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendNotification(sessionId: string, notification: any): boolean {
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return this.sessionManager.sendToSession(sessionId, {
      id: notificationId,
      event: 'notification',
      data: JSON.stringify(notification)
    });
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
    
    for (const session of sessions) {
      try {
        if (!session.sseStream.destroyed) {
          session.sseStream.write(`: heartbeat\n\n`);
        }
      } catch {
        // Connection might be dead, cleanup will handle it
        console.warn(chalk.yellow(`[SSE] Heartbeat failed for ${session.id}`));
      }
    }
  }
}
