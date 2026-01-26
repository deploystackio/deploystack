import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { TeamService } from '../../../services/teamService';
import { getDb, getSchema } from '../../../db';
import { eq, sql } from 'drizzle-orm';
import {
  UPDATE_TEAM_ADMIN_SCHEMA,
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type UpdateTeamAdminRequest,
  type SuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateTeamAdminRoute(server: FastifyInstance) {
  server.put('/teams/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Teams'],
      summary: 'Update team (Global Admin)',
      description: 'Allows global administrators to update any team\'s name, description, and non-HTTP MCP server limit.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Team ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      body: UPDATE_TEAM_ADMIN_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_TEAM_ADMIN_SCHEMA
          }
        }
      },
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Team updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid input'
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
    const updateData = request.body as UpdateTeamAdminRequest;

    try {
      // Check if team exists
      const existingTeam = await TeamService.getTeamById(id);
      if (!existingTeam) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Validate non_http_mcp_limit if provided
      if (updateData.non_http_mcp_limit !== undefined) {
        if (!Number.isInteger(updateData.non_http_mcp_limit) || updateData.non_http_mcp_limit < 0) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'non_http_mcp_limit must be a non-negative integer'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Validate mcp_server_limit if provided
      if (updateData.mcp_server_limit !== undefined) {
        if (!Number.isInteger(updateData.mcp_server_limit) || updateData.mcp_server_limit < 0) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'mcp_server_limit must be a non-negative integer'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Validate member_limit if provided
      if (updateData.member_limit !== undefined) {
        if (!Number.isInteger(updateData.member_limit) || updateData.member_limit < 1) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'member_limit must be a positive integer'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Validate allow_remote_mcp if provided
      if (updateData.allow_remote_mcp !== undefined) {
        if (typeof updateData.allow_remote_mcp !== 'boolean') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'allow_remote_mcp must be a boolean value'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Validate allow_github_mcp if provided
      if (updateData.allow_github_mcp !== undefined) {
        if (typeof updateData.allow_github_mcp !== 'boolean') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'allow_github_mcp must be a boolean value'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Validate allow_private_github_repos if provided
      if (updateData.allow_private_github_repos !== undefined) {
        if (typeof updateData.allow_private_github_repos !== 'boolean') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'allow_private_github_repos must be a boolean value'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Validate github_mcp_limit if provided
      if (updateData.github_mcp_limit !== undefined) {
        if (!Number.isInteger(updateData.github_mcp_limit) || updateData.github_mcp_limit < 0) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'github_mcp_limit must be a non-negative integer'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Cross-field validation: mcp_server_limit >= non_http_mcp_limit + github_mcp_limit
      if (
        updateData.non_http_mcp_limit !== undefined ||
        updateData.github_mcp_limit !== undefined ||
        updateData.mcp_server_limit !== undefined
      ) {
        // Determine final values (use updated value if provided, else use existing)
        const finalNonHttpLimit = updateData.non_http_mcp_limit !== undefined
          ? updateData.non_http_mcp_limit
          : existingTeam.non_http_mcp_limit;

        const finalGithubLimit = updateData.github_mcp_limit !== undefined
          ? updateData.github_mcp_limit
          : existingTeam.github_mcp_limit;

        const finalMcpServerLimit = updateData.mcp_server_limit !== undefined
          ? updateData.mcp_server_limit
          : existingTeam.mcp_server_limit;

        // Calculate minimum required limit
        const minimumRequired = finalNonHttpLimit + finalGithubLimit;

        // Validate constraint
        if (finalMcpServerLimit < minimumRequired) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `mcp_server_limit (${finalMcpServerLimit}) must be at least ${minimumRequired} (non_http_mcp_limit: ${finalNonHttpLimit} + github_mcp_limit: ${finalGithubLimit})`
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Update the team
      const updatedTeam = await TeamService.updateTeam(id, updateData);

      if (!updatedTeam) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to update team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      // Get database and schema
      const db = getDb();
      const schema = getSchema();

      // Get counts for the updated team
      type TeamCounts = {
        members_count: number;
        mcp_servers_count: number;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const teamWithCounts: TeamCounts[] = await (db as any)
        .select({
          members_count: sql<number>`COUNT(DISTINCT ${schema.teamMemberships.id})::int`,
          mcp_servers_count: sql<number>`COUNT(DISTINCT ${schema.mcpServerInstallations.id})::int`
        })
        .from(schema.teams)
        .leftJoin(schema.teamMemberships, eq(schema.teams.id, schema.teamMemberships.team_id))
        .leftJoin(schema.mcpServerInstallations, eq(schema.teams.id, schema.mcpServerInstallations.team_id))
        .where(eq(schema.teams.id, id))
        .groupBy(schema.teams.id)
        .limit(1);

      const counts = teamWithCounts[0] || { members_count: 0, mcp_servers_count: 0 };

      // Build success response
      const successResponse: SuccessResponse = {
        success: true,
        message: 'Team updated successfully',
        data: {
          id: updatedTeam.id,
          name: updatedTeam.name,
          slug: updatedTeam.slug,
          description: updatedTeam.description ?? null,
          owner_id: updatedTeam.owner_id,
          is_default: updatedTeam.is_default,
          non_http_mcp_limit: updatedTeam.non_http_mcp_limit,
          mcp_server_limit: updatedTeam.mcp_server_limit,
          member_limit: updatedTeam.member_limit,
          allow_remote_mcp: updatedTeam.allow_remote_mcp,
          allow_github_mcp: updatedTeam.allow_github_mcp,
          allow_private_github_repos: updatedTeam.allow_private_github_repos,
          github_mcp_limit: updatedTeam.github_mcp_limit,
          mcp_servers_count: counts.mcp_servers_count,
          members_count: counts.members_count,
          created_at: updatedTeam.created_at.toISOString(),
          updated_at: updatedTeam.updated_at.toISOString()
        }
      };

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error, teamId: id }, 'Failed to update team');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
