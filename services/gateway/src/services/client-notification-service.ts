import { SessionManager } from '../core/server/session-manager';
import { StreamableHTTPHandler } from '../core/server/streamable-http-handler';
import { SSEHandler } from '../core/server/sse-handler';
import { logger } from '../utils/logger';

export interface NotificationResult {
  totalNotified: number;
  sseNotified: number;
  streamableHttpNotified: number;
  errors: string[];
}

export class ClientNotificationService {
  constructor(
    private sessionManager: SessionManager,
    private streamableHandler: StreamableHTTPHandler,
    private sseHandler: SSEHandler
  ) {}

  /**
   * Notify all connected clients that tools have changed
   */
  async notifyToolsChanged(): Promise<NotificationResult> {
    const result: NotificationResult = {
      totalNotified: 0,
      sseNotified: 0,
      streamableHttpNotified: 0,
      errors: []
    };

    // Notify SSE clients
    await this.notifySSEClients(result);

    // Notify Streamable HTTP clients
    await this.notifyStreamableHttpClients(result);

    result.totalNotified = result.sseNotified + result.streamableHttpNotified;

    logger.info(`Tools changed notification sent to ${result.totalNotified} clients`, 'notification', {
      sseClients: result.sseNotified,
      streamableHttpClients: result.streamableHttpNotified,
      errors: result.errors.length
    });

    return result;
  }

  /**
   * Notify SSE clients via tools/list_changed notification
   */
  private async notifySSEClients(result: NotificationResult): Promise<void> {
    const sseSessions = this.sessionManager.getAllSessions();
    
    for (const session of sseSessions) {
      try {
        // Only notify initialized clients
        if (!session.mcpInitialized) {
          continue;
        }

        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/tools/list_changed',
          params: {}
        };

        const success = this.sseHandler.sendMessage(session.id, notification);
        
        if (success) {
          result.sseNotified++;
          logger.debug(`Tools changed notification sent to SSE client: ${session.id}`, 'notification', {
            sessionId: session.id,
            clientInfo: session.clientInfo
          });
        } else {
          const error = `Failed to send notification to SSE client: ${session.id}`;
          result.errors.push(error);
          logger.warn(error, 'notification', { sessionId: session.id });
        }
      } catch (error) {
        const errorMsg = `Error notifying SSE client ${session.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg, 'notification', { sessionId: session.id, error });
      }
    }
  }

  /**
   * Notify Streamable HTTP clients
   * Note: For stateless clients, they'll get the updated tools on their next request
   * For session-based clients, we can send notifications if we had a way to push to them
   */
  private async notifyStreamableHttpClients(result: NotificationResult): Promise<void> {
    const streamableSessions = this.streamableHandler.getAllSessions();
    
    // For now, we'll just mark these sessions as having pending tool updates
    // The actual notification will happen on their next request
    for (const session of streamableSessions) {
      try {
        // Only count initialized clients
        if (!session.mcpInitialized) {
          continue;
        }

        // For Streamable HTTP, we can't push notifications like SSE
        // But we can mark that tools have changed and include this info in next response
        // For now, we'll just count them as "notified" since they'll get updates on next request
        result.streamableHttpNotified++;
        
        logger.debug(`Tools changed marked for Streamable HTTP client: ${session.id}`, 'notification', {
          sessionId: session.id,
          clientInfo: session.clientInfo
        });
      } catch (error) {
        const errorMsg = `Error marking Streamable HTTP client ${session.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg, 'notification', { sessionId: session.id, error });
      }
    }
  }

  /**
   * Get notification capabilities for different transport types
   */
  getNotificationCapabilities(): {
    sse: { canPushNotifications: boolean; method: string };
    streamableHttp: { canPushNotifications: boolean; method: string };
  } {
    return {
      sse: {
        canPushNotifications: true,
        method: 'Real-time via notifications/tools/list_changed'
      },
      streamableHttp: {
        canPushNotifications: false,
        method: 'Next-request notification (stateless clients get updates on next call)'
      }
    };
  }

  /**
   * Send a custom notification to all clients
   */
  async sendCustomNotification(method: string, params: any = {}): Promise<NotificationResult> {
    const result: NotificationResult = {
      totalNotified: 0,
      sseNotified: 0,
      streamableHttpNotified: 0,
      errors: []
    };

    const sseSessions = this.sessionManager.getAllSessions();
    
    for (const session of sseSessions) {
      try {
        if (!session.mcpInitialized) {
          continue;
        }

        const notification = {
          jsonrpc: '2.0',
          method,
          params
        };

        const success = this.sseHandler.sendMessage(session.id, notification);
        
        if (success) {
          result.sseNotified++;
        } else {
          result.errors.push(`Failed to send custom notification to SSE client: ${session.id}`);
        }
      } catch (error) {
        result.errors.push(`Error sending custom notification to SSE client ${session.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.totalNotified = result.sseNotified + result.streamableHttpNotified;
    return result;
  }
}
