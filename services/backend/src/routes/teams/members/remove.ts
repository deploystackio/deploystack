import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type SuccessResponse,
  type ErrorResponse
} from '../schemas';

// Team member removal parameters schema
const TEAM_MEMBER_REMOVAL_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    },
    userId: {
      type: 'string',
      minLength: 1,
      description: 'User ID of the member to remove'
    }
  },
  required: ['id', 'userId'],
  additionalProperties: false
} as const;

// TypeScript interface for parameters
interface TeamMemberRemovalParams {
  id: string;
  userId: string;
}

export default async function removeTeamMemberRoute(server: FastifyInstance) {
  server.delete('/teams/:id/members/:userId', {
    // ✅ SECURITY FIRST: No preValidation middleware needed as this has manual permission checks
    // This endpoint has complex authorization logic that needs to check team ownership and global permissions
    schema: {
      tags: ['Team Members'],
      summary: 'Remove team member',
      description: 'Removes a member from a team. Only team owners can remove members. Cannot remove members from default teams. Cannot remove team owner.',
      security: [{ cookieAuth: [] }],
      
      // Parameter validation
      params: TEAM_MEMBER_REMOVAL_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Team member removed successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Cannot remove from default team, cannot remove owner, or would leave team empty'
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
          description: 'Not Found - Team or user not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: TeamMemberRemovalParams }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // TypeScript type assertion (Fastify has already validated)
      const { id: teamId, userId: targetUserId } = request.params as TeamMemberRemovalParams;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse: ErrorResponse = {
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
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'You do not have permission to remove this member'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Remove the member
      await TeamService.removeTeamMember(teamId, targetUserId);

      const successResponse: SuccessResponse = {
        success: true,
        message: 'Team member removed successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error removing team member');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to remove team member'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
