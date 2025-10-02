import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../db';
import { JobQueueService } from './jobQueueService';

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
  
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger,
    private jobQueueService: JobQueueService
  ) {}
  
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
      // Fetch all servers from official registry
      const allServers = await this.fetchAllServersFromRegistry(finalConfig.maxServers);
      
      this.logger.info({
        totalServers: allServers.length,
        maxServers: finalConfig.maxServers,
      }, 'Fetched servers from official registry');
      
      // Create job batch for tracking
      const batch = await this.jobQueueService.createBatch(
        'mcp_registry_sync',
        allServers.length,
        {
          syncedBy,
          config: finalConfig,
          startedAt: new Date().toISOString(),
        }
      );
      
      // Create individual jobs for each server
      let jobsCreated = 0;
      for (let i = 0; i < allServers.length; i++) {
        const server = allServers[i];
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
              totalServers: allServers.length,
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
        Date.now() + (allServers.length * finalConfig.rateLimitDelay * 1000)
      );
      
      this.logger.info({
        operation: 'mcp_registry_sync_jobs_created',
        batchId: batch.id,
        totalServers: allServers.length,
        jobsCreated,
        rateLimitDelay: finalConfig.rateLimitDelay,
        estimatedCompletion: estimatedCompletion.toISOString(),
      }, 'Created MCP server sync jobs');
      
      return {
        batchId: batch.id,
        totalServers: allServers.length,
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
   * Fetch all servers from the official registry
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
      const serverData = servers
        .filter((item: any) => {
          const meta = item._meta?.['io.modelcontextprotocol.registry/official'];
          return meta?.isLatest === true;
        })
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
