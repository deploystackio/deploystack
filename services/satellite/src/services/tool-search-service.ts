import Fuse, { IFuseOptions } from 'fuse.js';
import { FastifyBaseLogger } from 'fastify';
import { UnifiedToolDiscoveryManager, UnifiedCachedTool } from './unified-tool-discovery-manager';

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
 */
export class ToolSearchService {
  private logger: FastifyBaseLogger;
  private toolDiscoveryManager: UnifiedToolDiscoveryManager;

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
   * Search for tools matching the query
   * Queries toolDiscoveryManager.getAllTools() directly - no cache duplication
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
    
    // Convert to searchable format
    const searchableTools = this.flattenTools(allTools);
    
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

    this.logger.info({
      operation: 'tool_search_executed',
      query: query,
      total_tools_searched: searchableTools.length,
      results_count: results.length,
      search_time_ms: searchTime,
      limit: limit
    }, `Search completed: "${query}" found ${results.length}/${searchableTools.length} tools in ${searchTime}ms`);

    return results.map(result => {
      const tool = result.item;
      return {
        tool_path: `${tool.serverSlug}:${tool.toolName}`,
        description: tool.description,
        server_name: tool.serverSlug,
        transport: tool.transport,
        score: result.score
      };
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
