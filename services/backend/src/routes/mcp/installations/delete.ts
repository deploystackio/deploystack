import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
      params: zodToJsonSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required'),
        installationId: z.string().min(1, 'Installation ID is required')
      }), {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successResponseSchema.describe('Installation deleted successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Installation not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
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
