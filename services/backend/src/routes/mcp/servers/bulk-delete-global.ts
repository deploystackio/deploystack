import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import {
  BULK_DELETE_GLOBAL_SERVERS_REQUEST_SCHEMA,
  BULK_DELETE_GLOBAL_SERVERS_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  type BulkDeleteGlobalServersRequest,
  type BulkDeleteGlobalServersSuccessResponse,
  type BulkDeleteJobItem,
  type BulkDeleteSkippedItem,
  type ErrorResponse
} from './schemas';

export default async function bulkDeleteGlobalServers(server: FastifyInstance) {
  server.post('/mcp/servers/global/bulk-delete', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Bulk delete global MCP servers (Global Admin only)',
      description: 'Queues deletion of multiple global MCP servers. Each server and all its team installations will be removed via background jobs. Teams with installations will be notified and satellites will be updated. Requires global admin permissions. Requires Content-Type: application/json header.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      body: BULK_DELETE_GLOBAL_SERVERS_REQUEST_SCHEMA,

      // OpenAPI documentation
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: BULK_DELETE_GLOBAL_SERVERS_REQUEST_SCHEMA
          }
        }
      },

      response: {
        202: {
          ...BULK_DELETE_GLOBAL_SERVERS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Server deletions have been queued'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    const { server_ids } = request.body as BulkDeleteGlobalServersRequest;

    request.log.info({
      operation: 'bulk_delete_global_mcp_servers',
      userId: request.user?.id,
      serverCount: server_ids.length
    }, 'Starting bulk deletion of global MCP servers');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);
      const jobQueueService = new JobQueueService(db, request.log);

      const jobs: BulkDeleteJobItem[] = [];
      const skipped: BulkDeleteSkippedItem[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userEmail = (request.user as any).email || 'unknown';

      // Process each server ID
      for (const serverId of server_ids) {
        try {
          // Check if server exists and is global
          const existingServer = await mcpService.getServerById(serverId);

          if (!existingServer) {
            skipped.push({
              server_id: serverId,
              reason: 'Server not found'
            });
            continue;
          }

          if (existingServer.visibility !== 'global') {
            skipped.push({
              server_id: serverId,
              reason: 'Not a global server'
            });
            continue;
          }

          // Create a background job for cascade deletion
          const job = await jobQueueService.createJob('mcp_server_cascade_delete', {
            serverId: existingServer.id,
            serverName: existingServer.name,
            serverDescription: existingServer.description,
            deletedBy: {
              id: request.user!.id,
              email: userEmail
            },
            metadata: {
              ip: request.ip
            }
          });

          jobs.push({
            server_id: existingServer.id,
            server_name: existingServer.name,
            job_id: job.id
          });

          request.log.debug({
            operation: 'bulk_delete_global_mcp_servers',
            serverId: existingServer.id,
            serverName: existingServer.name,
            jobId: job.id
          }, 'Queued deletion job for server');

        } catch (serverError) {
          request.log.warn({
            operation: 'bulk_delete_global_mcp_servers',
            serverId,
            error: serverError instanceof Error ? serverError.message : String(serverError)
          }, 'Failed to process server for bulk deletion');

          skipped.push({
            server_id: serverId,
            reason: 'Processing error'
          });
        }
      }

      request.log.info({
        operation: 'bulk_delete_global_mcp_servers',
        userId: request.user?.id,
        totalRequested: server_ids.length,
        totalQueued: jobs.length,
        totalSkipped: skipped.length
      }, 'Bulk deletion jobs queued');

      const response: BulkDeleteGlobalServersSuccessResponse = {
        success: true,
        message: `Queued ${jobs.length} server(s) for deletion. ${skipped.length} server(s) skipped.`,
        data: {
          total_requested: server_ids.length,
          total_queued: jobs.length,
          total_skipped: skipped.length,
          jobs,
          skipped
        }
      };
      const jsonString = JSON.stringify(response);
      return reply.status(202).type('application/json').send(jsonString);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'bulk_delete_global_mcp_servers',
        userId: request.user?.id,
        error
      }, 'Failed to process bulk deletion request');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to process bulk deletion request'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
