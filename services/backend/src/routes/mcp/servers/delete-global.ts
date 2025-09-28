import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';
import {
  SERVER_ID_PARAM_SCHEMA,
  DELETE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  type ServerIdParams,
  type DeleteGlobalServerSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function deleteGlobalServer(server: FastifyInstance) {
  server.delete('/mcp/servers/global/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Delete global MCP server (Global Admin only)',
      description: 'Delete an existing global MCP server - requires global admin permissions. Only global servers can be deleted through this endpoint. This action is irreversible.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: SERVER_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...DELETE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA,
          description: 'Global MCP server deleted successfully'
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
    }, 'Deleting global MCP server');

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

      // Store server info before deletion for response
      const serverInfo = {
        id: existingServer.id,
        name: existingServer.name
      };

      const deleted = await mcpService.deleteServer(
        serverId,
        request.user!.id,
        'global_admin' // We know user is global admin due to middleware
      );

      if (!deleted) {
        request.log.warn({
          operation: 'delete_global_mcp_server',
          userId: request.user?.id,
          serverId
        }, 'Failed to delete server - server not found or insufficient permissions');
        
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'delete_global_mcp_server',
        userId: request.user?.id,
        serverId,
        serverName: serverInfo.name
      }, 'Global MCP server deleted successfully');

      // Emit MCP_SERVER_DELETED event
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
          EVENT_NAMES.MCP_SERVER_DELETED,
          {
            server: {
              id: serverInfo.id,
              name: serverInfo.name,
              description: existingServer.description
            },
            deletedBy: {
              id: request.user!.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_SERVER_DELETED event emitted for server: ${serverInfo.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_SERVER_DELETED event for server ${serverInfo.id}:`);
        // Don't fail deletion if event emission fails
      }

      const response: DeleteGlobalServerSuccessResponse = {
        success: true,
        message: 'Global MCP server deleted successfully',
        data: {
          id: serverInfo.id,
          name: serverInfo.name,
          deleted_at: new Date().toISOString()
        }
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'delete_global_mcp_server',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to delete global MCP server');

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
        error: 'Failed to delete global MCP server'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
