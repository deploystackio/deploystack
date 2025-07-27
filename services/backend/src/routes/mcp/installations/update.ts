import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Request schema
type UpdateInstallationSchema = {
  installation_name?: string;
  user_environment_variables?: Record<string, string>;
};

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
  data: installationSchema,
  message: z.string()
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function updateInstallationRoute(fastify: FastifyInstance) {
  fastify.put<{
    Params: { teamId: string; installationId: string };
    Body: UpdateInstallationSchema;
  }>('/teams/:teamId/mcp/installations/:installationId', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation',
      description: 'Updates an existing MCP server installation. Can update installation name and environment variables. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 },
          installationId: { type: 'string', minLength: 1 }
        },
        required: ['teamId', 'installationId'],
        additionalProperties: false
      },
      body: {
        type: 'object',
        properties: {
          installation_name: { type: 'string', minLength: 1 },
          user_environment_variables: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        },
        additionalProperties: false
      },
      response: {
        200: createSchema(successResponseSchema.describe('Installation updated successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error or installation name conflict')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required or invalid token')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or scope')),
        404: createSchema(errorResponseSchema.describe('Not Found - Installation not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.edit')
    ]
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.debug({
      operation: 'mcp_installation_operation',
      userId,
      authType,
      clientId: request.tokenPayload?.clientId,
      scope: request.tokenPayload?.scope,
      endpoint: request.url
    }, 'Authentication method determined for MCP installation operation');
    const updateData = request.body;

    request.log.info({
      operation: 'update_mcp_installation',
      teamId,
      installationId,
      userId,
      authType,
      updateFields: Object.keys(updateData)
    }, 'Updating MCP installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        updateData
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for update');

        const errorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation',
        teamId,
        installationId,
        userId,
      authType
      }, 'Successfully updated MCP installation');

      const successResponse = {
        success: true,
        data: {
          ...updatedInstallation,
          created_at: updatedInstallation.created_at.toISOString(),
          updated_at: updatedInstallation.updated_at.toISOString(),
          last_used_at: updatedInstallation.last_used_at?.toISOString() || null
        },
        message: 'Installation updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
