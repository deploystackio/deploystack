import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';
import {
  SERVER_ID_PARAM_SCHEMA,
  UPDATE_GLOBAL_SERVER_STATUS_REQUEST_SCHEMA,
  UPDATE_GLOBAL_SERVER_STATUS_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  type ServerIdParams,
  type ErrorResponse,
  type McpServerStatus,
  type UpdateGlobalServerStatusRequest,
  type UpdateGlobalServerStatusSuccessResponse
} from './schemas';

export default async function updateGlobalServerStatus(server: FastifyInstance) {
  server.patch('/mcp/servers/global/:id/status', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Update global MCP server status (Global Admin only)',
      description: 'Update the status of a global MCP server. Setting status to "disabled" will prevent new installations. Requires global admin permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],

      params: SERVER_ID_PARAM_SCHEMA,
      body: UPDATE_GLOBAL_SERVER_STATUS_REQUEST_SCHEMA,

      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_GLOBAL_SERVER_STATUS_REQUEST_SCHEMA
          }
        }
      },

      response: {
        200: {
          ...UPDATE_GLOBAL_SERVER_STATUS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Server status updated successfully'
        },
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        500: COMMON_ERROR_RESPONSES[500]
      }
    }
  }, async (request, reply) => {
    const { id: serverId } = request.params as ServerIdParams;
    const { status: newStatus } = request.body as UpdateGlobalServerStatusRequest;

    request.log.info({
      operation: 'update_global_mcp_server_status',
      userId: request.user?.id,
      serverId,
      newStatus
    }, 'Updating global MCP server status');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);

      // Check if server exists and is global
      const existingServer = await mcpService.getServerById(serverId);

      if (!existingServer) {
        request.log.warn({
          operation: 'update_global_mcp_server_status',
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
          operation: 'update_global_mcp_server_status',
          userId: request.user?.id,
          serverId,
          serverVisibility: existingServer.visibility
        }, 'Attempted to update status of non-global server');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found or not a global server'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const previousStatus = existingServer.status as McpServerStatus;

      // Skip update if status is unchanged
      if (previousStatus === newStatus) {
        request.log.info({
          operation: 'update_global_mcp_server_status',
          serverId,
          status: newStatus
        }, 'Status unchanged, skipping update');

        const response: UpdateGlobalServerStatusSuccessResponse = {
          success: true,
          data: {
            id: existingServer.id,
            name: existingServer.name,
            slug: existingServer.slug,
            status: newStatus,
            previous_status: previousStatus,
            updated_at: existingServer.updated_at instanceof Date
              ? existingServer.updated_at.toISOString()
              : existingServer.updated_at
          }
        };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);
      }

      // Update status via service
      const updatedServer = await mcpService.updateServer(
        serverId,
        request.user!.id,
        'global_admin',
        { status: newStatus }
      );

      if (!updatedServer) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to update server status'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_global_mcp_server_status',
        userId: request.user?.id,
        serverId,
        serverName: updatedServer.name,
        previousStatus,
        newStatus
      }, 'Global MCP server status updated successfully');

      // Emit MCP_SERVER_UPDATED event
      try {
        const eventContext: EventContext = {
          db,
          logger: request.log,
          user: {
            id: request.user!.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'global_admin'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_SERVER_UPDATED,
          {
            server: {
              id: updatedServer.id,
              name: updatedServer.name,
              description: updatedServer.description,
              language: updatedServer.language,
              runtime: updatedServer.runtime
            },
            updatedBy: {
              id: request.user!.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            changes: {
              status: {
                from: previousStatus,
                to: newStatus
              }
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_SERVER_UPDATED event emitted for status change: ${updatedServer.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_SERVER_UPDATED event for server ${updatedServer.id}`);
      }

      const response: UpdateGlobalServerStatusSuccessResponse = {
        success: true,
        data: {
          id: updatedServer.id,
          name: updatedServer.name,
          slug: updatedServer.slug,
          status: updatedServer.status as McpServerStatus,
          previous_status: previousStatus,
          updated_at: updatedServer.updated_at instanceof Date
            ? updatedServer.updated_at.toISOString()
            : updatedServer.updated_at
        }
      };

      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'update_global_mcp_server_status',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to update global MCP server status');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update global MCP server status'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
