import type { FastifyInstance, FastifyRequest } from 'fastify';
import { TeamService } from '../../../services/teamService';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import {
  UPDATE_MEMBER_ROLE_SCHEMA,
  TEAM_MEMBER_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type UpdateMemberRoleInput,
  type TeamMemberResponse,
  type ErrorResponse
} from '../schemas';

// TypeScript interfaces for route typing
interface UpdateRoleParams {
  id: string;
  userId: string;
}

export default async function updateMemberRoleRoute(server: FastifyInstance) {
  // PUT /teams/:id/members/:userId/role - Update member role
  server.put('/teams/:id/members/:userId/role', {
    preValidation: requireTeamPermission('team.members.manage', (request) => {
      const params = request.params as { id?: string };
      return params?.id || '';
    }),
    schema: {
      tags: ['Team Members'],
      summary: 'Update team member role',
      description: 'Updates a team member\'s role. Only team owners can change roles. Cannot change roles in default teams. Must maintain at least one team admin. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Team ID' },
          userId: { type: 'string', description: 'User ID' }
        },
        required: ['id', 'userId'],
        additionalProperties: false
      },
      body: UPDATE_MEMBER_ROLE_SCHEMA,
      response: {
        200: {
          ...TEAM_MEMBER_RESPONSE_SCHEMA,
          description: 'Team member role updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error, cannot change roles in default team, or would leave no admins'
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
  }, async (request: FastifyRequest<{ Params: UpdateRoleParams; Body: UpdateMemberRoleInput }>, reply) => {
    try {
      // TypeScript types are now properly inferred from route definition
      const teamId = request.params.id;
      const targetUserId = request.params.userId;
      const { role } = request.body;

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

      // Update the role
      await TeamService.updateMemberRole(teamId, targetUserId, role);

      // Get the updated member info to return
      const members = await TeamService.getTeamMembersWithUserInfo(teamId);
      const updatedMember = members.find(m => m.user_id === targetUserId);

      if (!updatedMember) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Updated member not found after role change'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: TeamMemberResponse = {
        success: true,
        data: {
          id: updatedMember.id,
          user_id: updatedMember.user_id,
          username: updatedMember.username,
          email: updatedMember.email,
          first_name: updatedMember.first_name ?? null,
          last_name: updatedMember.last_name ?? null,
          role: updatedMember.role,
          is_admin: updatedMember.is_admin,
          is_owner: updatedMember.is_owner,
          joined_at: updatedMember.joined_at
        },
        message: 'Team member role updated successfully'
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

      server.log.error(error, 'Error updating team member role');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update team member role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
