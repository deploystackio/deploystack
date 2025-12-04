import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import {
  SERVER_ID_PARAM_SCHEMA,
  COMMON_ERROR_RESPONSES,
  type ServerIdParams,
  type ErrorResponse
} from './schemas';

/**
 * Response interface for queued server deletion
 */
interface DeleteGlobalServerQueuedResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    job_id: string;
    status: 'queued';
  };
}

export default async function deleteGlobalServer(server: FastifyInstance) {
  server.delete('/mcp/servers/global/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Delete global MCP server (Global Admin only)',
      description: 'Queues deletion of a global MCP server. The server and all team installations will be removed via a background job. Each team with an installation will be notified and satellites will be updated. Requires global admin permissions.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      params: SERVER_ID_PARAM_SCHEMA,

      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Indicates request was accepted' },
            message: { type: 'string', description: 'Status message' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID of the server being deleted' },
                name: { type: 'string', description: 'Name of the server being deleted' },
                job_id: { type: 'string', description: 'Background job ID for tracking' },
                status: { type: 'string', enum: ['queued'], description: 'Deletion status' }
              },
              required: ['id', 'name', 'job_id', 'status']
            }
          },
          required: ['success', 'message', 'data'],
          description: 'Server deletion has been queued'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    const { id: serverId } = request.params as ServerIdParams;

    request.log.info({
      operation: 'delete_global_mcp_server',
      userId: request.user?.id,
      serverId
    }, 'Queueing global MCP server deletion');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);

      // First check if server exists and is global
      const existingServer = await mcpService.getServerById(serverId);
      if (!existingServer) {
        request.log.warn({
          operation: 'delete_global_mcp_server',
          userId: request.user?.id,
          serverId
        }, 'Server not found');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (existingServer.visibility !== 'global') {
        request.log.warn({
          operation: 'delete_global_mcp_server',
          userId: request.user?.id,
          serverId,
          serverVisibility: existingServer.visibility
        }, 'Attempted to delete non-global server through global endpoint');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found or not a global server'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create job queue service
      const jobQueueService = new JobQueueService(db, request.log);

      // Create a background job for cascade deletion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userEmail = (request.user as any).email || 'unknown';

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

      request.log.info({
        operation: 'delete_global_mcp_server',
        userId: request.user?.id,
        serverId,
        serverName: existingServer.name,
        jobId: job.id
      }, 'Global MCP server deletion job queued');

      const response: DeleteGlobalServerQueuedResponse = {
        success: true,
        message: 'Server deletion has been queued. All team installations will be notified.',
        data: {
          id: existingServer.id,
          name: existingServer.name,
          job_id: job.id,
          status: 'queued'
        }
      };
      const jsonString = JSON.stringify(response);
      return reply.status(202).type('application/json').send(jsonString);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'delete_global_mcp_server',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to queue global MCP server deletion');

      // Handle specific error cases
      if (error.message?.includes('Server not found')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (error.message?.includes('Insufficient permissions')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Global admin permissions required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to queue global MCP server deletion'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
