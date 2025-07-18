import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';

// Request schema
const createInstallationSchema = z.object({
  server_id: z.string().min(1, 'Server ID is required'),
  installation_name: z.string().min(1, 'Installation name is required').max(100, 'Installation name too long'),
  installation_type: z.enum(['local', 'cloud']).optional().default('local'),
  user_environment_variables: z.record(z.string()).optional()
});

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
    user_environment_variables: z.record(z.string()).optional(),
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
    Body: z.infer<typeof createInstallationSchema>;
  }>('/teams/:teamId/mcp/installations', {
    schema: {
      tags: ['MCP Installations'],
      summary: 'Install MCP server for team',
      description: 'Creates a new MCP server installation for the specified team. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(z.object({
        teamId: z.string().min(1, 'Team ID is required')
      }), {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      body: zodToJsonSchema(createInstallationSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        201: zodToJsonSchema(successResponseSchema.describe('Installation created successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid input or validation error'), {
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
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Team or server not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Installation name already exists'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
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

      return reply.status(201).send({
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
        operation: 'create_mcp_installation',
        error,
        teamId,
        serverId: installationData.server_id
      }, 'Failed to create MCP server installation');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('already exists')) {
        return reply.status(409).send({
          success: false,
          error: errorMessage
        });
      }

      if (errorMessage.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: errorMessage
        });
      }

      return reply.status(400).send({
        success: false,
        error: errorMessage
      });
    }
  });
}
