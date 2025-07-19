import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Response schemas
const successResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.object({
    id: z.string(),
    deleted: z.boolean().default(true)
  })
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function deleteInstallationRoute(fastify: FastifyInstance) {
  fastify.delete<{
    Params: { teamId: string; installationId: string };
  }>('/teams/:teamId/mcp/installations/:installationId', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Delete MCP installation',
      description: 'Removes an MCP server installation from the specified team. No Content-Type header required for this DELETE request.',
      security: [{ cookieAuth: [] }],
      params: createSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required'),
        installationId: z.string().min(1, 'Installation ID is required')
      }), {
        }),
      response: {
        200: createSchema(successResponseSchema.describe('Installation deleted successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Installation not found'))
      }
    },
    preValidation: requireTeamPermission('mcp.installations.delete')
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
    const userId = request.user!.id;

    request.log.info({
      operation: 'delete_mcp_installation',
      teamId,
      installationId,
      userId
    }, 'Deleting MCP installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const deleted = await installationService.deleteInstallation(installationId, teamId);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Installation not found'
        });
      }

      request.log.info({
        operation: 'delete_mcp_installation',
        teamId,
        installationId,
        userId
      }, 'MCP installation deleted successfully');

      return reply.status(200).send({
        success: true,
        data: {
          id: installationId,
          deleted: true
        }
      });

    } catch (error) {
      request.log.error({
        operation: 'delete_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to delete MCP installation');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return reply.status(500).send({
        success: false,
        error: errorMessage
      });
    }
  });
}
