import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { TeamService } from '../../../services/teamService';
import {
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type SuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getTeamAdminRoute(server: FastifyInstance) {
  server.get('/teams/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Teams'],
      summary: 'Get team by ID (Global Admin)',
      description: 'Allows global administrators to retrieve a specific team by ID.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Team ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Team retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Get team by ID
      const team = await TeamService.getTeamById(id);

      if (!team) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Build success response
      const successResponse: SuccessResponse = {
        success: true,
        message: 'Team retrieved successfully',
        data: {
          id: team.id,
          name: team.name,
          slug: team.slug,
          description: team.description ?? null,
          owner_id: team.owner_id,
          is_default: team.is_default,
          non_http_mcp_limit: team.non_http_mcp_limit,
          mcp_server_limit: team.mcp_server_limit,
          member_limit: team.member_limit,
          allow_remote_mcp: team.allow_remote_mcp,
          created_at: team.created_at.toISOString(),
          updated_at: team.updated_at.toISOString()
        }
      };

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error, teamId: id }, 'Failed to get team');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
