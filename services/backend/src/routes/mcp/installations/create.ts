import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Request schema (type-only)
type CreateInstallationRequest = {
  server_id: string;
  installation_name: string;
  installation_type?: 'local' | 'cloud';
  user_environment_variables?: Record<string, string>;
};

// Response schemas
const successResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.object({
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
  })
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function createInstallationRoute(fastify: FastifyInstance) {
  fastify.post<{
    Params: { teamId: string };
    Body: CreateInstallationRequest;
  }>('/teams/:teamId/mcp/installations', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Install MCP server for team',
      description: 'Creates a new MCP server installation for the specified team. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 }
        },
        required: ['teamId'],
        additionalProperties: false
      },
      body: {
        type: 'object',
        properties: {
          server_id: { type: 'string', minLength: 1 },
          installation_name: { type: 'string', minLength: 1, maxLength: 100 },
          installation_type: { type: 'string', enum: ['local', 'cloud'] },
          user_environment_variables: { 
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['server_id', 'installation_name'],
        additionalProperties: false
      },
      // createSchema() for OpenAPI documentation
      response: {
        201: createSchema(successResponseSchema.describe('Installation created successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid input or validation error')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Team or server not found')),
        409: createSchema(errorResponseSchema.describe('Conflict - Installation name already exists'))
      }
    },
    preValidation: requireTeamPermission('mcp.installations.create')
  }, async (request, reply) => {
    const { teamId } = request.params;
    const userId = request.user!.id;
    const installationData = request.body;

    request.log.info({
      operation: 'create_mcp_installation',
      teamId,
      userId,
      serverId: installationData.server_id,
      installationName: installationData.installation_name
    }, 'Creating MCP server installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const installation = await installationService.createInstallation(
        teamId,
        userId,
        installationData
      );

      request.log.info({
        operation: 'create_mcp_installation',
        installationId: installation.id,
        teamId,
        serverId: installationData.server_id
      }, 'MCP server installation created successfully');

      const response = {
        success: true,
        data: {
          ...installation,
          created_at: installation.created_at.toISOString(),
          updated_at: installation.updated_at.toISOString(),
          last_used_at: installation.last_used_at?.toISOString() || null
        }
      };
      const jsonString = JSON.stringify(response);
      return reply.status(201).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'create_mcp_installation',
        error,
        teamId,
        serverId: installationData.server_id
      }, 'Failed to create MCP server installation');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('already exists')) {
        const conflictResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      if (errorMessage.includes('not found')) {
        const notFoundResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const badRequestResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(badRequestResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }
  });
}
