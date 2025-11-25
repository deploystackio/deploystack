import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../db';
import { JobQueueService } from './jobQueueService';
import { getSchema } from '../db/index';
import { inArray } from 'drizzle-orm';

/**
 * Sync configuration options
 */
interface SyncConfig {
  maxServers: number | null; // null = no limit
  skipExisting: boolean;
  forceRefresh: boolean;
  rateLimitDelay: number; // seconds between jobs
}

/**
 * Sync statistics returned when sync is triggered
 */
interface SyncStats {
  batchId: string;
  totalServers: number;
  jobsCreated: number;
  startTime: Date;
  estimatedCompletion: Date;
}

/**
 * Service for synchronizing MCP servers from the official registry
 *
 * This service:
 * 1. Fetches server list from registry.modelcontextprotocol.io
 * 2. Creates a job batch for tracking progress
 * 3. Creates individual jobs for each server with rate-limited scheduling
 * 4. Lets the job queue system handle sequential processing
 */
export class RegistrySyncService {
  private readonly API_BASE = 'https://registry.modelcontextprotocol.io';
  private readonly API_VERSION = 'v0';
  private readonly mcpServers: ReturnType<typeof getSchema>['mcpServers'];

  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger,
    private jobQueueService: JobQueueService
  ) {
    const schema = getSchema();
    this.mcpServers = schema.mcpServers;
  }
  
  /**
   * Sync all servers from official MCP registry using job queue
   */
  async syncAllServersViaJobQueue(
    config: Partial<SyncConfig> = {},
    syncedBy: string
  ): Promise<SyncStats> {
    const finalConfig: SyncConfig = {
      maxServers: null,
      skipExisting: true,
      forceRefresh: false,
      rateLimitDelay: 2, // 2 seconds between jobs
      ...config,
    };
    
    this.logger.info({
      operation: 'mcp_registry_sync_via_jobs_start',
      config: finalConfig,
      syncedBy,
    }, 'Starting MCP Registry sync via job queue');
    
    try {
      // Fetch servers from official registry with smart pagination
      // If skipExisting + maxServers, fetch page-by-page and filter until we have enough
      const serversToSync = await this.fetchNewServersFromRegistry(
        finalConfig.maxServers,
        finalConfig.skipExisting
      );
      
      this.logger.info({
        totalNewServers: serversToSync.length,
        maxServers: finalConfig.maxServers,
      }, 'Collected new servers from official registry');
      
      // Create job batch for tracking
      const batch = await this.jobQueueService.createBatch(
        'mcp_registry_sync',
        serversToSync.length,
        {
          syncedBy,
          config: finalConfig,
          startedAt: new Date().toISOString(),
        }
      );
      
      // Create individual jobs for each server
      let jobsCreated = 0;
      for (let i = 0; i < serversToSync.length; i++) {
        const server = serversToSync[i];
        const scheduledFor = new Date(Date.now() + (i * finalConfig.rateLimitDelay * 1000));
        
        await this.jobQueueService.createJob(
          'sync_mcp_server',
          {
            officialServer: server,
            syncConfig: {
              skipExisting: finalConfig.skipExisting,
              forceRefresh: finalConfig.forceRefresh,
              syncedBy,
            },
            batchInfo: {
              batchId: batch.id,
              serverIndex: i + 1,
              totalServers: serversToSync.length,
            },
          },
          {
            batchId: batch.id,
            scheduledFor,
          }
        );
        
        jobsCreated++;
      }
      
      const estimatedCompletion = new Date(
        Date.now() + (serversToSync.length * finalConfig.rateLimitDelay * 1000)
      );
      
      this.logger.info({
        operation: 'mcp_registry_sync_jobs_created',
        batchId: batch.id,
        totalServers: serversToSync.length,
        jobsCreated,
        rateLimitDelay: finalConfig.rateLimitDelay,
        estimatedCompletion: estimatedCompletion.toISOString(),
      }, 'Created MCP server sync jobs');
      
      return {
        batchId: batch.id,
        totalServers: serversToSync.length,
        jobsCreated,
        startTime: new Date(),
        estimatedCompletion,
      };
      
    } catch (error) {
      this.logger.error({ error }, 'MCP Registry sync via job queue failed');
      throw error;
    }
  }
  
  /**
   * Filter out servers that already exist in the database
   * Queries the database for existing servers by official_name
   * and returns only servers that don't exist yet
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async filterExistingServers(servers: any[]): Promise<any[]> {
    if (servers.length === 0) return servers;
    
    // Extract official names from servers
    const officialNames = servers
      .map(s => s.name) // The 'name' field contains the official reverse-DNS name
      .filter(Boolean);
    
    if (officialNames.length === 0) {
      this.logger.warn('No official names found in servers, cannot filter existing servers');
      return servers;
    }
    
    this.logger.debug({
      totalServers: servers.length,
      officialNamesToCheck: officialNames.length,
    }, 'Checking for existing servers in database by official_name');
    
    try {
      // Query database for existing servers by official_name
      const existing = await this.db
        .select({ official_name: this.mcpServers.official_name })
        .from(this.mcpServers)
        .where(inArray(this.mcpServers.official_name, officialNames));
      
      // Build Set of existing names for fast lookup
      const existingNames = new Set(
        existing
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => s.official_name)
          .filter(Boolean)
      );
      
      this.logger.debug({
        existingCount: existingNames.size,
      }, 'Found existing servers in database');
      
      // Return only servers that don't exist
      return servers.filter(s => {
        const officialName = s.name;
        return officialName && !existingNames.has(officialName);
      });
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to query existing servers, continuing without filtering');
      return servers;
    }
  }
  
  /**
   * Fetch new servers from official registry with smart pagination
   * 
   * Strategy:
   * 1. Fetch page 1 (50 servers)
   * 2. Query DB for those 50 names only
   * 3. Filter → get X new servers
   * 4. If X >= maxServers → stop and return first maxServers
   * 5. If X < maxServers → fetch page 2, repeat
   * 
   * This ensures we only fetch what we need and don't overload the database.
   */
   
  private async fetchNewServersFromRegistry(
    maxServers: number | null,
    skipExisting: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    // If not skipping existing, use the old method (fetch all then filter)
    if (!skipExisting) {
      return this.fetchAllServersFromRegistry(maxServers);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accumulatedNewServers: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageNumber = 0;
    
    this.logger.debug({
      maxServers,
      skipExisting,
      operation: 'smart_pagination_start'
    }, 'Starting smart page-by-page fetch with filtering');
    
    while (hasMore) {
      pageNumber++;
      
      // Check if we have enough new servers
      if (maxServers && accumulatedNewServers.length >= maxServers) {
        this.logger.debug({
          pageNumber,
          accumulatedCount: accumulatedNewServers.length,
          maxServers,
          operation: 'smart_pagination_complete'
        }, 'Collected enough new servers, stopping pagination');
        break;
      }
      
      // Fetch one page (50 servers)
      const batchResult = await this.fetchServersBatch(cursor, 50);
      
      if (!batchResult.success) {
        throw new Error(`Failed to fetch servers: ${batchResult.error}`);
      }
      
      const { servers, metadata } = batchResult.data;
      
      // Log the actual metadata structure to debug pagination issues
      this.logger.debug({
        pageNumber,
        metadataKeys: Object.keys(metadata || {}),
        metadataStructure: JSON.stringify(metadata, null, 2),
        operation: 'registry_api_metadata'
      }, 'Registry API metadata structure');
      
      // Extract server data and filter for isLatest === true (CRITICAL: keep this filter!)
      // Optional: Filter out servers from specific namespaces (for testing/debugging)
      // Uncomment the EXCLUDED_NAMESPACES array below to enable namespace filtering
      
      // const EXCLUDED_NAMESPACES = [
      //   'ai.smithery/',
      //   // Add more namespaces to exclude:
      //   // 'internal.example/',
      //   // 'test.namespace/',
      // ];
      
      const serverData = servers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => {
          const meta = item._meta?.['io.modelcontextprotocol.registry/official'];
          // const server = item.server || item;
          // const serverName = server?.name || '';
          
          // Filter conditions:
          // 1. Must be latest version
          const isLatest = meta?.isLatest === true;
          
          // 2. Check if server is from an excluded namespace (if filtering enabled)
          // Uncomment the lines below to enable namespace filtering
          // const isExcluded = EXCLUDED_NAMESPACES.some(
          //   prefix => serverName.startsWith(prefix)
          // );
          // return isLatest && !isExcluded;
          
          // Default: Only filter by isLatest
          return isLatest;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => {
          const server = item.server || item;
          return {
            ...server,
            _meta: item._meta
          };
        });
      
      this.logger.debug({
        pageNumber,
        rawBatchSize: servers.length,
        afterFiltering: serverData.length,
        currentCursor: cursor,
      }, 'Fetched and filtered page from official registry (isLatest=true)');
      
      // Filter this page against database (only check these 50 servers)
      const newServersInPage = await this.filterExistingServers(serverData);
      
      this.logger.debug({
        pageNumber,
        serversInPage: serverData.length,
        newInPage: newServersInPage.length,
        existingInPage: serverData.length - newServersInPage.length,
        accumulatedSoFar: accumulatedNewServers.length,
      }, 'Filtered page against database');
      
      // Add new servers from this page to accumulated list
      accumulatedNewServers.push(...newServersInPage);
      
      // Check for next page - try multiple possible field names
      // Official MCP Registry might use different naming conventions
      cursor = metadata.next_cursor || metadata.nextCursor || metadata.cursor || metadata.next;
      
      // Determine if there are more pages
      // Stop if: no cursor OR we fetched fewer servers than requested (end of data)
      const shouldContinue = !!cursor && servers.length > 0;
      hasMore = shouldContinue;
      
      this.logger.debug({
        pageNumber,
        nextCursor: cursor,
        serversInBatch: servers.length,
        hasMore,
        metadataCount: metadata.count,
        metadataTotal: metadata.total,
        accumulated: accumulatedNewServers.length,
        targetMax: maxServers,
        operation: 'pagination_check'
      }, 'Pagination status after page fetch');
      
      // If we have no cursor but metadata suggests more servers exist, log a warning
      if (!cursor && metadata.total && metadata.count < metadata.total) {
        this.logger.warn({
          pageNumber,
          metadataCount: metadata.count,
          metadataTotal: metadata.total,
          operation: 'pagination_cursor_missing'
        }, 'API indicates more servers exist but no cursor provided - possible API issue');
      }
      
      // Rate limiting for registry API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Return up to maxServers (or all if maxServers is null)
    const result = maxServers 
      ? accumulatedNewServers.slice(0, maxServers)
      : accumulatedNewServers;
    
    this.logger.info({
      totalPagesChecked: pageNumber,
      totalNewServersFound: accumulatedNewServers.length,
      returningCount: result.length,
      maxServers,
      operation: 'smart_pagination_result'
    }, 'Smart pagination completed');
    
    return result;
  }
  
  /**
   * Fetch all servers from the official registry (fallback method)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async fetchAllServersFromRegistry(maxServers: number | null): Promise<any[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allServers: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    
    while (hasMore) {
      // Check if we've reached the max servers limit
      if (maxServers && allServers.length >= maxServers) {
        this.logger.info({ maxServers }, 'Reached max servers limit');
        break;
      }
      
      // Fetch batch of servers from official registry
      const batchResult = await this.fetchServersBatch(cursor, 50);
      
      if (!batchResult.success) {
        throw new Error(`Failed to fetch servers: ${batchResult.error}`);
      }
      
      const { servers, metadata } = batchResult.data;
      
      // Extract the actual server data from the registry response
      // Registry API returns: { servers: [{ _meta: {...}, server: {...} }] }
      // We need to attach _meta to the server object so it's available for metadata extraction
      // FILTER: Only include servers where _meta.io.modelcontextprotocol.registry/official.isLatest === true
      // Optional: Filter out servers from specific namespaces (for testing/debugging)
      // Uncomment the EXCLUDED_NAMESPACES array below to enable namespace filtering
      
      // const EXCLUDED_NAMESPACES = [
      //   'ai.smithery/',
      //   // Add more namespaces to exclude:
      //   // 'internal.example/',
      //   // 'test.namespace/',
      // ];
      
      const serverData = servers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => {
          const meta = item._meta?.['io.modelcontextprotocol.registry/official'];
          // const server = item.server || item;
          // const serverName = server?.name || '';
          
          // Filter conditions:
          // 1. Must be latest version
          const isLatest = meta?.isLatest === true;
          
          // 2. Check if server is from an excluded namespace (if filtering enabled)
          // Uncomment the lines below to enable namespace filtering
          // const isExcluded = EXCLUDED_NAMESPACES.some(
          //   prefix => serverName.startsWith(prefix)
          // );
          // return isLatest && !isExcluded;
          
          // Default: Only filter by isLatest
          return isLatest;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => {
          const server = item.server || item;
          // Attach _meta to the server object for later extraction
          return {
            ...server,
            _meta: item._meta
          };
        });
      allServers.push(...serverData);
      
      this.logger.debug({
        batchSize: servers.length,
        totalFetched: allServers.length,
        cursor,
      }, 'Fetched server batch from official registry');
      
      // Check for next page
      cursor = metadata.next_cursor;
      hasMore = !!cursor;
      
      // Rate limiting for registry API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Limit to maxServers if specified
    if (maxServers && allServers.length > maxServers) {
      return allServers.slice(0, maxServers);
    }
    
    return allServers;
  }
  
  /**
   * Fetch a batch of servers from the official registry
   */
  private async fetchServersBatch(
    cursor?: string,
    limit: number = 50
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ success: true; data: any } | { success: false; error: string }> {
    try {
      const url = new URL(`${this.API_BASE}/${this.API_VERSION}/servers`);
      if (cursor) url.searchParams.set('cursor', cursor);
      if (limit) url.searchParams.set('limit', limit.toString());
      
      this.logger.debug({ url: url.toString() }, 'Fetching servers from official registry');
      
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DeployStack-Sync/1.0',
        },
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      const data = await response.json();
      
      // Basic validation of response structure
      if (!this.validateRegistryResponse(data)) {
        return {
          success: false,
          error: 'Invalid response format from registry API',
        };
      }
      
      return {
        success: true,
        data,
      };
      
    } catch (error) {
      this.logger.error({ error, cursor }, 'Failed to fetch servers batch');
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Validate registry API response format
   */
  private validateRegistryResponse(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = data as any;
    
    return (
      Array.isArray(obj.servers) &&
      obj.metadata &&
      typeof obj.metadata === 'object' &&
      typeof obj.metadata.count === 'number'
    );
  }
}
