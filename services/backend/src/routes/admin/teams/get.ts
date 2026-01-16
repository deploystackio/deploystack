import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, sql } from 'drizzle-orm';
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
      // Get database and schema
      const db = getDb();
      const schema = getSchema();

      // Get team with counts in a single query
      const teamWithCounts: Array<{
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }> = await (db as any)
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
        .leftJoin(schema.mcpServerInstallations, eq(schema.teams.id, schema.mcpServerInstallations.team_id))
        .where(eq(schema.teams.id, id))
        .groupBy(
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
        )
        .limit(1);

      if (!teamWithCounts || teamWithCounts.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const team = teamWithCounts[0];

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
          mcp_servers_count: team.mcp_servers_count,
          members_count: team.members_count,
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
