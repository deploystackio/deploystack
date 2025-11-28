import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { TeamService } from '../../../services/teamService';
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
