import { Logger } from 'pino';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';

/**
 * Cached tool from stdio MCP server
 */
export interface CachedStdioTool {
  serverName: string;           // Installation name (e.g., "filesystem-john-abc123")
  originalName: string;         // Tool name from server (e.g., "read_file")
  namespacedName: string;       // User-facing name (e.g., "filesystem-read_file")
  description: string;          // Tool description
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;            // JSON Schema for tool parameters
}

/**
 * StdioToolDiscoveryManager
 * 
 * Manages tool discovery and caching for stdio-based MCP servers.
 * Tools are discovered after successful process spawn and handshake.
 * Tools remain cached even when processes go dormant for fast respawn.
 * Tools are only cleared when servers are explicitly uninstalled.
 */
export class StdioToolDiscoveryManager {
  private toolCache = new Map<string, CachedStdioTool>();
  private toolsByServer = new Map<string, Set<string>>();
  
  constructor(
    private processManager: ProcessManager,
    private runtimeState: RuntimeState,
    private logger: Logger
  ) {
    // NOTE: We do NOT clear tools on process termination
    // Tools remain cached even when processes go dormant
    // This allows instant tool calls - the process will respawn automatically
    // Only clear tools when explicitly requested (e.g., server uninstalled)
  }

  /**
   * Discover tools from a running MCP server process
   */
  async discoverTools(installationName: string): Promise<CachedStdioTool[]> {
    const processInfo = this.processManager.getProcessByName(installationName);
    if (!processInfo) {
      throw new Error(`Process ${installationName} not found`);
    }

    if (processInfo.status !== 'running') {
      throw new Error(`Process ${installationName} is not running (status: ${processInfo.status})`);
    }

    this.logger.info({
      operation: 'stdio_tool_discovery_start',
      installation_name: installationName,
      team_id: processInfo.config.team_id
    }, `Discovering tools from stdio MCP server: ${installationName}`);

    try {
      // Send tools/list request to MCP server
      const request = {
        jsonrpc: '2.0',
        id: `tools-list-${Date.now()}`,
        method: 'tools/list',
        params: {}
      };

      this.logger.debug({
        operation: 'stdio_tool_discovery_request',
        installation_name: installationName,
        request_id: request.id
      }, `Sending tools/list request to ${installationName}`);

      const response = await this.processManager.sendMessage(processInfo, request, 30000);

      this.logger.debug({
        operation: 'stdio_tool_discovery_response_received',
        installation_name: installationName,
        request_id: request.id,
        has_response: !!response,
        has_tools: !!(response && response.tools),
        tools_is_array: !!(response && response.tools && Array.isArray(response.tools)),
        tools_count: response && response.tools ? response.tools.length : 0,
        response_keys: response ? Object.keys(response) : [],
        full_response: JSON.stringify(response)
      }, `Received response from ${installationName}`);

      // The process should remain running for tool execution.
      // Shutdown is only sent when the process is being intentionally terminated.

      if (!response || !response.tools || !Array.isArray(response.tools)) {
        this.logger.warn({
          operation: 'stdio_tool_discovery_empty',
          installation_name: installationName,
          response: JSON.stringify(response).substring(0, 200)
        }, `No tools returned from ${installationName}`);
        return [];
      }

      // Extract server slug from installation name (e.g., "filesystem-john-abc123" -> "filesystem")
      const serverSlug = this.extractServerSlug(installationName);
      
      const cachedTools: CachedStdioTool[] = [];
      const toolSet = new Set<string>();

      for (const tool of response.tools) {
        const namespacedName = `${serverSlug}-${tool.name}`;
        
        const cachedTool: CachedStdioTool = {
          serverName: installationName,
          originalName: tool.name,
          namespacedName: namespacedName,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {}
        };

        this.toolCache.set(namespacedName, cachedTool);
        toolSet.add(namespacedName);
        cachedTools.push(cachedTool);
      }

      this.toolsByServer.set(installationName, toolSet);

      this.logger.info({
        operation: 'stdio_tool_discovery_success',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        tool_count: cachedTools.length,
        tools: cachedTools.map(t => t.namespacedName)
      }, `Discovered ${cachedTools.length} tools from ${installationName}`);

      return cachedTools;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'stdio_tool_discovery_failed',
        installation_name: installationName,
        error: errorMessage
      }, `Failed to discover tools from ${installationName}`);
      throw error;
    }
  }

  /**
   * Get a specific tool by namespaced name
   */
  getTool(namespacedName: string): CachedStdioTool | null {
    return this.toolCache.get(namespacedName) || null;
  }

  /**
   * Get all cached stdio tools
   */
  getAllTools(): CachedStdioTool[] {
    return Array.from(this.toolCache.values());
  }

  /**
   * Get tools for a specific server
   */
  getServerTools(installationName: string): CachedStdioTool[] {
    const toolSet = this.toolsByServer.get(installationName);
    if (!toolSet) {
      return [];
    }

    return Array.from(toolSet)
      .map(namespacedName => this.toolCache.get(namespacedName))
      .filter((tool): tool is CachedStdioTool => tool !== undefined);
  }

  /**
   * Clear tools for a specific server (called when server is uninstalled or config changes)
   * NOT called on dormant termination - tools remain cached for fast respawn
   */
  clearServerTools(installationName: string): void {
    const toolSet = this.toolsByServer.get(installationName);
    if (!toolSet) {
      return;
    }

    let clearedCount = 0;
    for (const namespacedName of toolSet) {
      if (this.toolCache.delete(namespacedName)) {
        clearedCount++;
      }
    }

    this.toolsByServer.delete(installationName);

    this.logger.info({
      operation: 'stdio_tools_cleared',
      installation_name: installationName,
      tools_cleared: clearedCount
    }, `Cleared ${clearedCount} tools for ${installationName}`);
  }

  /**
   * Clear all cached tools
   */
  clearAllTools(): void {
    const totalTools = this.toolCache.size;
    this.toolCache.clear();
    this.toolsByServer.clear();

    this.logger.info({
      operation: 'stdio_tools_cleared_all',
      tools_cleared: totalTools
    }, `Cleared all ${totalTools} stdio tools from cache`);
  }

  /**
   * Get statistics about cached tools
   */
  getStats(): {
    total_tools: number;
    total_servers: number;
    tools_by_server: Record<string, number>;
  } {
    const stats = {
      total_tools: this.toolCache.size,
      total_servers: this.toolsByServer.size,
      tools_by_server: {} as Record<string, number>
    };

    for (const [serverName, toolSet] of this.toolsByServer.entries()) {
      stats.tools_by_server[serverName] = toolSet.size;
    }

    return stats;
  }

  /**
   * Extract server slug from installation name
   * Examples:
   *   "filesystem-john-R36no6FGoMFEZO9nWJJLT" -> "filesystem"
   *   "context7-alice-S47mp8GHpNGFZP0oWKKMU" -> "context7"
   */
  private extractServerSlug(installationName: string): string {
    // Installation name format: {server_slug}-{team_slug}-{installation_id}
    // Take everything before the first hyphen
    const parts = installationName.split('-');
    return parts[0] || installationName;
  }
}
