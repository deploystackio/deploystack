import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../../services/teamService';
import { UserService } from '../../../services/userService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  AddTeamMemberSchema,
  TeamMemberResponseSchema,
  ErrorResponseSchema,
  type AddTeamMemberInput,
} from '../schemas';

export default async function addTeamMemberRoute(fastify: FastifyInstance) {
  const userService = new UserService();
  
  // POST /teams/:id/members - Add team member
  fastify.post<{ Params: { id: string }; Body: AddTeamMemberInput }>('/teams/:id/members', {
    schema: {
      tags: ['Team Members'],
      summary: 'Add team member',
      description: 'Adds a new member to a team by email address. Only team admins and owners can add members. Cannot add members to default teams. Teams are limited to 3 members maximum.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: createSchema(AddTeamMemberSchema),
      response: {
        201: createSchema(TeamMemberResponseSchema.describe('Team member added successfully')),
        400: createSchema(ErrorResponseSchema.describe('Bad Request - Validation error, team limit reached, user not found, or cannot add to default team')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: AddTeamMemberInput }>, reply: FastifyReply) => {
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
      const validatedData = AddTeamMemberSchema.parse(request.body);

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

      // Default teams are protected - NO ONE can add members to them (including global admins)
      if (team.is_default) {
        const errorResponse = {
          success: false,
          error: 'Cannot add members to default teams'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Find user by email address
      const targetUser = await userService.getUserByEmail(validatedData.email);
      if (!targetUser) {
        const errorResponse = {
          success: false,
          error: `User with email '${validatedData.email}' not found. User must have a DeployStack account before being added to a team.`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Check permissions
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.manage');
      const canManage = hasGlobalPermission || 
        await TeamService.canUserManageTeamMember(teamId, request.user.id, targetUser.id, 'add');

      if (!canManage) {
        const errorResponse = {
          success: false,
          error: 'You do not have permission to add members to this team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Add the member using the resolved user ID
      await TeamService.addTeamMember(teamId, targetUser.id, validatedData.role);

      // Get the full member info to return
      const members = await TeamService.getTeamMembersWithUserInfo(teamId);
      const newMember = members.find(m => m.user_id === targetUser.id);

      const successResponse = {
        success: true,
        data: newMember,
        message: `Team member '${validatedData.email}' added successfully`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);
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

      fastify.log.error(error, 'Error adding team member');
      const errorResponse = {
        success: false,
        error: 'Failed to add team member'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
