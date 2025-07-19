import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Response schemas
const successResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.any() // Client configuration varies by client type
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function getClientConfigRoute(fastify: FastifyInstance) {
  fastify.get<{
    Params: { teamId: string; installationId: string; clientType: string };
  }>('/teams/:teamId/mcp/installations/:installationId/config/:clientType', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Get client configuration for installation',
      description: 'Generates client-specific configuration for an MCP server installation. Supports claude-desktop, vscode, and cursor clients. No Content-Type header required for this GET request.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      params: {
        type: 'object',
        properties: {
          teamId: { type: 'string', minLength: 1 },
          installationId: { type: 'string', minLength: 1 },
          clientType: { type: 'string', enum: ['claude-desktop', 'vscode', 'cursor'] }
        },
        required: ['teamId', 'installationId', 'clientType'],
        additionalProperties: false
      },
      // createSchema() for OpenAPI documentation
      response: {
        200: createSchema(successResponseSchema.describe('Client configuration generated successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid client type or installation')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Installation not found'))
      }
    },
    preValidation: requireTeamPermission('mcp.installations.view')
  }, async (request, reply) => {
    const { teamId, installationId, clientType } = request.params;
    const userId = request.user!.id;

    request.log.info({
      operation: 'get_client_config',
      teamId,
      installationId,
      clientType,
      userId
    }, 'Generating client configuration for MCP installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const config = await installationService.generateClientConfig(
        installationId,
        teamId,
        clientType as 'claude-desktop' | 'vscode' | 'cursor'
      );

      request.log.info({
        operation: 'get_client_config',
        teamId,
        installationId,
        clientType,
        userId
      }, 'Client configuration generated successfully');

      const response = {
        success: true,
        data: config
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_client_config',
        error,
        teamId,
        installationId,
        clientType,
        userId
      }, 'Failed to generate client configuration');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('not found')) {
        const notFoundResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (errorMessage.includes('Unsupported client type') || 
          errorMessage.includes('does not support')) {
        const badRequestResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(badRequestResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      const errorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
