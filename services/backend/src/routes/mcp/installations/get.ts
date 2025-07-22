import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Response schemas
const installationSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  server_id: z.string(),
  user_id: z.string(),
  installation_name: z.string(),
  installation_type: z.enum(['local', 'cloud']),
  user_environment_variables: z.record(z.string(), z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  last_used_at: z.string().nullable(),
  server: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    github_url: z.string().nullable(),
    homepage_url: z.string().nullable(),
    author_name: z.string().nullable(),
    language: z.string(),
    runtime: z.string(),
    status: z.enum(['active', 'deprecated', 'maintenance']),
    tags: z.array(z.string()).nullable(),
    environment_variables: z.array(z.any()).nullable(),
    category_id: z.string().nullable()
  }).optional()
});

const successResponseSchema = z.object({
  success: z.boolean().default(true),
  data: installationSchema
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function getInstallationRoute(fastify: FastifyInstance) {
  fastify.get<{
    Params: { teamId: string; installationId: string };
  }>('/teams/:teamId/mcp/installations/:installationId', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Get MCP installation by ID',
      description: 'Retrieves a specific MCP server installation by ID for the specified team.',
      security: [{ cookieAuth: [] }],
      params: createSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required'),
        installationId: z.string().min(1, 'Installation ID is required')
      }), {
        }),
      response: {
        200: createSchema(successResponseSchema.describe('Installation details')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Installation not found'))
      }
    },
    preValidation: requireTeamPermission('mcp.installations.view')
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
    const userId = request.user!.id;

    request.log.info({
      operation: 'get_mcp_installation',
      teamId,
      installationId,
      userId
    }, 'Getting MCP installation by ID');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const installation = await installationService.getInstallationById(installationId, teamId);

      if (!installation) {
        request.log.warn({
          operation: 'get_mcp_installation',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found');

        return reply.status(404).send({
          success: false,
          error: 'Installation not found'
        });
      }

      request.log.info({
        operation: 'get_mcp_installation',
        teamId,
        installationId,
        userId
      }, 'Retrieved MCP installation');

      return reply.status(200).send({
        success: true,
        data: {
          ...installation,
          created_at: installation.created_at.toISOString(),
          updated_at: installation.updated_at.toISOString(),
          last_used_at: installation.last_used_at?.toISOString() || null
        }
      });

    } catch (error) {
      request.log.error({
        operation: 'get_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to get MCP installation');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return reply.status(500).send({
        success: false,
        error: errorMessage
      });
    }
  });
}
