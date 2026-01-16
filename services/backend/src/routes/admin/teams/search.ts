import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, sql, like } from 'drizzle-orm';
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

      // Get database and schema
      const db = getDb();
      const schema = getSchema();

      // Build query with counts
      type TeamWithCounts = {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        owner_id: string;
        is_default: boolean;
        non_http_mcp_limit: number;
        mcp_server_limit: number;
        member_limit: number;
        allow_remote_mcp: boolean;
        created_at: Date;
        updated_at: Date;
        members_count: number;
        mcp_servers_count: number;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let teamsQuery = (db as any)
        .select({
          id: schema.teams.id,
          name: schema.teams.name,
          slug: schema.teams.slug,
          description: schema.teams.description,
          owner_id: schema.teams.owner_id,
          is_default: schema.teams.is_default,
          non_http_mcp_limit: schema.teams.non_http_mcp_limit,
          mcp_server_limit: schema.teams.mcp_server_limit,
          member_limit: schema.teams.member_limit,
          allow_remote_mcp: schema.teams.allow_remote_mcp,
          created_at: schema.teams.created_at,
          updated_at: schema.teams.updated_at,
          members_count: sql<number>`COUNT(DISTINCT ${schema.teamMemberships.id})::int`,
          mcp_servers_count: sql<number>`COUNT(DISTINCT ${schema.mcpServerInstallations.id})::int`
        })
        .from(schema.teams)
        .leftJoin(schema.teamMemberships, eq(schema.teams.id, schema.teamMemberships.team_id))
        .leftJoin(schema.mcpServerInstallations, eq(schema.teams.id, schema.mcpServerInstallations.team_id));

      // Apply name filter at database level
      if (query.name) {
        teamsQuery = teamsQuery.where(like(schema.teams.name, `%${query.name}%`));
      }

      // Complete query with GROUP BY
      const teamsWithCounts: TeamWithCounts[] = await teamsQuery.groupBy(
        schema.teams.id,
        schema.teams.name,
        schema.teams.slug,
        schema.teams.description,
        schema.teams.owner_id,
        schema.teams.is_default,
        schema.teams.non_http_mcp_limit,
        schema.teams.mcp_server_limit,
        schema.teams.member_limit,
        schema.teams.allow_remote_mcp,
        schema.teams.created_at,
        schema.teams.updated_at
      );

      // Serialize teams
      const serializedTeams = teamsWithCounts.map((team) => ({
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
        mcp_servers_count: team.mcp_servers_count,
        members_count: team.members_count,
        created_at: team.created_at.toISOString(),
        updated_at: team.updated_at.toISOString()
      }));

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
