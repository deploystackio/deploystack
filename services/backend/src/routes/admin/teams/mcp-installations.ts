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

      // 3. Query installations with server data
      const db = getDb();
      const schema = getSchema();

      const installations = await db
        .select({
          id: schema.mcpServerInstallations.id,
          installation_name: schema.mcpServerInstallations.installation_name,
          server_name: schema.mcpServers.name,
          server_slug: schema.mcpServers.slug,
          status: schema.mcpServerInstallations.status,
          created_at: schema.mcpServerInstallations.created_at,
          last_used_at: schema.mcpServerInstallations.last_used_at
        })
        .from(schema.mcpServerInstallations)
        .leftJoin(
          schema.mcpServers,
          eq(schema.mcpServerInstallations.server_id, schema.mcpServers.id)
        )
        .where(eq(schema.mcpServerInstallations.team_id, teamId))
        .orderBy(desc(schema.mcpServerInstallations.created_at));

      // 4. Serialize installations
      const serializedInstallations = installations.map(inst => ({
        id: inst.id,
        installation_name: inst.installation_name,
        server_name: inst.server_name ?? 'Unknown Server',
        server_slug: inst.server_slug ?? 'unknown',
        status: inst.status,
        created_at: inst.created_at.toISOString(),
        last_used_at: inst.last_used_at ? inst.last_used_at.toISOString() : null
      }));

      // 5. Apply pagination
      const total = serializedInstallations.length;
      const paginatedInstallations = serializedInstallations.slice(offset, offset + limit);

      // 6. Log operation
      server.log.info({
        operation: 'get_team_mcp_installations_admin',
        teamId,
        totalInstallations: total,
        returnedInstallations: paginatedInstallations.length,
        pagination: { limit, offset }
      }, 'Team MCP installations retrieved successfully');

      // 7. Build success response
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
