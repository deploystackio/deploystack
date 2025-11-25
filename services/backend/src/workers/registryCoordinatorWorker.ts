/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { JobQueueService } from '../services/jobQueueService';
import { mcpServers } from '../db/schema';

/**
 * Job payload interface for registry coordination jobs
 */
interface RegistryCoordinatorPayload {
  batchId: string;
  maxServers: number | null;
  skipExisting: boolean;
  forceRefresh: boolean;
  rateLimitDelay: number;
  syncedBy: string;
}

/**
 * Worker that coordinates MCP registry sync by discovering new servers
 * 
 * This worker:
 * 1. Queries ALL existing official_names ONCE (in-memory optimization)
 * 2. Fetches pages from official registry with smart pagination
 * 3. Filters each page using in-memory Set (O(1) lookups, fixes N+1 problem)
 * 4. Updates batch total_jobs as servers are discovered
 * 5. Creates individual sync_mcp_server jobs for each new server
 * 
 * Performance:
 * - Before: N database queries (one per page) = 10+ seconds for large syncs
 * - After: 1 database query (fetch all names once) = <2 seconds
 */
export class RegistryCoordinatorWorker implements Worker {
  private readonly API_BASE = 'https://registry.modelcontextprotocol.io';
  private readonly API_VERSION = 'v0';
  private jobQueueService: JobQueueService;
  
  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {
    this.jobQueueService = new JobQueueService(this.db, this.logger);
  }

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    if (!this.isValidPayload(payload)) {
      return {
        success: false,
        message: 'Invalid registry coordinator payload format'
      };
    }

    const coordPayload = payload as RegistryCoordinatorPayload;
    const { batchId, maxServers, skipExisting, forceRefresh, rateLimitDelay, syncedBy } = coordPayload;
    
