import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
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
    runtime: z.string(),
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
      description: 'Retrieves all MCP server installations for the specified team. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: createSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required')
      })),
      response: {
        200: createSchema(successResponseSchema.describe('List of team installations')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required or invalid token')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or scope')),
        404: createSchema(errorResponseSchema.describe('Not Found - Team not found'))
      }
    },
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.view')
    ]
  }, async (request, reply) => {
    const { teamId } = request.params;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.debug({
      operation: 'list_mcp_installations',
      teamId,
      userId,
      authType,
      clientId: request.tokenPayload?.clientId,
      scope: request.tokenPayload?.scope,
      endpoint: request.url
    }, 'Authentication method determined for MCP installations list');

    request.log.info({
      operation: 'list_mcp_installations',
      teamId,
      userId,
      authType
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
