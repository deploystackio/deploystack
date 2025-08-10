import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  UPDATE_TEAM_REQUEST_SCHEMA,
  TEAM_PARAMS_SCHEMA,
  TEAM_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type UpdateTeamRequest,
  type TeamParams,
  type TeamSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateTeamRoute(server: FastifyInstance) {
  server.put('/teams/:id', {
    preValidation: requirePermission('teams.edit'), // ✅ Authorization FIRST
    schema: {
      tags: ['Teams'],
      summary: 'Update team',
      description: 'Updates an existing team. Only team admins can update teams. Default team names cannot be changed. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schemas
      params: TEAM_PARAMS_SCHEMA,
      body: UPDATE_TEAM_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_TEAM_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...TEAM_SUCCESS_RESPONSE_SCHEMA,
          description: 'Team updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error or cannot update default team name'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // TypeScript type assertions (Fastify has already validated)
      const { id: teamId } = request.params as TeamParams;
      const updateData = request.body as UpdateTeamRequest;

      // Check if team exists
      const existingTeam = await TeamService.getTeamById(teamId);
      if (!existingTeam) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user is team admin
      const isTeamAdmin = await TeamService.isTeamAdmin(teamId, request.user.id);
      if (!isTeamAdmin) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Only team administrators can update teams'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Check if trying to update default team name
      if (existingTeam.is_default && updateData.name && updateData.name !== existingTeam.name) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Default team names cannot be changed'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Update the team
      const updatedTeam = await TeamService.updateTeam(teamId, updateData);
      if (!updatedTeam) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to update team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      const successResponse: TeamSuccessResponse = {
        success: true,
        data: updatedTeam,
        message: 'Team updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error updating team');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update team'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
