import { Logger } from 'pino';
import { ProcessInfo, PendingRequest } from './types';
import { LogBuffer, parseNsjailLog, inferMcpLogLevel } from './log-buffer';

/**
 * Callback types for process event handlers
 */
export type MessageCallback = (processInfo: ProcessInfo, message: unknown) => void;
export type ExitCallback = (processInfo: ProcessInfo, code: number | null, signal: NodeJS.Signals | null) => void;
export type ErrorCallback = (processInfo: ProcessInfo, error: Error) => void;

/**
 * McpProtocolHandler manages MCP JSON-RPC protocol communication
 * Handles handshake, message sending/receiving, and process I/O setup
 */
export class McpProtocolHandler {
  constructor(
    private logger: Logger,
    private logBuffer: LogBuffer
  ) {}

  /**
   * Setup process event handlers for stdout, stderr, exit, and error
   */
  setupProcessHandlers(
    processInfo: ProcessInfo,
    onMessage: MessageCallback,
    onExit: ExitCallback,
    onError: ErrorCallback
  ): void {
    const { process: childProcess, config } = processInfo;

    // Handle stdout (JSON-RPC responses)
    let buffer = '';
    childProcess.stdout?.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      lines.forEach(line => {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleServerMessage(processInfo, message, onMessage);
          } catch (error) {
            this.logger.error({
              operation: 'mcp_stdout_parse_error',
              installation_name: config.installation_name,
              line: line,
              error: error instanceof Error ? error.message : String(error)
            }, `Failed to parse stdout from ${config.installation_name}`);
          }
        }
      });
    });

    // Handle stderr (informational logging from MCP server)
    childProcess.stderr?.on('data', (data) => {
      const stderrOutput = data.toString().trim();
      if (stderrOutput) {
        // Log informational stderr output at debug level (not errors)
        this.logger.debug({
          operation: 'mcp_stderr_info',
          installation_name: config.installation_name,
          output: stderrOutput
        }, `MCP server info: ${config.installation_name}`);

        // Buffer stderr output for mcp.server.logs event
        // Split by newlines in case there are multiple log lines
        const lines = stderrOutput.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Check if this is an nsjail log
          const nsjailLog = parseNsjailLog(trimmedLine);

          if (nsjailLog) {
            // nsjail log detected - filter out INFO level (infrastructure noise)
            if (nsjailLog.level === 'I') {
              // Skip nsjail INFO logs (Mount, Uid map, Jail parameters, etc.)
              continue;
            }
            // Keep nsjail WARNING/ERROR/FATAL logs with correct level mapping
            const level: 'warn' | 'error' = nsjailLog.level === 'W' ? 'warn' : 'error';
            this.logBuffer.add({
              installation_id: config.installation_id,
              team_id: config.team_id,
              user_id: config.user_id,
              level,
              message: nsjailLog.message,
              timestamp: new Date().toISOString()
            });
          } else {
            // MCP server log - infer level from content
            this.logBuffer.add({
              installation_id: config.installation_id,
              team_id: config.team_id,
              user_id: config.user_id,
              level: inferMcpLogLevel(trimmedLine),
              message: trimmedLine,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      onExit(processInfo, code, signal);
    });

    // Handle process errors (actual spawn/process errors)
    childProcess.on('error', (error) => {
      onError(processInfo, error);
    });
  }

  /**
   * Handle messages from MCP server
   */
  private handleServerMessage(
    processInfo: ProcessInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any,
    onNotification: MessageCallback
  ): void {
    processInfo.lastActivity = Date.now();

    if (message.id && processInfo.activeRequests.has(message.id)) {
      // Response to a request
      const request = processInfo.activeRequests.get(message.id)!;
      clearTimeout(request.timeout);
      processInfo.activeRequests.delete(message.id);

      const duration = Date.now() - request.startTime;

      if (message.error) {
        this.logger.error({
          operation: 'mcp_request_error',
          installation_name: processInfo.config.installation_name,
          request_id: message.id,
          error: message.error.message || 'Unknown MCP error',
          duration_ms: duration
        }, `MCP request failed: ${message.id}`);

        request.reject(new Error(message.error.message || 'MCP server error'));
      } else {
        this.logger.debug({
          operation: 'mcp_request_success',
          installation_name: processInfo.config.installation_name,
          request_id: message.id,
          duration_ms: duration
        }, `MCP request succeeded: ${message.id}`);

        request.resolve(message.result || message);
      }
    } else if (message.method) {
      // Notification from server
      this.logger.debug({
        operation: 'mcp_server_notification',
        installation_name: processInfo.config.installation_name,
        method: message.method
      }, `Received notification from ${processInfo.config.installation_name}: ${message.method}`);

      onNotification(processInfo, message);
    }
  }

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

      const pendingRequest: PendingRequest = {
        resolve,
        reject,
        timeout: timeoutHandle,
        startTime: Date.now()
      };

      processInfo.activeRequests.set(requestId, pendingRequest);

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

  /**
   * Perform MCP protocol handshake (initialize + initialized notification)
   */
  async performHandshake(processInfo: ProcessInfo): Promise<{ serverInfo: { name: string; version: string } }> {
    const initMessage = {
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-05',
        clientInfo: {
          name: 'deploystack-satellite',
          version: '1.0.0'
        },
        capabilities: {
          roots: { listChanged: false },
          sampling: {}
        }
      }
    };

    try {
      this.logger.debug({
        operation: 'mcp_handshake_start',
        installation_name: processInfo.config.installation_name
      }, `Performing MCP handshake with ${processInfo.config.installation_name}`);

      // Increase timeout to 30 seconds for MCP servers that need to download packages via npx
      const response = await this.sendMessage(processInfo, initMessage, 30000) as { serverInfo?: { name: string; version: string } };

      if (!response || !response.serverInfo) {
        throw new Error(`Invalid initialization response: ${JSON.stringify(response)}`);
      }

      this.logger.debug({
        operation: 'mcp_handshake_initialized',
        installation_name: processInfo.config.installation_name,
        server_name: response.serverInfo.name,
        server_version: response.serverInfo.version
      }, `MCP handshake successful with ${processInfo.config.installation_name}`);

      // Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };

      await this.sendMessage(processInfo, initializedNotification);

      return response as { serverInfo: { name: string; version: string } };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'mcp_handshake_failed',
        installation_name: processInfo.config.installation_name,
        error: errorMessage
      }, `MCP handshake failed for ${processInfo.config.installation_name}`);

      throw new Error(`MCP handshake failed: ${errorMessage}`);
    }
  }
}
