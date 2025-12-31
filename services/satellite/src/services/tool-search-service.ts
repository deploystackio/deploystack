import Fuse, { IFuseOptions } from 'fuse.js';
import { FastifyBaseLogger } from 'fastify';
import { UnifiedToolDiscoveryManager, UnifiedCachedTool } from './unified-tool-discovery-manager';
import { DynamicConfigManager } from './dynamic-config-manager';

/**
 * Searchable tool format for Fuse.js
 */
interface SearchableTool {
  serverName: string;           // Installation name (e.g., "filesystem-john-abc123")
  serverSlug: string;           // Friendly name (e.g., "filesystem")
  toolName: string;             // Original tool name (e.g., "read_file")
  namespacedName: string;       // Namespaced name (e.g., "filesystem-read_file")
  description: string;          // Tool description
  transport: 'stdio' | 'http' | 'sse';
}

/**
 * Search result format
 */
export interface ToolSearchResult {
  tool_path: string;            // Format: "serverSlug:toolName" (e.g., "filesystem:read_file")
  description: string;          // Tool description
  server_name: string;          // Friendly server name
  transport: 'stdio' | 'http' | 'sse';
  score?: number;               // Relevance score (lower is better, 0 = perfect match)
}

/**
 * ToolSearchService
 *
 * Provides full-text search across all discovered MCP tools using Fuse.js.
 * Queries UnifiedToolDiscoveryManager directly as single source of truth.
 * No cache duplication - builds Fuse.js index on-demand for each search.
 * Filters out disabled tools from search results.
 */
export class ToolSearchService {
  private logger: FastifyBaseLogger;
  private toolDiscoveryManager: UnifiedToolDiscoveryManager;
  private configManager?: DynamicConfigManager;

  constructor(
    toolDiscoveryManager: UnifiedToolDiscoveryManager,
    logger: FastifyBaseLogger
  ) {
    this.toolDiscoveryManager = toolDiscoveryManager;
    this.logger = logger.child({ component: 'ToolSearchService' });

    this.logger.info({
      operation: 'tool_search_service_created'
    }, 'Tool search service created - using UnifiedToolDiscoveryManager as single source of truth');
  }

  /**
   * Set dynamic configuration manager for disabled tool filtering
   */
  setConfigManager(configManager: DynamicConfigManager): void {
    this.configManager = configManager;
    this.logger.debug({
      operation: 'tool_search_config_manager_set'
    }, 'Dynamic configuration manager set for disabled tool filtering');
  }

  /**
   * Search for tools matching the query
   * Queries toolDiscoveryManager.getAllTools() directly - no cache duplication
   * Filters out disabled tools from results
   */
  search(query: string, limit: number = 10): ToolSearchResult[] {
    const startTime = Date.now();

    // Get tools from single source of truth
    const allTools = this.toolDiscoveryManager.getAllTools();

    if (allTools.length === 0) {
      this.logger.warn({
        operation: 'tool_search_no_tools',
        query: query
      }, 'No tools available for search');
      return [];
    }

    // Filter out disabled tools
    const enabledTools = this.filterDisabledTools(allTools);

    // Convert to searchable format
    const searchableTools = this.flattenTools(enabledTools);

    // Build Fuse.js index on-demand
    const fuseOptions: IFuseOptions<SearchableTool> = {
      includeScore: true,
      threshold: 0.5,
      ignoreLocation: true,
      useExtendedSearch: true,
      minMatchCharLength: 2,
      keys: [
        { name: 'toolName', weight: 0.4 },
        { name: 'description', weight: 0.35 },
        { name: 'serverSlug', weight: 0.25 }
      ]
    };

    const fuse = new Fuse(searchableTools, fuseOptions);

    // Execute search
    const results = fuse.search(query, { limit });
    const searchTime = Date.now() - startTime;

    const disabledCount = allTools.length - enabledTools.length;
    this.logger.info({
      operation: 'tool_search_executed',
      query: query,
      total_tools: allTools.length,
      enabled_tools_searched: searchableTools.length,
      disabled_tools_filtered: disabledCount,
      results_count: results.length,
      search_time_ms: searchTime,
      limit: limit
    }, `Search completed: "${query}" found ${results.length}/${searchableTools.length} tools in ${searchTime}ms (${disabledCount} disabled filtered)`);

    return results.map(result => {
      const tool = result.item;
      return {
        tool_path: `${tool.serverSlug}:${tool.toolName}`,
        description: tool.description,
        server_name: tool.serverName,
        transport: tool.transport,
        score: result.score
      };
    });
  }

