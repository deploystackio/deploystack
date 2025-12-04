import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import type { DeployStackEventBus } from '../events/eventBus';
import type { EventContext } from '../events/types';
import { EVENT_NAMES } from '../events';
import { McpInstallationService } from '../services/mcpInstallationService';
import { McpCatalogService } from '../services/mcpCatalogService';
import { SatelliteCommandService } from '../services/satelliteCommandService';

/**
 * Payload interface for MCP server cascade deletion jobs
 */
interface McpServerCascadeDeletionPayload {
  serverId: string;
  serverName: string;
  serverDescription: string;
  deletedBy: {
    id: string;
    email: string;
  };
  metadata: {
    ip: string;
  };
}

/**
 * Worker that handles cascade deletion of MCP servers
 *
 * When a global admin deletes an MCP server from the catalog, this worker:
 * 1. Finds all team installations of the server
 * 2. For each installation:
 *    - Emits MCP_INSTALLATION_DELETED event
 *    - Notifies satellites to refresh configuration
 *    - Deletes the installation record
 * 3. Deletes the server from the catalog
 * 4. Emits MCP_SERVER_DELETED event
 */
export class McpServerCascadeDeletionWorker implements Worker {
  private installationService: McpInstallationService;
  private catalogService: McpCatalogService;
  private satelliteCommandService: SatelliteCommandService;

  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger,
    private readonly eventBus: DeployStackEventBus
  ) {
    this.installationService = new McpInstallationService(this.db, this.logger);
    this.catalogService = new McpCatalogService(this.db, this.logger);
    this.satelliteCommandService = new SatelliteCommandService(this.db, this.logger);
  }

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    if (!this.isValidPayload(payload)) {
      return {
        success: false,
        message: 'Invalid MCP server cascade deletion payload format'
      };
    }

    const deletionPayload = payload as McpServerCascadeDeletionPayload;
    const { serverId, serverName, serverDescription, deletedBy, metadata } = deletionPayload;

    this.logger.info({
      jobId,
      serverId,
      serverName,
      operation: 'mcp_server_cascade_delete_start'
    }, 'Starting MCP server cascade deletion');

    try {
      // Check if server still exists (idempotency)
      const server = await this.catalogService.getServerById(serverId);
      if (!server) {
        this.logger.info({
          jobId,
          serverId,
          operation: 'mcp_server_cascade_delete_skip'
        }, 'Server already deleted, skipping');

        return {
          success: true,
          message: 'Server already deleted',
          data: { action: 'skipped', reason: 'server_not_found' }
        };
      }

      // Get all installations for this server
      const installations = await this.installationService.getInstallationsByServerId(serverId);

      this.logger.info({
        jobId,
        serverId,
        installationCount: installations.length,
        operation: 'mcp_server_cascade_delete_found_installations'
      }, `Found ${installations.length} installations to process`);

      let installationsDeleted = 0;
      let installationsFailed = 0;

      // Process each installation
      for (const installation of installations) {
        try {
          await this.processInstallationDeletion(
            installation,
            serverId,
            serverName,
            deletedBy,
            metadata,
            jobId
          );
          installationsDeleted++;
        } catch (error) {
          installationsFailed++;
          this.logger.error({
            jobId,
            installationId: installation.id,
            teamId: installation.team_id,
            error: error instanceof Error ? error.message : String(error),
            operation: 'mcp_server_cascade_delete_installation_error'
          }, 'Failed to process installation deletion');
          // Continue with other installations
        }
      }

      // Delete the server from catalog
      this.logger.info({
        jobId,
        serverId,
        operation: 'mcp_server_cascade_delete_server'
      }, 'Deleting server from catalog');

      const serverDeleted = await this.catalogService.deleteServer(
        serverId,
        deletedBy.id,
        'global_admin'
      );

      if (!serverDeleted) {
        this.logger.warn({
          jobId,
          serverId,
          operation: 'mcp_server_cascade_delete_server_failed'
        }, 'Server deletion returned false - may have been already deleted');
      }

      // Emit MCP_SERVER_DELETED event
      await this.emitServerDeletedEvent(
        serverId,
        serverName,
        serverDescription,
        deletedBy,
        metadata
      );

      this.logger.info({
        jobId,
        serverId,
        serverName,
        installationsDeleted,
        installationsFailed,
        operation: 'mcp_server_cascade_delete_complete'
      }, 'MCP server cascade deletion completed');

      return {
        success: true,
        message: `Server "${serverName}" deleted with ${installationsDeleted} installations processed`,
        data: {
          action: 'completed',
          serverId,
          serverName,
          installationsDeleted,
          installationsFailed,
          serverDeleted
        }
      };

    } catch (error) {
      this.logger.error({
        jobId,
        serverId,
        serverName,
        error: error instanceof Error ? error.message : String(error),
        operation: 'mcp_server_cascade_delete_error'
      }, 'Failed to complete MCP server cascade deletion');

      // Throw to trigger retry
      throw error;
    }
  }

  /**
   * Process deletion of a single installation
   */
  private async processInstallationDeletion(
    installation: {
      id: string;
      team_id: string;
      installation_name: string;
      server_id: string;
      created_by: string;
    },
    serverId: string,
    serverName: string,
    deletedBy: { id: string; email: string },
    metadata: { ip: string },
    jobId: string
  ): Promise<void> {
    const { id: installationId, team_id: teamId, installation_name: installationName } = installation;

    this.logger.debug({
      jobId,
      installationId,
      teamId,
      installationName,
      operation: 'mcp_server_cascade_delete_installation_start'
    }, 'Processing installation deletion');

    // Emit MCP_INSTALLATION_DELETED event
    await this.emitInstallationDeletedEvent(
      installationId,
      serverId,
      teamId,
      deletedBy,
      metadata
    );

    // Notify satellites to refresh configuration
    try {
      const commands = await this.satelliteCommandService.notifyMcpInstallation(
        installationId,
        teamId,
        deletedBy.id
      );

      this.logger.debug({
        jobId,
        installationId,
        commandsCreated: commands.length,
        operation: 'mcp_server_cascade_delete_satellite_notified'
      }, 'Satellites notified of installation deletion');
    } catch (satelliteError) {
      this.logger.warn({
        jobId,
        installationId,
        error: satelliteError instanceof Error ? satelliteError.message : String(satelliteError),
        operation: 'mcp_server_cascade_delete_satellite_error'
      }, 'Failed to notify satellites, continuing with deletion');
      // Don't fail the installation deletion if satellite notification fails
    }

    // Delete the installation
    const deleted = await this.installationService.deleteInstallation(installationId, teamId);

    if (!deleted) {
      this.logger.warn({
        jobId,
        installationId,
        teamId,
        operation: 'mcp_server_cascade_delete_installation_not_found'
      }, 'Installation not found during deletion - may have been already deleted');
    } else {
      this.logger.info({
        jobId,
        installationId,
        teamId,
        installationName,
        operation: 'mcp_server_cascade_delete_installation_complete'
      }, 'Installation deleted successfully');
    }
  }

  /**
   * Emit MCP_INSTALLATION_DELETED event
   */
  private async emitInstallationDeletedEvent(
    installationId: string,
    serverId: string,
    teamId: string,
    deletedBy: { id: string; email: string },
    metadata: { ip: string }
  ): Promise<void> {
    try {
      const eventContext: EventContext = {
        db: this.db,
        logger: this.logger,
        user: {
          id: deletedBy.id,
          email: deletedBy.email,
          roleId: 'global_admin'
        },
        request: {
          ip: metadata.ip,
          userAgent: 'DeployStack Background Worker',
          requestId: `cascade-delete-${installationId}`
        },
        timestamp: new Date()
      };

      this.eventBus.emitWithContext(
        EVENT_NAMES.MCP_INSTALLATION_DELETED,
        {
          installation: {
            id: installationId,
            serverId: serverId,
            teamId: teamId
          },
          deletedBy: {
            id: deletedBy.id,
            email: deletedBy.email
          },
          metadata: {
            ip: metadata.ip
          }
        },
        eventContext
      );

      this.logger.debug({
        installationId,
        teamId,
        operation: 'mcp_installation_deleted_event_emitted'
      }, 'MCP_INSTALLATION_DELETED event emitted');
    } catch (eventError) {
      this.logger.warn({
        installationId,
        error: eventError instanceof Error ? eventError.message : String(eventError),
        operation: 'mcp_installation_deleted_event_error'
      }, 'Failed to emit MCP_INSTALLATION_DELETED event');
      // Don't fail the deletion if event emission fails
    }
  }

  /**
   * Emit MCP_SERVER_DELETED event
   */
  private async emitServerDeletedEvent(
    serverId: string,
    serverName: string,
    serverDescription: string,
    deletedBy: { id: string; email: string },
    metadata: { ip: string }
  ): Promise<void> {
    try {
      const eventContext: EventContext = {
        db: this.db,
        logger: this.logger,
        user: {
          id: deletedBy.id,
          email: deletedBy.email,
          roleId: 'global_admin'
        },
        request: {
          ip: metadata.ip,
          userAgent: 'DeployStack Background Worker',
          requestId: `cascade-delete-server-${serverId}`
        },
        timestamp: new Date()
      };

      this.eventBus.emitWithContext(
        EVENT_NAMES.MCP_SERVER_DELETED,
        {
          server: {
            id: serverId,
            name: serverName,
            description: serverDescription
          },
          deletedBy: {
            id: deletedBy.id,
            email: deletedBy.email
          },
          metadata: {
            ip: metadata.ip
          }
        },
        eventContext
      );

      this.logger.info({
        serverId,
        serverName,
        operation: 'mcp_server_deleted_event_emitted'
      }, 'MCP_SERVER_DELETED event emitted');
    } catch (eventError) {
      this.logger.warn({
        serverId,
        error: eventError instanceof Error ? eventError.message : String(eventError),
        operation: 'mcp_server_deleted_event_error'
      }, 'Failed to emit MCP_SERVER_DELETED event');
      // Don't fail if event emission fails
    }
  }

  /**
   * Validate job payload structure
   */
  private isValidPayload(payload: unknown): payload is McpServerCascadeDeletionPayload {
    if (!payload || typeof payload !== 'object') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any;

    return (
      typeof p.serverId === 'string' &&
      typeof p.serverName === 'string' &&
      typeof p.serverDescription === 'string' &&
      p.deletedBy &&
      typeof p.deletedBy === 'object' &&
      typeof p.deletedBy.id === 'string' &&
      typeof p.deletedBy.email === 'string' &&
      p.metadata &&
      typeof p.metadata === 'object' &&
      typeof p.metadata.ip === 'string'
    );
  }
}
