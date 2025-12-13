/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  TEAM_ID_PARAMS_SCHEMA,
  DELETE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type TeamIdParams,
  type DeleteSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function deleteTeamRoute(server: FastifyInstance) {
  // DELETE /teams/:id - Delete team
  server.delete('/teams/:id', {
    preValidation: requirePermission('teams.delete'),
    schema: {
      tags: ['Teams'],
      summary: 'Delete team',
      description: 'Deletes a team from the system. Only team owners can delete teams. Default teams cannot be deleted.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: TEAM_ID_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...DELETE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Team deleted successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Cannot delete default team or team has active resources'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or not team owner'
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
    },
  }, async (request: FastifyRequest<{ Params: TeamIdParams }>, reply) => {
    try {
      // TypeScript types are now properly inferred from route definition
      const { id: teamId } = request.params;

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

      // Check if user is team owner (user is guaranteed to exist due to preValidation)
      if (existingTeam.owner_id !== request.user!.id) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Only team owners can delete teams'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Check if it's a default team
      if (existingTeam.is_default) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Default teams cannot be deleted'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Delete the team
      await TeamService.deleteTeam(teamId, request.user!.id, server.log);

      // Queue team deletion email
      try {
        const jobQueueService = (server as any).jobQueueService;
        if (jobQueueService) {
          await jobQueueService.createJob('send_email', {
            to: (request.user as any).email,
            subject: 'Team Deleted Successfully',
            template: 'team-deleted',
            variables: {
              userName: (request.user as any).username || (request.user as any).email,
              teamName: existingTeam.name
            }
          });
          server.log.info({
            operation: 'team_deleted',
            teamId,
            userEmail: (request.user as any).email
          }, 'Team deletion email queued');
        }
      } catch (emailError) {
        server.log.error(emailError, 'Failed to queue team deletion email - team deletion succeeded but email not sent');
        // Don't fail team deletion if email queueing fails
      }

      const successResponse: DeleteSuccessResponse = {
        success: true,
        message: 'Team deleted successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error && error.message.includes('active resources')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Cannot delete team with active resources'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error deleting team');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to delete team',
        details: [error instanceof Error ? error.message : 'Unknown error']
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