  /**
   * Filter out disabled tools from the tool list
   */
  private filterDisabledTools(tools: UnifiedCachedTool[]): UnifiedCachedTool[] {
    if (!this.configManager) {
      // No config manager - return all tools
      return tools;
    }

    return tools.filter(tool => {
      const config = this.configManager!.getMcpServerConfig(tool.serverName);
      if (!config?.installation_id) {
        // No installation_id - can't check disabled status, include tool
        return true;
      }

      const isDisabled = this.toolDiscoveryManager.isToolDisabled(
        config.installation_id,
        tool.originalName
      );

      if (isDisabled) {
        this.logger.debug({
          operation: 'tool_search_filtered_disabled',
          tool_name: tool.originalName,
          server_slug: tool.serverSlug,
          installation_id: config.installation_id
        }, `Filtered disabled tool from search: ${tool.serverSlug}:${tool.originalName}`);
      }

      return !isDisabled;
    });
  }

  /**
   * Flatten unified tools into searchable format
   */
  private flattenTools(tools: UnifiedCachedTool[]): SearchableTool[] {
    return tools.map(tool => ({
      serverName: tool.serverName,
      serverSlug: tool.serverSlug, // Use stored serverSlug directly
      toolName: tool.originalName,
      namespacedName: tool.namespacedName,
      description: tool.description,
      transport: tool.transport
    }));
  }

  /**
   * List all available tools without search filtering
   * Used when query is "*" to return all tools
   * Filters out disabled tools
   */
  listAll(limit: number = 20): ToolSearchResult[] {
    const startTime = Date.now();

    // Get tools from single source of truth
    const allTools = this.toolDiscoveryManager.getAllTools();

    if (allTools.length === 0) {
      this.logger.warn({
        operation: 'tool_list_all_no_tools'
      }, 'No tools available');
      return [];
    }

    // Filter out disabled tools
    const enabledTools = this.filterDisabledTools(allTools);

    // Convert to searchable format
    const searchableTools = this.flattenTools(enabledTools);

    const listTime = Date.now() - startTime;

    this.logger.info({
      operation: 'tool_list_all_executed',
      total_tools: allTools.length,
      enabled_tools: searchableTools.length,
      returned_tools: Math.min(searchableTools.length, limit),
      list_time_ms: listTime,
      limit: limit
    }, `List all completed: returning ${Math.min(searchableTools.length, limit)}/${searchableTools.length} tools in ${listTime}ms`);

    // Return up to limit tools
    return searchableTools.slice(0, limit).map(tool => ({
      tool_path: `${tool.serverSlug}:${tool.toolName}`,
      description: tool.description,
      server_name: tool.serverName,
      transport: tool.transport,
      score: 0 // Perfect score for direct listing
    }));
  }

  /**
   * Get total count of enabled tools (for wildcard truncation message)
   */
  getEnabledToolCount(): number {
    const allTools = this.toolDiscoveryManager.getAllTools();
    const enabledTools = this.filterDisabledTools(allTools);
    return enabledTools.length;
  }

  /**
   * Get statistics about search service
   */
  getStats() {
    const allTools = this.toolDiscoveryManager.getAllTools();
    const counts: Record<string, number> = {
      stdio: 0,
      http: 0,
      sse: 0
    };

    for (const tool of allTools) {
      counts[tool.transport] = (counts[tool.transport] || 0) + 1;
    }
    
    return {
      total_tools: allTools.length,
      tools_by_transport: counts
    };
  }
}
