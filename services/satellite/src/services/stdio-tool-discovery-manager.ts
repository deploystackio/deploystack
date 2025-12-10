import { Logger } from 'pino';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';
import type { EventBus } from './event-bus';

/**
 * Status callback for Phase 10 local status tracking
 */
export type StdioServerStatusCallback = (
  serverSlug: string,
  status: 'online' | 'offline' | 'error' | 'requires_reauth' | 'connecting' | 'discovering_tools',
  message?: string
) => void;

/**
 * Cached tool from stdio MCP server
 */
export interface CachedStdioTool {
  serverName: string;           // Installation name (e.g., "filesystem-john-abc123")
  originalName: string;         // Tool name from server (e.g., "read_file")
  namespacedName: string;       // Namespaced name (e.g., "filesystem:read_file")
  description: string;          // Tool description
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;            // JSON Schema for tool parameters
  serverSlug: string;          // Server slug for tool_path format (e.g., "sequential")
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
  private statusCallback?: StdioServerStatusCallback;

  constructor(
    private processManager: ProcessManager,
    private runtimeState: RuntimeState,
    private logger: Logger,
    private eventBus?: EventBus
  ) {
    // NOTE: We do NOT clear tools on process termination
    // Tools remain cached even when processes go dormant
    // This allows instant tool calls - the process will respawn automatically
    // Only clear tools when explicitly requested (e.g., server uninstalled)
  }

  /**
   * Set status callback for Phase 10 local status tracking
   */
  setStatusCallback(callback: StdioServerStatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Emit status change event to backend
   */
  private emitStatusChange(
    installationId: string,
    teamId: string,
    status: 'provisioning' | 'command_received' | 'connecting' | 'discovering_tools' | 'syncing_tools' | 'online' | 'offline' | 'error' | 'requires_reauth' | 'permanently_failed',
    statusMessage?: string
  ): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.emit('mcp.server.status_changed', {
      installation_id: installationId,
      team_id: teamId,
      status,
      status_message: statusMessage,
      timestamp: new Date().toISOString()
    });

    this.logger.debug({
      operation: 'status_change_emitted',
      installation_id: installationId,
      team_id: teamId,
      status,
      status_message: statusMessage
    }, `Emitted status change: ${status}`);
  }

  /**
   * Determine status based on error type
   */
  private getStatusFromError(errorMessage: string): {
    status: 'offline' | 'error' | 'requires_reauth';
    message: string;
  } {
    const lowerError = errorMessage.toLowerCase();

    // Process spawn/connection errors -> offline
    if (lowerError.includes('spawn') ||
        lowerError.includes('enoent') ||
        lowerError.includes('not found') ||
        lowerError.includes('not running') ||
        lowerError.includes('timeout') ||
        lowerError.includes('timed out')) {
      return { status: 'offline', message: `Process error: ${errorMessage}` };
    }

    // Permission errors -> error with specific message
    if (lowerError.includes('eacces') ||
        lowerError.includes('permission denied')) {
      return { status: 'error', message: `Permission error: ${errorMessage}` };
    }

    // Default -> generic error
    return { status: 'error', message: errorMessage };
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
        tools_count: response && response.tools ? response.tools.length : 0
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

      // Get server slug from process config (e.g., "sequential", "brightdata-mcp-1")
      const serverSlug = processInfo.config.server_slug;

      const cachedTools: CachedStdioTool[] = [];
      const toolSet = new Set<string>();

      for (const tool of response.tools) {
        const namespacedName = `${serverSlug}:${tool.name}`;

        const cachedTool: CachedStdioTool = {
          serverName: installationName,
          originalName: tool.name,
          namespacedName: namespacedName,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
          serverSlug: serverSlug
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

      // Emit mcp.tools.discovered event with token counts
      try {
        // Import token counter utilities
        const { estimateMcpServerTokens } = await import('../utils/token-counter');

        // Calculate token consumption
        const mcpServer = {
          name: installationName,
          tools: cachedTools.map(t => ({
            name: t.originalName,
            description: t.description,
            inputSchema: t.inputSchema || {}
          }))
        };

        const tokenEstimate = estimateMcpServerTokens(mcpServer);

        // Build enhanced event payload
        this.eventBus?.emit('mcp.tools.discovered', {
          installation_id: processInfo.config.installation_id || installationName,
          installation_name: installationName,
          team_id: processInfo.config.team_id,
          server_slug: serverSlug,
          tool_count: cachedTools.length,
          total_tokens: tokenEstimate.totalTokens,
          tools: cachedTools.map((tool, index) => ({
            tool_name: tool.originalName,
            description: tool.description,
            input_schema: tool.inputSchema,
            token_count: tokenEstimate.tools[index]?.tokens || 0
          })),
          discovered_at: new Date().toISOString()
        });

        this.logger.info({
          operation: 'stdio_tools_discovered_event_emitted',
          installation_name: installationName,
          tool_count: cachedTools.length,
          total_tokens: tokenEstimate.totalTokens
        }, `Tool discovery event emitted to backend for ${installationName}`);
      } catch (error) {
        this.logger.warn({ error }, 'Failed to emit mcp.tools.discovered event (non-fatal)');
      }

      // Phase 10: Notify about successful discovery (set status to 'online')
      if (this.statusCallback) {
        this.statusCallback(serverSlug, 'online');
      }

      return cachedTools;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'stdio_tool_discovery_failed',
        installation_name: installationName,
        error: errorMessage
      }, `Failed to discover tools from ${installationName}`);

      // Emit status change based on error type
      const config = processInfo.config;
      if (config.installation_id && config.team_id) {
        const { status, message } = this.getStatusFromError(errorMessage);
        this.emitStatusChange(config.installation_id, config.team_id, status, message);
      }

      // Phase 10: Notify about discovery failure
      if (this.statusCallback) {
        const serverSlug = processInfo.config.server_slug;
        const { status, message } = this.getStatusFromError(errorMessage);
        this.statusCallback(serverSlug, status, message);
      }

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

}