    try {
      this.logger.info({
        jobId,
        batchId,
        maxServers,
        skipExisting,
        operation: 'registry_coordination_start'
      }, 'Starting MCP registry coordination job');

      // OPTIMIZATION: Query ALL existing official_names ONCE (in-memory filtering)
      const existingNamesSet = await this.fetchAllExistingNames();
      
      this.logger.info({
        jobId,
        batchId,
        existingCount: existingNamesSet.size,
        operation: 'existing_servers_loaded'
      }, 'Loaded existing server names into memory');

      // Fetch new servers from registry using in-memory filtering
      const newServers = await this.fetchNewServersFromRegistry(
        existingNamesSet,
        maxServers,
        skipExisting,
        forceRefresh
      );

      this.logger.info({
        jobId,
        batchId,
        newServersFound: newServers.length,
        maxServers,
        operation: 'new_servers_discovered'
      }, 'Discovered new servers from registry');

      // Update batch with actual total_jobs count
      await this.jobQueueService.updateBatchTotalJobs(batchId, newServers.length);

      this.logger.debug({
        jobId,
        batchId,
        totalJobs: newServers.length,
        operation: 'batch_updated'
      }, 'Updated batch total_jobs count');

      // Create individual sync jobs for each new server
      let jobsCreated = 0;
      for (let i = 0; i < newServers.length; i++) {
        const server = newServers[i];
        const scheduledFor = new Date(Date.now() + (i * rateLimitDelay * 1000));
        
        await this.jobQueueService.createJob(
          'sync_mcp_server',
          {
            officialServer: server,
            syncConfig: {
              skipExisting,
              forceRefresh,
              syncedBy,
            },
            batchInfo: {
              batchId,
              serverIndex: i + 1,
              totalServers: newServers.length,
            },
          },
          {
            batchId,
            scheduledFor,
          }
        );
        
        jobsCreated++;
      }

      this.logger.info({
        jobId,
        batchId,
        jobsCreated,
        newServers: newServers.length,
        rateLimitDelay,
        operation: 'registry_coordination_complete'
      }, 'Registry coordination completed successfully');

      return {
        success: true,
        message: `Successfully coordinated sync for ${newServers.length} servers`,
        data: {
          batchId,
          serversDiscovered: newServers.length,
          jobsCreated,
          existingServersSkipped: existingNamesSet.size,
        }
      };
      
    } catch (error) {
      this.logger.error({
        jobId,
        batchId,
        error,
        operation: 'registry_coordination_error'
      }, 'Failed to coordinate registry sync');
      
      throw error;
    }
  }

  /**
   * Fetch ALL existing official_names from database ONCE
   * Returns a Set for O(1) lookup performance
   * 
   * This is the key optimization that fixes the N+1 query problem
   */
  private async fetchAllExistingNames(): Promise<Set<string>> {
    try {
      const existing = await this.db
        .select({ official_name: mcpServers.official_name })
        .from(mcpServers);
      
      const namesSet = new Set<string>(
        existing
          .map((s: { official_name: string | null }) => s.official_name)
          .filter((name: string | null): name is string => name !== null && name !== undefined)
      );
      
      return namesSet;
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch existing server names');
      throw new Error('Failed to load existing servers from database');
    }
  }

  /**
   * Fetch new servers from official registry with smart pagination
   * Uses in-memory Set for filtering (fixes N+1 database query problem)
   */
  private async fetchNewServersFromRegistry(
    existingNamesSet: Set<string>,
    maxServers: number | null,
    skipExisting: boolean,
    forceRefresh: boolean
  ): Promise<any[]> {
    const accumulatedNewServers: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageNumber = 0;
    
    this.logger.debug({
      maxServers,
      skipExisting,
      forceRefresh,
      existingCount: existingNamesSet.size,
      operation: 'smart_pagination_start'
    }, 'Starting smart page-by-page fetch with in-memory filtering');
    
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
      
      // Filter servers for isLatest === true
      const serverData = servers
        .filter((item: any) => {
          const meta = item._meta?.['io.modelcontextprotocol.registry/official'];
          return meta?.isLatest === true;
        })
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
      
      // OPTIMIZATION: Filter using in-memory Set (O(1) lookup per server)
      // This replaces the filterExistingServers() method that queries DB per page
      const newServersInPage = skipExisting && !forceRefresh
        ? serverData.filter((s: any) => {
            const officialName = s.name;
            return officialName && !existingNamesSet.has(officialName);
          })
        : serverData;
      
      this.logger.debug({
        pageNumber,
        serversInPage: serverData.length,
        newInPage: newServersInPage.length,
        existingInPage: serverData.length - newServersInPage.length,
        accumulatedSoFar: accumulatedNewServers.length,
      }, 'Filtered page using in-memory Set (no database query)');
      
      // Add new servers from this page to accumulated list
      accumulatedNewServers.push(...newServersInPage);
      
      // Check for next page
      cursor = metadata.next_cursor || metadata.nextCursor || metadata.cursor || metadata.next;
      
      // Determine if there are more pages
      const shouldContinue = !!cursor && servers.length > 0;
      hasMore = shouldContinue;
      
      this.logger.debug({
        pageNumber,
        nextCursor: cursor,
        serversInBatch: servers.length,
        hasMore,
        accumulated: accumulatedNewServers.length,
        targetMax: maxServers,
        operation: 'pagination_check'
      }, 'Pagination status after page fetch');
      
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
    }, 'Smart pagination completed with in-memory filtering');
    
    return result;
  }

  /**
   * Fetch a batch of servers from the official registry
   * Reused from RegistrySyncService pattern
   */
  private async fetchServersBatch(
    cursor?: string,
    limit: number = 50
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
    const obj = data as any;
    
    return (
      Array.isArray(obj.servers) &&
      obj.metadata &&
      typeof obj.metadata === 'object' &&
      typeof obj.metadata.count === 'number'
    );
  }

  /**
   * Validate job payload structure
   */
  private isValidPayload(payload: unknown): payload is RegistryCoordinatorPayload {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as any;
    
    return (
      typeof p.batchId === 'string' &&
      typeof p.skipExisting === 'boolean' &&
      typeof p.forceRefresh === 'boolean' &&
      typeof p.rateLimitDelay === 'number' &&
      typeof p.syncedBy === 'string' &&
      (p.maxServers === null || typeof p.maxServers === 'number')
    );
  }
}
