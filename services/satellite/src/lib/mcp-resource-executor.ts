/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { UnifiedResourceDiscoveryManager } from '../services/unified-resource-discovery-manager';
import { ProcessManager } from '../process';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { OAuthTokenService } from '../services/oauth-token-service';
import { getVersionString } from '../config/version';

/**
 * MCP Resource Executor
 *
 * Handles resource read operations for both stdio and HTTP/SSE MCP servers.
 * Follows the same patterns as McpToolExecutor for transport handling,
 * OAuth injection, and error handling.
 *
 * Resource content is never cached — always proxied on-demand.
 */
export class McpResourceExecutor {
  constructor(
    private logger: FastifyBaseLogger,
    private processManager: ProcessManager,
    private resourceDiscoveryManager: UnifiedResourceDiscoveryManager,
    private dynamicConfigManager: DynamicConfigManager,
    private oauthTokenService?: OAuthTokenService
  ) {
    this.logger = logger.child({ component: 'McpResourceExecutor' });
  }

  /**
   * Read a resource by its namespaced URI (hierarchical router format: serverSlug|originalUri)
   * @param namespacedUri - Resource URI in format "serverSlug|originalUri"
   * @param serverNameOverride - Optional installation name for direct routing (instance router)
   */
  async readResource(namespacedUri: string, serverNameOverride?: string): Promise<any> {
    this.logger.info({
      operation: 'resource_read_start',
      namespaced_uri: namespacedUri,
      server_name_override: serverNameOverride
    }, `Reading resource: ${namespacedUri}`);

    // Look up cached resource metadata
    const cachedResource = this.resourceDiscoveryManager.getResource(namespacedUri);
    if (!cachedResource) {
      throw new Error(`Resource not found: ${namespacedUri}`);
    }

    const serverName = serverNameOverride || cachedResource.serverName;
    const originalUri = cachedResource.originalUri;
    const transport = cachedResource.transport;

    this.logger.debug({
      operation: 'resource_read_routing',
      server_name: serverName,
      original_uri: originalUri,
      transport
    }, `Routing resource read to ${transport} server: ${serverName}`);

    if (transport === 'stdio') {
      return this.readStdioResource(serverName, originalUri);
    } else {
      return this.readHttpResource(serverName, originalUri);
    }
  }

  /**
   * Read a resource directly by original URI and server name (instance router shortcut)
   */
  async readResourceDirect(serverName: string, originalUri: string, transport: 'stdio' | 'http' | 'sse'): Promise<any> {
    this.logger.info({
      operation: 'resource_read_direct',
      server_name: serverName,
      original_uri: originalUri,
      transport
    }, `Reading resource directly: ${originalUri} from ${serverName}`);

    if (transport === 'stdio') {
      return this.readStdioResource(serverName, originalUri);
    } else {
      return this.readHttpResource(serverName, originalUri);
    }
  }

  /**
   * Read resource from stdio MCP server via ProcessManager
   */
  private async readStdioResource(serverName: string, originalUri: string): Promise<any> {
    const startTime = Date.now();

    // Get or respawn process if dormant
    const processInfo = await this.processManager.getOrRespawnProcess(serverName);

    if (processInfo.status !== 'running') {
      throw new Error(`stdio MCP server not running: ${serverName} (status: ${processInfo.status})`);
    }

    const request = {
      jsonrpc: '2.0',
      id: `resource-read-${Date.now()}`,
      method: 'resources/read',
      params: { uri: originalUri }
    };

    const response = await this.processManager.sendMessage(processInfo, request, 60000);
    const responseTime = Date.now() - startTime;

    if (response.error) {
      this.logger.error({
        operation: 'resource_read_stdio_error',
        server_name: serverName,
        uri: originalUri,
        error: response.error.message
      }, `stdio resource read failed: ${response.error.message}`);

      throw new Error(`stdio MCP server error: ${response.error.message}`);
    }

    this.logger.info({
      operation: 'resource_read_stdio_success',
      server_name: serverName,
      uri: originalUri,
      response_time_ms: responseTime
    }, `stdio resource read successful: ${originalUri} (${responseTime}ms)`);

    return response.result || response;
  }

  /**
   * Read resource from HTTP/SSE MCP server via SDK client
   */
  private async readHttpResource(serverName: string, originalUri: string): Promise<any> {
    const startTime = Date.now();

    const config = this.dynamicConfigManager.getMcpServerConfig(serverName);
    if (!config || !config.url) {
      throw new Error(`No URL configured for HTTP server: ${serverName}`);
    }

    // Build headers (same pattern as McpToolExecutor)
    let headers: Record<string, string> = {};
    headers['User-Agent'] = 'Mozilla/5.0 (compatible; DeployStack-Satellite/1.0; +https://deploystack.io)';

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    // OAuth token injection
    if (config.requires_oauth && this.oauthTokenService) {
      if (!config.installation_id || !config.user_id || !config.team_id) {
        throw new Error(
          `OAuth required but missing context for ${serverName}. ` +
          'Installation ID, User ID, and Team ID are required.'
        );
      }

      const tokens = await this.oauthTokenService.getTokens(
        config.installation_id,
        config.user_id,
        config.team_id
      );

      if (!tokens) {
        throw new Error(`Failed to retrieve OAuth tokens for ${serverName}`);
      }

      headers['Authorization'] = `Bearer ${tokens.access_token}`;
    }

    // Create MCP client
    const client = new Client({
      name: 'deploystack-satellite',
      version: getVersionString()
    });

    // Build URL with query parameters
    const finalUrl = this.buildUrl(config.url, config.url_query_params);
    const transportType = config.transport_type || 'http';
    const serverUrl = new URL(finalUrl);

    const transport = transportType === 'sse'
      ? new SSEClientTransport(serverUrl)
      : new StreamableHTTPClientTransport(serverUrl);

    // Patch global fetch for header injection (same pattern as McpToolExecutor)
    let originalGlobalFetch: typeof fetch | null = null;
    if (Object.keys(headers).length > 0) {
      originalGlobalFetch = global.fetch;
      global.fetch = async (input: any, init?: any) => {
        const mergedHeaders: Record<string, string> = {};

        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((value: string, key: string) => {
              mergedHeaders[key] = value;
            });
          } else {
            Object.assign(mergedHeaders, init.headers);
          }
        }

        Object.assign(mergedHeaders, headers);

        return originalGlobalFetch!(input, { ...init, headers: mergedHeaders });
      };
    }

    try {
      await client.connect(transport);

      const response = await client.readResource({ uri: originalUri });
      const responseTime = Date.now() - startTime;

      this.logger.info({
        operation: 'resource_read_http_success',
        server_name: serverName,
        uri: originalUri,
        response_time_ms: responseTime
      }, `HTTP resource read successful: ${originalUri} (${responseTime}ms)`);

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'resource_read_http_error',
        server_name: serverName,
        uri: originalUri,
        error: errorMessage,
        response_time_ms: responseTime
      }, `HTTP resource read failed: ${errorMessage}`);

      throw new Error(`HTTP MCP server error: ${errorMessage}`);

    } finally {
      if (originalGlobalFetch) {
        global.fetch = originalGlobalFetch;
      }

      try {
        await client.close();
      } catch (closeError) {
        this.logger.warn({
          operation: 'resource_read_client_close_failed',
          server_name: serverName,
          error: closeError instanceof Error ? closeError.message : String(closeError)
        }, `Failed to close client after resource read`);
      }
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(baseUrl: string, queryParams?: Record<string, string>): string {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }
}
