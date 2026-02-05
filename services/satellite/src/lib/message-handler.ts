import { Logger } from 'pino';
import { ProcessInfo } from '../process/types';

/**
 * Handles stdio JSON-RPC message communication with MCP server processes
 * Manages request/response lifecycle, timeouts, and notification sending
 */
export class MessageHandler {
  constructor(private logger: Logger) {}

  /**
   * Send message to MCP server process via stdin
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendMessage(processInfo: ProcessInfo, message: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      // Allow messages during 'starting' phase for handshake, but not if failed/terminated
      if (processInfo.status === 'failed' || processInfo.status === 'terminated' || processInfo.status === 'terminating') {
        reject(new Error(`Process ${processInfo.config.installation_name} is not running (status: ${processInfo.status})`));
        return;
      }

      // Check if the actual child process is still alive
      if (!processInfo.process || processInfo.process.killed || processInfo.process.exitCode !== null) {
        reject(new Error(`Process ${processInfo.config.installation_name} child process has died`));
        return;
      }

      const requestId = message.id;
      if (!requestId) {
        // Notification - no response expected
        const messageStr = JSON.stringify(message) + '\n';
        processInfo.process.stdin?.write(messageStr);

        this.logger.debug({
          operation: 'mcp_notification_sent',
          installation_name: processInfo.config.installation_name,
          method: message.method
        }, `Sent notification: ${message.method}`);

        resolve(null);
        return;
      }

      // Set up response handler
      const timeoutHandle = setTimeout(() => {
        processInfo.activeRequests.delete(requestId);

        this.logger.error({
          operation: 'mcp_request_timeout',
          installation_name: processInfo.config.installation_name,
          request_id: requestId,
          method: message.method,
          timeout_ms: timeout
        }, `Request timeout: ${requestId}`);

        reject(new Error(`Request timeout: ${requestId}`));
      }, timeout);

      processInfo.activeRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        startTime: Date.now()
      });

      // Send message
      const messageStr = JSON.stringify(message) + '\n';
      processInfo.process.stdin?.write(messageStr, (error) => {
        if (error) {
          processInfo.activeRequests.delete(requestId);
          clearTimeout(timeoutHandle);

          this.logger.error({
            operation: 'mcp_message_send_failed',
            installation_name: processInfo.config.installation_name,
            request_id: requestId,
            error: error.message
          }, `Failed to send message: ${requestId}`);

          reject(error);
        }
      });

      processInfo.messageCount++;
      processInfo.lastActivity = Date.now();

      this.logger.debug({
        operation: 'mcp_request_sent',
        installation_name: processInfo.config.installation_name,
        request_id: requestId,
        method: message.method
      }, `Sent request: ${requestId}`);
    });
  }
}
