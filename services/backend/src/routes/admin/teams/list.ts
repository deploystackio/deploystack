import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { TeamService } from '../../../services/teamService';
import {
  LIST_TEAMS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ListTeamsResponse,
  type ErrorResponse
} from './schemas';

export default async function listTeamsAdminRoute(server: FastifyInstance) {
  server.get('/teams', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Teams'],
      summary: 'List all teams (Global Admin)',
      description: 'Allows global administrators to retrieve a list of all teams in the system.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...LIST_TEAMS_RESPONSE_SCHEMA,
          description: 'List of all teams'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Get all teams
      const teams = await TeamService.getAllTeams();

      // Build success response
      const listResponse: ListTeamsResponse = {
        success: true,
        data: teams.map(team => ({
          id: team.id,
          name: team.name,
          slug: team.slug,
          description: team.description ?? null,
          owner_id: team.owner_id,
          is_default: team.is_default,
          non_http_mcp_limit: team.non_http_mcp_limit,
          mcp_server_limit: team.mcp_server_limit,
          created_at: team.created_at.toISOString(),
          updated_at: team.updated_at.toISOString()
        }))
      };

      const jsonString = JSON.stringify(listResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error }, 'Failed to list teams');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
