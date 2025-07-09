import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';

// Path parameters schema
const deleteGlobalServerParamsSchema = z.object({
  id: z.string().min(1, 'Server ID is required')
});

// Response schema for successful deletion
const deleteGlobalServerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    deleted_at: z.string()
  })
});

// Error response schema
const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string(),
  details: z.any().optional()
});

export default async function deleteGlobalServer(server: FastifyInstance) {
  server.delete('/mcp/servers/global/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Delete global MCP server (Global Admin only)',
      description: 'Delete an existing global MCP server - requires global admin permissions. Only global servers can be deleted through this endpoint. This action is irreversible.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(deleteGlobalServerParamsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(deleteGlobalServerResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Global admin permissions required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Server not found or not a global server'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    const { id: serverId } = request.params as z.infer<typeof deleteGlobalServerParamsSchema>;
    
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
        
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      if (existingServer.visibility !== 'global') {
        request.log.warn({
          operation: 'delete_global_mcp_server',
          userId: request.user?.id,
          serverId,
          serverVisibility: existingServer.visibility
        }, 'Attempted to delete non-global server through global endpoint');
        
        return reply.status(404).send({
          success: false,
          error: 'Server not found or not a global server'
        });
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
        
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      request.log.info({
        operation: 'delete_global_mcp_server',
        userId: request.user?.id,
        serverId,
        serverName: serverInfo.name
      }, 'Global MCP server deleted successfully');

      return reply.status(200).send({
        success: true,
        message: 'Global MCP server deleted successfully',
        data: {
          id: serverInfo.id,
          name: serverInfo.name,
          deleted_at: new Date().toISOString()
        }
      });
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
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      if (error.message?.includes('Insufficient permissions')) {
        return reply.status(403).send({
          success: false,
          error: 'Global admin permissions required'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to delete global MCP server'
      });
    }
  });
}
