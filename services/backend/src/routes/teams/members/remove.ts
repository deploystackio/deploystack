import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '../schemas';

export default async function removeTeamMemberRoute(fastify: FastifyInstance) {
  // DELETE /teams/:id/members/:userId - Remove team member
  fastify.delete<{ Params: { id: string; userId: string } }>('/teams/:id/members/:userId', {
    schema: {
      tags: ['Team Members'],
      summary: 'Remove team member',
      description: 'Removes a member from a team. Only team owners can remove members. Cannot remove members from default teams. Cannot remove team owner.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['id', 'userId']
      },
      response: {
        200: createSchema(SuccessResponseSchema.describe('Team member removed successfully')),
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Cannot remove from default team, cannot remove owner, or would leave team empty')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team or user not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string; userId: string } }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const teamId = request.params.id;
      const targetUserId = request.params.userId;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check permissions
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const canManage = hasGlobalPermission || 
        await TeamService.canUserManageTeamMember(teamId, request.user.id, targetUserId, 'remove');

      if (!canManage) {
        const errorResponse = {
          success: false,
          error: 'You do not have permission to remove this member'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Remove the member
      await TeamService.removeTeamMember(teamId, targetUserId);

      const successResponse = {
        success: true,
        message: 'Team member removed successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        const errorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      fastify.log.error(error, 'Error removing team member');
      const errorResponse = {
        success: false,
        error: 'Failed to remove team member'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
