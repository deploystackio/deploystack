import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { TeamService } from '../../../services/teamService';
import {
  LIST_TEAMS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  SEARCH_TEAMS_QUERY_SCHEMA,
  validatePaginationParams,
  type ListTeamsResponse,
  type ErrorResponse,
  type SearchTeamsQuery
} from './schemas';

export default async function searchTeamsAdminRoute(server: FastifyInstance) {
  server.get('/teams/search', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Teams'],
      summary: 'Search teams (Global Admin)',
      description: 'Search and filter teams with pagination support. Requires global admin permissions. Supports filtering by team name (partial, case-insensitive). Results are paginated with limit (1-100, default: 20) and offset (default: 0) parameters.',
      security: [{ cookieAuth: [] }],
      querystring: SEARCH_TEAMS_QUERY_SCHEMA,
      response: {
        200: {
          ...LIST_TEAMS_RESPONSE_SCHEMA,
          description: 'Successfully retrieved filtered teams'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid pagination parameters'
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
      // Parse and validate pagination parameters
      const query = request.query as SearchTeamsQuery;
      const { limit, offset } = validatePaginationParams(query);

      // Get all teams
      const allTeams = await TeamService.getAllTeams();

      // Serialize teams
      let serializedTeams = allTeams.map(team => ({
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
      }));

      // Apply name filter
      if (query.name) {
        serializedTeams = serializedTeams.filter(team =>
          team.name.toLowerCase().includes(query.name!.toLowerCase())
        );
      }

      // Apply pagination
      const total = serializedTeams.length;
      const paginatedTeams = serializedTeams.slice(offset, offset + limit);

      // Log search info
      server.log.info({
        operation: 'search_teams_admin',
        totalResults: total,
        returnedResults: paginatedTeams.length,
        filters: {
          name: query.name
        },
        pagination: { limit, offset }
      }, 'Team search completed');

      // Build success response
      const successResponse: ListTeamsResponse = {
        success: true,
        data: {
          teams: paginatedTeams,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          }
        }
      };

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      // Handle validation errors
      if (error instanceof Error &&
          (error.message.includes('Limit must') || error.message.includes('Offset must'))) {
        server.log.warn({ error: error.message }, 'Invalid search parameters');

        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Handle other errors
      server.log.error({ error }, 'Failed to search teams');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search teams'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
