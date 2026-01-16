import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { TeamService } from '../../../services/teamService';
import { eq, desc } from 'drizzle-orm';
import { getDb, getSchema } from '../../../db/index';
import {
  MCP_INSTALLATIONS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  PAGINATION_QUERY_SCHEMA,
  validatePaginationParams,
  type McpInstallationsResponse,
  type ErrorResponse,
  type PaginationQuery
} from './schemas';

export default async function getTeamMcpInstallationsAdminRoute(server: FastifyInstance) {
  server.get('/teams/:id/mcp/installations', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Teams'],
      summary: 'Get team MCP installations (Global Admin)',
      description: 'Allows global administrators to view all MCP server installations for a specific team with pagination.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Team ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      querystring: PAGINATION_QUERY_SCHEMA,
      response: {
        200: {
          ...MCP_INSTALLATIONS_RESPONSE_SCHEMA,
          description: 'Paginated list of MCP installations for the team'
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
          description: 'Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { id: teamId } = request.params as { id: string };

    try {
      // 1. Validate pagination parameters
      const query = request.query as PaginationQuery;
      const { limit, offset } = validatePaginationParams(query);

      // 2. Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // 3. Query installations with server data and instance statuses
      const db = getDb();
      const schema = getSchema();

      const installationsWithInstances = await db
        .select({
          installation_id: schema.mcpServerInstallations.id,
          server_id: schema.mcpServerInstallations.server_id,
          installation_name: schema.mcpServerInstallations.installation_name,
          server_name: schema.mcpServers.name,
          server_slug: schema.mcpServers.slug,
          created_at: schema.mcpServerInstallations.created_at,
          last_used_at: schema.mcpServerInstallations.last_used_at,
          instance_status: schema.mcpServerInstances.status
        })
        .from(schema.mcpServerInstallations)
        .leftJoin(
          schema.mcpServers,
          eq(schema.mcpServerInstallations.server_id, schema.mcpServers.id)
        )
        .leftJoin(
          schema.mcpServerInstances,
          eq(schema.mcpServerInstances.installation_id, schema.mcpServerInstallations.id)
        )
        .where(eq(schema.mcpServerInstallations.team_id, teamId))
        .orderBy(desc(schema.mcpServerInstallations.created_at));

      // 4. Aggregate status by installation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const installationMap = new Map<string, any>();
      for (const row of installationsWithInstances) {
        if (!installationMap.has(row.installation_id)) {
          installationMap.set(row.installation_id, {
            installation_id: row.installation_id,
            server_id: row.server_id,
            installation_name: row.installation_name,
            server_name: row.server_name ?? 'Unknown Server',
            server_slug: row.server_slug ?? 'unknown',
            created_at: row.created_at,
            last_used_at: row.last_used_at,
            status_summary: {
              total_instances: 0,
              online: 0,
              offline: 0,
              error: 0,
              provisioning: 0
            }
          });
        }

        const inst = installationMap.get(row.installation_id);
        if (row.instance_status) {
          inst.status_summary.total_instances++;
          if (row.instance_status === 'online') {
            inst.status_summary.online++;
          } else if (row.instance_status === 'offline') {
            inst.status_summary.offline++;
          } else if (['error', 'permanently_failed'].includes(row.instance_status)) {
            inst.status_summary.error++;
          } else if (['provisioning', 'connecting', 'discovering_tools', 'syncing_tools', 'restarting', 'command_received', 'awaiting_user_config'].includes(row.instance_status)) {
            inst.status_summary.provisioning++;
          }
        }
      }

      const installations = Array.from(installationMap.values());

      // 5. Serialize installations
      const serializedInstallations = installations.map(inst => ({
        installation_id: inst.installation_id,
        server_id: inst.server_id,
        installation_name: inst.installation_name,
        server_name: inst.server_name,
        server_slug: inst.server_slug,
        status_summary: inst.status_summary,
        created_at: inst.created_at.toISOString(),
        last_used_at: inst.last_used_at ? inst.last_used_at.toISOString() : null
      }));

      // 6. Apply pagination
      const total = serializedInstallations.length;
      const paginatedInstallations = serializedInstallations.slice(offset, offset + limit);

      // 7. Log operation
      server.log.info({
        operation: 'get_team_mcp_installations_admin',
        teamId,
        totalInstallations: total,
        returnedInstallations: paginatedInstallations.length,
        pagination: { limit, offset }
      }, 'Team MCP installations retrieved successfully');

      // 8. Build success response
      const successResponse: McpInstallationsResponse = {
        success: true,
        data: {
          installations: paginatedInstallations,
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
      server.log.error({ error, teamId }, 'Failed to get team MCP installations');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
