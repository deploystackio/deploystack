import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { transformOfficialToDeployStack, isValidOfficialServer, type OfficialServer } from '../services/transforms/officialRegistryTransforms';
import { McpCatalogService } from '../services/mcpCatalogService';

/**
 * Job payload interface for MCP server sync jobs
 */
interface McpServerSyncPayload {
  officialServer: OfficialServer;
  syncConfig: {
    skipExisting: boolean;
    forceRefresh: boolean;
    syncedBy: string;
  };
  batchInfo: {
    batchId: string;
    serverIndex: number;
    totalServers: number;
  };
}

/**
 * Worker that processes individual MCP server sync jobs
 * 
 * This worker:
 * 1. Validates the job payload
 * 2. Checks if server already exists (if skipExisting is enabled)
 * 3. Transforms official server data to DeployStack format
 * 4. Saves the server to the database
 * 5. Handles retriable errors by throwing them (job queue will retry)
 */
export class McpServerSyncWorker implements Worker {
  private mcpService: McpCatalogService;
  
  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {
    this.mcpService = new McpCatalogService(this.db, this.logger);
  }

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    if (!this.isValidPayload(payload)) {
      return {
        success: false,
        message: 'Invalid MCP server sync payload format'
      };
    }

    const syncPayload = payload as McpServerSyncPayload;
    const { officialServer, syncConfig, batchInfo } = syncPayload;
    
    const serverName = officialServer.name;
    
    try {
      this.logger.info({
        jobId,
        serverName,
        batchId: batchInfo.batchId,
        progress: `${batchInfo.serverIndex}/${batchInfo.totalServers}`,
        operation: 'mcp_server_sync_start'
      }, 'Starting MCP server sync job');

      // Validate official server structure
      if (!isValidOfficialServer(officialServer)) {
        return {
          success: false,
          message: 'Invalid official server structure',
          data: { action: 'failed', error: 'Invalid server structure' }
        };
      }

      // Check if server already exists (if skipExisting is enabled)
      if (syncConfig.skipExisting && !syncConfig.forceRefresh) {
        const existingServer = await this.checkServerExists(officialServer.name);
        if (existingServer) {
          this.logger.debug({
            jobId,
            serverName,
            existingId: existingServer.id,
          }, 'Server already exists, skipping');
          
          return {
            success: true,
            message: 'Server already exists, skipped',
            data: { action: 'skipped', existingServerId: existingServer.id }
          };
        }
      }

      // Transform official format to DeployStack format
      const transformedData = await transformOfficialToDeployStack(
        officialServer,
        syncConfig.syncedBy
      );

      this.logger.debug({
        jobId,
        serverName,
        friendlyName: transformedData.name,
        transportType: transformedData.transport_type,
      }, 'Transformed server to DeployStack format');

      // Validate that required fields are present
      if (!transformedData.name || !transformedData.description || !transformedData.language || !transformedData.runtime) {
        throw new Error('Transformation failed: missing required fields');
      }

      // Add required fields for createServer
      const serverData = {
        ...transformedData,
        name: transformedData.name,
        description: transformedData.description,
        language: transformedData.language,
        runtime: transformedData.runtime,
        packages: transformedData.packages || [],
        visibility: 'global' as const, // Synced servers are always global
      };

      // Save to database using McpCatalogService
      const savedServer = await this.mcpService.createServer(
        syncConfig.syncedBy,
        'global_admin', // Sync jobs run with admin privileges
        null, // Global servers have no team
        serverData
      );

      this.logger.info({
        jobId,
        serverName,
        savedServerId: savedServer.id,
        friendlyName: transformedData.name,
        slug: savedServer.slug,
        operation: 'mcp_server_sync_complete'
      }, 'Successfully synced MCP server');

      return {
        success: true,
        message: `Successfully synced server: ${transformedData.name}`,
        data: {
          action: 'created',
          serverId: savedServer.id,
          friendlyName: transformedData.name,
          slug: savedServer.slug
        }
      };
      
    } catch (error) {
      this.logger.error({
        jobId,
        serverName,
        error,
        batchId: batchInfo.batchId,
        operation: 'mcp_server_sync_error'
      }, 'Failed to sync MCP server');
      
      // Determine if this is a retriable error
      if (this.isRetriableError(error)) {
        // Throw error to trigger job queue retry logic
        throw error;
      } else {
        // Return failure for non-retriable errors
        return {
          success: false,
          message: `Failed to sync server: ${error instanceof Error ? error.message : String(error)}`,
          data: { action: 'failed', error: String(error) }
        };
      }
    }
  }

  /**
   * Validate job payload structure
   */
  private isValidPayload(payload: unknown): payload is McpServerSyncPayload {
    if (!payload || typeof payload !== 'object') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any;
    
    return (
      p.officialServer &&
      typeof p.officialServer === 'object' &&
      typeof p.officialServer.name === 'string' &&
      p.syncConfig &&
      typeof p.syncConfig === 'object' &&
      typeof p.syncConfig.syncedBy === 'string' &&
      p.batchInfo &&
      typeof p.batchInfo === 'object' &&
      typeof p.batchInfo.batchId === 'string'
    );
  }

  /**
   * Check if a server already exists in DeployStack
   */
  private async checkServerExists(
    officialName: string
  ): Promise<{ id: string; name: string } | null> {
    try {
      // Search for server by official name in the database
      // We'll use the search functionality to find by name
      const servers = await this.mcpService.getServersForUser(
        'system-sync',
        'global_admin',
        [],
        { search: officialName }
      );
      
      // Look for exact match on official_name field
      // For now, we'll do a simple name match
      // In the future, we could add an official_name field to search by
      const exactMatch = servers.find(s => 
        s.name.toLowerCase() === officialName.toLowerCase()
      );
      
      if (exactMatch) {
        return {
          id: exactMatch.id,
          name: exactMatch.name,
        };
      }
      
      return null;
      
    } catch (error) {
      this.logger.error({ error, officialName }, 'Error checking if server exists');
      // Return null to continue processing rather than failing
      return null;
    }
  }

  /**
   * Determine if an error is retriable
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isRetriableError(error: any): boolean {
    const errorMessage = error?.message || String(error);
    
    // Network timeouts
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return true;
    }
    
    // Temporary server errors
    if (errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
      return true;
    }
    
    // Connection errors
    if (errorMessage.includes('ECONNRESET') || errorMessage.includes('ENOTFOUND')) {
      return true;
    }
    
    // Database lock errors (SQLite)
    if (errorMessage.includes('database is locked') || errorMessage.includes('SQLITE_BUSY')) {
      return true;
    }
    
    return false;
  }
}
