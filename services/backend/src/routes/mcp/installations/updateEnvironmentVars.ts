import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Request schema
type UpdateEnvironmentVariablesSchema = {
  environment_variables: Record<string, string>;
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

export default async function updateEnvironmentVariablesRoute(fastify: FastifyInstance) {
  fastify.patch<{
    Params: { teamId: string; installationId: string };
    Body: UpdateEnvironmentVariablesSchema;
  }>('/teams/:teamId/mcp/installations/:installationId/environment-variables', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation environment variables',
      description: 'Updates the environment variables for an existing MCP server installation. This endpoint specifically handles environment variable updates only. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
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
          environment_variables: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['environment_variables'],
        additionalProperties: false
      },
      response: {
        200: createSchema(successResponseSchema.describe('Environment variables updated successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error or missing required environment variables')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Installation not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireTeamPermission('mcp.installations.edit')
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
    const userId = request.user!.id;
    const { environment_variables } = request.body;

    request.log.info({
      operation: 'update_mcp_installation_environment_variables',
      teamId,
      installationId,
      userId,
      environmentVariableCount: Object.keys(environment_variables).length
    }, 'Updating MCP installation environment variables');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      // Update only the environment variables
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        { user_environment_variables: environment_variables }
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation_environment_variables',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for environment variables update');

        const errorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation_environment_variables',
        teamId,
        installationId,
        userId
      }, 'Successfully updated MCP installation environment variables');

      const successResponse = {
        success: true,
        data: {
          ...updatedInstallation,
          created_at: updatedInstallation.created_at.toISOString(),
          updated_at: updatedInstallation.updated_at.toISOString(),
          last_used_at: updatedInstallation.last_used_at?.toISOString() || null
        },
        message: 'Environment variables updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation_environment_variables',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation environment variables');

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
