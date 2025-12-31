import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import type { EventContext } from '../../../events/types';
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

      // Get user email before removal (for event emission)
      const { UserService } = await import('../../../services/userService');
      const userService = new UserService();
      const targetUser = await userService.getUserById(targetUserId);
      const targetUserEmail = targetUser?.email || 'unknown@email.com';

      // Remove the member
      await TeamService.removeTeamMember(teamId, targetUserId);

      // Clean up MCP server instances for removed team member
      try {
        const { getDb } = await import('../../../db');
        const db = getDb();
        const { McpInstanceService } = await import('../../../services/mcpInstanceService');
        const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');

        const instanceService = new McpInstanceService(db, server.log);
        const satelliteCommandService = new SatelliteCommandService(db, server.log);

        // Delete all instances
        const deletedCount = await instanceService.deleteInstancesByUserInTeam(targetUserId, teamId);

        server.log.info({
          operation: 'remove_team_member_cleanup_instances',
          teamId,
          userId: targetUserId,
          instancesDeleted: deletedCount
        }, `Deleted ${deletedCount} instances for removed member`);

        // Notify satellites to terminate processes
        await satelliteCommandService.createCommandForAllGlobalSatellites({
          commandType: 'configure',
          priority: 'immediate',
          payload: {
            event: 'team_member_removed',
            team_id: teamId,
            user_id: targetUserId
          },
          targetTeamId: teamId,
          expiresInMinutes: 5
        });

      } catch (error) {
        server.log.error({
          operation: 'remove_team_member_cleanup_instances',
          teamId,
          userId: targetUserId,
          error: error instanceof Error ? error.message : 'Unknown'
        }, 'Failed to delete instances for removed member');
        // Don't fail member removal
      }

      // Emit TEAM_MEMBER_REMOVED event for audit trail and notifications
      try {
        const { EVENT_NAMES } = await import('../../../events');

        const eventContext: EventContext = {
          db: server.db,
          logger: server.log,
          user: {
            id: request.user!.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.TEAM_MEMBER_REMOVED,
          {
            team: { id: teamId, name: team.name },
            member: {
              id: targetUserId,
              email: targetUserEmail,
              name: targetUser?.username || targetUserEmail
            },
            removedBy: {
              id: request.user!.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            metadata: { ip: request.ip }
          },
          eventContext
        );

        server.log.info(`TEAM_MEMBER_REMOVED event emitted for team: ${teamId}, member: ${targetUserId}`);
      } catch (eventError) {
        server.log.error(eventError, `Failed to emit TEAM_MEMBER_REMOVED event`);
      }

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
