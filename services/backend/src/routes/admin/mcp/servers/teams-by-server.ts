import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../../middleware/roleMiddleware';
import { eq, desc } from 'drizzle-orm';
import { getDb, getSchema } from '../../../../db/index';
import {
  TEAMS_BY_SERVER_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  PAGINATION_QUERY_SCHEMA,
  validatePaginationParams,
  type TeamsByServerResponse,
  type ErrorResponse,
  type PaginationQuery,
  type TeamWithInstallations,
  type InstallationDetail,
  type StatusSummary
} from './schemas';

export default async function getTeamsByServerAdminRoute(server: FastifyInstance) {
  server.get('/servers/:serverId/teams', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - MCP Servers'],
      summary: 'Get teams using MCP server (Global Admin)',
      description: 'Allows global administrators to view all teams that have installed a specific MCP server with pagination and status summary.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: 'MCP Server ID' }
        },
        required: ['serverId'],
        additionalProperties: false
      },
      querystring: PAGINATION_QUERY_SCHEMA,
      response: {
        200: {
          ...TEAMS_BY_SERVER_RESPONSE_SCHEMA,
          description: 'Paginated list of teams using this MCP server'
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
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'MCP server not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };

    try {
      // 1. Validate pagination parameters
      const query = request.query as PaginationQuery;
      const { limit, offset } = validatePaginationParams(query);

      // 2. Get database connection and schema
      const db = getDb();
      const schema = getSchema();

      // 3. Check if MCP server exists
      const mcpServer = await db
        .select({
          id: schema.mcpServers.id,
          name: schema.mcpServers.name,
          slug: schema.mcpServers.slug
        })
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.id, serverId))
        .limit(1);

      if (mcpServer.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'MCP server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const serverInfo = mcpServer[0];

      // 4. Query all installations of this server with team and instance data
      const teamsWithInstallations = await db
        .select({
          team_id: schema.teams.id,
          team_name: schema.teams.name,
          team_slug: schema.teams.slug,
          installation_id: schema.mcpServerInstallations.id,
          installation_name: schema.mcpServerInstallations.installation_name,
          created_at: schema.mcpServerInstallations.created_at,
          last_used_at: schema.mcpServerInstallations.last_used_at,
          instance_status: schema.mcpServerInstances.status
        })
        .from(schema.mcpServerInstallations)
        .innerJoin(
          schema.teams,
          eq(schema.mcpServerInstallations.team_id, schema.teams.id)
        )
        .leftJoin(
          schema.mcpServerInstances,
          eq(schema.mcpServerInstances.installation_id, schema.mcpServerInstallations.id)
        )
        .where(eq(schema.mcpServerInstallations.server_id, serverId))
        .orderBy(desc(schema.teams.created_at));

      // 5. Aggregate data by team_id
      const teamMap = new Map<string, {
        team_id: string;
        team_name: string;
        team_slug: string;
        installations: Map<string, InstallationDetail>;
        status_summary: StatusSummary;
      }>();

      for (const row of teamsWithInstallations) {
        if (!teamMap.has(row.team_id)) {
          teamMap.set(row.team_id, {
            team_id: row.team_id,
            team_name: row.team_name,
            team_slug: row.team_slug,
            installations: new Map(),
            status_summary: {
              total_instances: 0,
              online: 0,
              offline: 0,
              error: 0,
              provisioning: 0
            }
          });
        }

        const team = teamMap.get(row.team_id)!;

        // Add installation if not already tracked
        if (!team.installations.has(row.installation_id)) {
          team.installations.set(row.installation_id, {
            installation_id: row.installation_id,
            installation_name: row.installation_name,
            created_at: row.created_at.toISOString(),
            last_used_at: row.last_used_at ? row.last_used_at.toISOString() : null
          });
        }

        // Aggregate instance statuses
        if (row.instance_status) {
          team.status_summary.total_instances++;
          if (row.instance_status === 'online') {
            team.status_summary.online++;
          } else if (row.instance_status === 'offline') {
            team.status_summary.offline++;
          } else if (['error', 'permanently_failed'].includes(row.instance_status)) {
            team.status_summary.error++;
          } else if (['provisioning', 'connecting', 'discovering_tools', 'syncing_tools', 'restarting', 'command_received', 'awaiting_user_config'].includes(row.instance_status)) {
            team.status_summary.provisioning++;
          }
        }
      }

      // 6. Convert to response format
      const teams: TeamWithInstallations[] = Array.from(teamMap.values()).map(team => ({
        team_id: team.team_id,
        team_name: team.team_name,
        team_slug: team.team_slug,
        installations: Array.from(team.installations.values()),
        installation_count: team.installations.size,
        status_summary: team.status_summary
      }));

      // 7. Apply pagination
      const total = teams.length;
      const paginatedTeams = teams.slice(offset, offset + limit);

      // 8. Log operation
      server.log.info({
        operation: 'get_teams_by_server_admin',
        serverId,
        serverName: serverInfo.name,
        totalTeams: total,
        returnedTeams: paginatedTeams.length,
        pagination: { limit, offset }
      }, 'Teams using MCP server retrieved successfully');

      // 9. Build success response
      const successResponse: TeamsByServerResponse = {
        success: true,
        data: {
          server_info: {
            server_id: serverInfo.id,
            server_name: serverInfo.name,
            server_slug: serverInfo.slug
          },
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
        server.log.warn({ error: error.message }, 'Invalid pagination parameters');

        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Handle other errors
      server.log.error({ error, serverId }, 'Failed to get teams by MCP server');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
