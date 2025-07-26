import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  UpdateMemberRoleSchema,
  TeamMemberResponseSchema,
  ErrorResponseSchema,
  type UpdateMemberRoleInput,
} from '../schemas';

export default async function updateMemberRoleRoute(fastify: FastifyInstance) {
  // PUT /teams/:id/members/:userId/role - Update member role
  fastify.put<{ Params: { id: string; userId: string }; Body: UpdateMemberRoleInput }>('/teams/:id/members/:userId/role', {
    schema: {
      tags: ['Team Members'],
      summary: 'Update team member role',
      description: 'Updates a team member\'s role. Only team owners can change roles. Cannot change roles in default teams. Must maintain at least one team admin.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['id', 'userId']
      },
      body: createSchema(UpdateMemberRoleSchema),
      response: {
        200: createSchema(TeamMemberResponseSchema.describe('Team member role updated successfully')),
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Validation error, cannot change roles in default team, or would leave no admins')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team or user not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string; userId: string }; Body: UpdateMemberRoleInput }>, reply: FastifyReply) => {
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
      const validatedData = UpdateMemberRoleSchema.parse(request.body);

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
        await TeamService.canUserManageTeamMember(teamId, request.user.id, targetUserId, 'change_role');

      if (!canManage) {
        const errorResponse = {
          success: false,
          error: 'You do not have permission to change this member\'s role'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Update the role
      await TeamService.updateMemberRole(teamId, targetUserId, validatedData.role);

      // Get the updated member info to return
      const members = await TeamService.getTeamMembersWithUserInfo(teamId);
      const updatedMember = members.find(m => m.user_id === targetUserId);

      const successResponse = {
        success: true,
        data: updatedMember,
        message: 'Team member role updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse = {
          success: false,
          error: 'Validation error',
          details: error.issues
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      if (error instanceof Error) {
        const errorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      fastify.log.error(error, 'Error updating team member role');
      const errorResponse = {
        success: false,
        error: 'Failed to update team member role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
