/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn, ChildProcess } from 'child_process';
import ora from 'ora';
import { MCPServerConfig } from '../../types/mcp';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolDiscoveryResult {
  serverName: string;
  tools: MCPTool[];
  error?: string;
}

export class ToolDiscoveryService {
  /**
   * Discover tools from an MCP server by spawning it temporarily
   */
  async discoverTools(config: MCPServerConfig): Promise<ToolDiscoveryResult> {
    const spinner = ora(`Discovering tools from ${config.installation_name}...`).start();
    
    let childProcess: ChildProcess | null = null;
    
    try {
      // Debug: Show the command being executed
      const commandStr = `${config.command} ${config.args.join(' ')}`;
      spinner.text = `Spawning: ${commandStr}`;
      
      // Spawn the MCP server process
      childProcess = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env },
        cwd: process.cwd()
      });

      // Set up error handling and capture stderr
      let stderrOutput = '';
      childProcess.stderr?.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      const processError = new Promise<never>((_, reject) => {
        childProcess!.on('error', (error) => {
          reject(new Error(`Failed to spawn process: ${error.message}`));
        });
        
        childProcess!.on('exit', (code, signal) => {
          if (code !== 0) {
            const errorMsg = stderrOutput 
              ? `Process exited with code ${code} (signal: ${signal})\nStderr: ${stderrOutput.trim()}`
              : `Process exited with code ${code} (signal: ${signal})`;
            reject(new Error(errorMsg));
          }
        });
      });

      // Perform MCP handshake and tool discovery
      const discoveryResult = await Promise.race([
        this.performToolDiscovery(childProcess, config),
        processError,
        this.createTimeout(15000) // 15 second timeout
      ]);

      spinner.succeed(`Found ${discoveryResult.tools.length} tool${discoveryResult.tools.length === 1 ? '' : 's'} in ${config.installation_name}`);
      
      return discoveryResult;

    } catch (error) {
      spinner.fail(`Failed to discover tools from ${config.installation_name}`);
      
      return {
        serverName: config.installation_name,
        tools: [],
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // FIXED: Proper graceful shutdown with waiting
      if (childProcess && !childProcess.killed) {
        await this.gracefulShutdown(childProcess);
      }
    }
  }

  /**
   * FIXED: Implement proper graceful shutdown
   */
  private async gracefulShutdown(childProcess: ChildProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      // Set up exit handler
      const onExit = () => {
        resolve();
      };

      childProcess.once('exit', onExit);
      childProcess.once('close', onExit);

      // 1. Try graceful shutdown first (SIGTERM)
      childProcess.kill('SIGTERM');

      // 2. Wait up to 2 seconds for graceful exit
      const forceKillTimeout = setTimeout(() => {
        if (!childProcess.killed) {
          // 3. Force kill if still running
          childProcess.kill('SIGKILL');
          
          // Wait a bit more for SIGKILL to take effect
          setTimeout(() => {
            resolve();
          }, 500);
        }
      }, 2000);

      // Cleanup timeout if process exits gracefully
      childProcess.once('exit', () => {
        clearTimeout(forceKillTimeout);
      });
    });
  }

  /**
   * Perform MCP handshake and tool discovery
   */
  private async performToolDiscovery(process: ChildProcess, config: MCPServerConfig): Promise<ToolDiscoveryResult> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      const activeRequests = new Map<string, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
      }>();

      // Handle stdout responses
      process.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        lines.forEach(line => {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              
              if (message.id && activeRequests.has(message.id)) {
                const request = activeRequests.get(message.id)!;
                activeRequests.delete(message.id);
                
                if (message.error) {
                  request.reject(new Error(message.error.message || 'MCP server error'));
                } else {
                  request.resolve(message.result || message);
                }
              }
            } catch {
              // Ignore parse errors for non-JSON lines
            }
          }
        });
      });

      // Helper to send JSON-RPC message
      const sendMessage = (message: any): Promise<any> => {
        return new Promise((msgResolve, msgReject) => {
          if (message.id) {
            activeRequests.set(message.id, {
              resolve: msgResolve,
              reject: msgReject
            });
          }

          const messageStr = JSON.stringify(message) + '\n';
          process.stdin?.write(messageStr, (error) => {
            if (error) {
              if (message.id) {
                activeRequests.delete(message.id);
              }
              msgReject(error);
            } else if (!message.id) {
              // Notification - resolve immediately
              msgResolve(null);
            }
          });
        });
      };

      // Perform the discovery sequence
      (async () => {
        try {
          // Step 1: Initialize
          const initResponse = await sendMessage({
            jsonrpc: '2.0',
            id: 'init-1',
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              clientInfo: {
                name: 'deploystack-gateway-tool-discovery',
                version: '1.0.0'
              },
              capabilities: {
                roots: { listChanged: false },
                sampling: {}
              }
            }
          });

          if (!initResponse || !initResponse.serverInfo) {
            throw new Error('Invalid initialization response');
          }

          // Step 2: Send initialized notification
          await sendMessage({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
          });

          // Step 3: List tools
          const toolsResponse = await sendMessage({
            jsonrpc: '2.0',
            id: 'tools-list-1',
            method: 'tools/list'
          });

          const tools: MCPTool[] = toolsResponse.tools || [];

          // ADDED: Step 4: Send shutdown notification for clean exit
          try {
            await sendMessage({
              jsonrpc: '2.0',
              method: 'notifications/shutdown'
            });
          } catch {
            // Ignore shutdown notification errors
          }

          resolve({
            serverName: config.installation_name,
            tools
          });

        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool discovery timeout after ${ms}ms`));
      }, ms);
    });
  }
}
