import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
    installation_methods: z.array(z.any()),
    environment_variables: z.array(z.any()),
    default_config: z.any().nullable()
  }).optional()
});

const successResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(installationSchema)
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function listInstallationsRoute(fastify: FastifyInstance) {
  fastify.get<{
    Params: { teamId: string };
  }>('/teams/:teamId/mcp/installations', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'List team MCP installations',
      description: 'Retrieves all MCP server installations for the specified team. No Content-Type header required for this GET request.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required')
      }), {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successResponseSchema.describe('List of team installations'), {
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
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Team not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preValidation: requireTeamPermission('mcp.installations.view')
  }, async (request, reply) => {
    const { teamId } = request.params;
    const userId = request.user!.id;

    request.log.info({
      operation: 'list_mcp_installations',
      teamId,
      userId
    }, 'Listing MCP installations for team');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const installations = await installationService.getTeamInstallations(teamId, userId);

      request.log.info({
        operation: 'list_mcp_installations',
        teamId,
        userId,
        installationsCount: installations.length
      }, 'Retrieved MCP installations for team');

      return reply.status(200).send({
        success: true,
        data: installations.map(installation => ({
          ...installation,
          created_at: installation.created_at.toISOString(),
          updated_at: installation.updated_at.toISOString(),
          last_used_at: installation.last_used_at?.toISOString() || null
        }))
      });

    } catch (error) {
      request.log.error({
        operation: 'list_mcp_installations',
        error,
        teamId,
        userId
      }, 'Failed to list MCP installations');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return reply.status(500).send({
        success: false,
        error: errorMessage
      });
    }
  });
}
