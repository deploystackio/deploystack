import { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { ProxyRequestContext, ProxyResponse } from '../types/mcp-server';
import { DynamicConfigManager, DynamicMcpServersConfig } from './dynamic-config-manager';
import { maskUrlForLogging } from '../utils/log-masker';

/**
 * HTTP Proxy Manager
 * Manages JSON-RPC proxy requests to external MCP servers
 */
export class HttpProxyManager {
  private fastify: FastifyInstance;
  private logger: FastifyBaseLogger;
  private configManager?: DynamicConfigManager;

  constructor(fastify: FastifyInstance, logger: FastifyBaseLogger) {
    this.fastify = fastify;
    this.logger = logger;
  }

  /**
   * Set dynamic configuration manager
   */
  setConfigManager(configManager: DynamicConfigManager): void {
    this.configManager = configManager;
    this.logger.debug({
      operation: 'http_proxy_config_manager_set'
    }, 'Dynamic configuration manager set for HTTP proxy');
  }

  /**
   * Initialize HTTP proxy manager for MCP JSON-RPC requests
   */
  async initialize(): Promise<void> {
    this.logger.debug({
      operation: 'http_proxy_manager_init'
    }, 'Initializing HTTP Proxy Manager for MCP JSON-RPC...');

    if (!this.configManager) {
      this.logger.warn({
        operation: 'http_proxy_no_config_manager'
      }, 'No configuration manager set, using empty configuration');
      return;
    }

    const enabledServers = this.configManager.getEnabledMcpServers();
    const serverCount = Object.keys(enabledServers).length;

    this.logger.debug({
      operation: 'http_proxy_manager_servers',
      server_count: serverCount,
      servers: Object.keys(enabledServers)
    }, `Found ${serverCount} enabled MCP servers for JSON-RPC proxy`);

    // Store server configurations for JSON-RPC proxying
    for (const [serverName, config] of Object.entries(enabledServers)) {
      this.logger.debug({
        operation: 'mcp_server_registered',
        server_name: serverName,
        upstream_url: maskUrlForLogging(config.url, config.secret_metadata?.query_params),
        has_headers: !!config.headers
      }, `Registered MCP server for JSON-RPC proxy: ${serverName}`);
    }

    this.logger.debug({
      operation: 'http_proxy_manager_ready',
      total_servers: serverCount
    }, 'HTTP Proxy Manager initialized for MCP JSON-RPC requests');
  }

  /**
   * Proxy MCP JSON-RPC request to external server
   */
  async proxyMcpJsonRpcRequest(
    serverName: string, 
    jsonRpcRequest: unknown,
    context: ProxyRequestContext
  ): Promise<ProxyResponse> {
    const startTime = Date.now();

    this.logger.debug({
      operation: 'mcp_jsonrpc_proxy_request',
      server_name: serverName,
      method: context.method,
      request_id: context.requestId,
      transport: context.transport
    }, `Proxying MCP JSON-RPC request to ${serverName}`);

    if (!this.configManager) {
      return {
        success: false,
        error: 'Configuration manager not available',
        statusCode: 500
      };
    }

    // Check if server is enabled
    if (!this.configManager.isMcpServerEnabled(serverName)) {
      return {
        success: false,
        error: `MCP server '${serverName}' is not enabled or does not exist`,
        statusCode: 404
      };
    }

    const config = this.configManager.getMcpServerConfig(serverName);
    if (!config) {
      return {
        success: false,
        error: `MCP server '${serverName}' configuration not found`,
        statusCode: 404
      };
    }

    try {
      // Prepare headers with environment variable substitution
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'User-Agent': 'Mozilla/5.0 (compatible; DeployStack-Satellite/1.0; +https://deploystack.io)',
        'MCP-Protocol-Version': '2025-03-26',
        'X-Forwarded-By': 'deploystack-satellite',
        'X-Proxy-Server': serverName
      };

      // Add custom headers from config
      if (config.headers) {
        for (const [key, value] of Object.entries(config.headers)) {
          const processedValue = this.processHeaderValue(value);
          headers[key] = processedValue;
        }
      }

      // Validate URL for HTTP/SSE transport
      if (!config.url) {
        return {
          success: false,
          error: `MCP server '${serverName}' has no URL configured (required for HTTP transport)`,
          statusCode: 500
        };
      }

      // this.logger.debug({
      //   operation: 'mcp_proxy_request_details',
      //   server_name: serverName,
      //   target_url: config.url,
      //   method: 'POST'
      // }, `Making HTTP request to ${config.url}`);

      // Make HTTP request to external MCP server
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(jsonRpcRequest)
      });

      // this.logger.debug({
      //   operation: 'mcp_proxy_response_details',
      //   server_name: serverName,
      //   target_url: config.url,
      //   status_code: response.status,
      //   status_text: response.statusText,
      //   content_type: response.headers.get('content-type')
      // }, `Received response from ${config.url} - Status: ${response.status} ${response.statusText}`);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        this.logger.error({
          operation: 'mcp_jsonrpc_proxy_failed',
          server_name: serverName,
          status_code: response.status,
          status_text: response.statusText,
          response_time_ms: responseTime
        }, `MCP JSON-RPC proxy request failed for ${serverName}`);

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          responseTime
        };
      }

      // Handle different response types based on Content-Type
      const contentType = response.headers.get('content-type') || '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let responseData: any;

      if (contentType.includes('text/event-stream')) {
        // Handle SSE response
        const sseText = await response.text();
        responseData = this.parseSSEResponse(sseText);
        
        this.logger.debug({
          operation: 'mcp_jsonrpc_proxy_sse_parsed',
          server_name: serverName,
          sse_length: sseText.length,
          parsed_data: responseData
        }, `Parsed SSE response from ${serverName}`);
      } else {
        // Handle regular JSON response
        responseData = await response.json();
      }

      this.logger.info({
        operation: 'mcp_jsonrpc_proxy_success',
        server_name: serverName,
        method: context.method,
        request_id: context.requestId,
        response_time_ms: responseTime,
        content_type: contentType
      }, `MCP JSON-RPC request proxied successfully to ${serverName}`);

      return {
        success: true,
        data: responseData,
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'mcp_jsonrpc_proxy_failed',
        server_name: serverName,
        method: context.method,
        request_id: context.requestId,
        error: errorMessage,
        response_time_ms: responseTime
      }, `MCP JSON-RPC proxy request failed for ${serverName}`);

      return {
        success: false,
        error: errorMessage,
        statusCode: 500,
        responseTime
      };
    }
  }

  /**
   * Process header values with environment variable substitution
   */
  private processHeaderValue(value: string): string {
    // Replace ${VAR_NAME} with environment variable values
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = process.env[varName];
      if (!envValue) {
        this.logger.warn({
          operation: 'env_var_missing',
          variable_name: varName,
          original_value: value
        }, `Environment variable ${varName} not found, using placeholder`);
        return match; // Keep placeholder if env var not found
      }
      return envValue;
    });
  }

  /**
   * Parse Server-Sent Events (SSE) response to extract JSON-RPC data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseSSEResponse(sseText: string): any {
    const lines = sseText.split('\n');
    let jsonData = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6); // Remove 'data: ' prefix
        if (data.trim() && data !== '[DONE]') {
          jsonData += data;
        }
      }
    }
    
    if (!jsonData) {
      throw new Error('No valid JSON data found in SSE response');
    }
    
    try {
      return JSON.parse(jsonData);
    } catch (error) {
      this.logger.error({
        operation: 'sse_parse_failed',
        sse_text: sseText.substring(0, 200) + '...',
        json_data: jsonData.substring(0, 200) + '...',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to parse JSON from SSE response');
      
      throw new Error(`Failed to parse JSON from SSE response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get list of available MCP servers for tools/list
   */
  getAvailableServers() {
    if (!this.configManager) {
      return [];
    }

    const enabledServers = this.configManager.getEnabledMcpServers();
    return Object.keys(enabledServers).map(serverName => ({
      name: serverName,
      description: `External MCP server: ${serverName}`,
      inputSchema: {
        type: 'object',
        properties: {
          method: { type: 'string', description: 'MCP method to call' },
          params: { type: 'object', description: 'MCP method parameters' }
        },
        required: ['method']
      }
    }));
  }

  /**
   * Get proxy statistics
   */
  getProxyStats() {
    if (!this.configManager) {
      return {
        total_servers: 0,
        servers: [],
        enabled_servers: {}
      };
    }

    const enabledServers = this.configManager.getEnabledMcpServers();
    return {
      total_servers: Object.keys(enabledServers).length,
      servers: Object.keys(enabledServers),
      enabled_servers: enabledServers
    };
  }

  /**
   * Handle configuration updates
   */
  async handleConfigurationUpdate(config: DynamicMcpServersConfig): Promise<void> {
    this.logger.debug({
      operation: 'http_proxy_config_update',
      server_count: Object.keys(config.servers).length
    }, 'HTTP Proxy Manager configuration updated');

    // Re-initialize with new configuration
    await this.initialize();
  }
}
