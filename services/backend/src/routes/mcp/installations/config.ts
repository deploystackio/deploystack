import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
      params: zodToJsonSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required'),
        installationId: z.string().min(1, 'Installation ID is required'),
        clientType: z.enum(['claude-desktop', 'vscode', 'cursor'], {
          error: () => ({ message: 'Client type must be one of: claude-desktop, vscode, cursor' })
        })
      }), {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successResponseSchema.describe('Client configuration generated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid client type or installation'), {
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

      return reply.status(200).send({
        success: true,
        data: config
      });

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
        return reply.status(404).send({
          success: false,
          error: errorMessage
        });
      }

      if (errorMessage.includes('Unsupported client type') || 
          errorMessage.includes('does not support')) {
        return reply.status(400).send({
          success: false,
          error: errorMessage
        });
      }

      return reply.status(500).send({
        success: false,
        error: errorMessage
      });
    }
  });
}
