import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  TeamMembersListResponseSchema,
  ErrorResponseSchema,
} from '../schemas';

export default async function listTeamMembersRoute(fastify: FastifyInstance) {
  // GET /teams/:id/members - Get team members
  fastify.get<{ Params: { id: string } }>('/teams/:id/members', {
    schema: {
      tags: ['Team Members'],
      summary: 'Get team members',
      description: 'Retrieves all members of a specific team with their user information, roles, and status flags.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: createSchema(TeamMembersListResponseSchema.describe('Team members retrieved successfully')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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

      // Check if user has access to view team members
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.view');
      
      if (!isTeamMember && !hasGlobalPermission) {
        const errorResponse = {
          success: false,
          error: 'You do not have permission to view this team\'s members'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const members = await TeamService.getTeamMembersWithUserInfo(teamId);

      const successResponse = {
        success: true,
        data: members
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      fastify.log.error(error, 'Error fetching team members');
      const errorResponse = {
        success: false,
        error: 'Failed to fetch team members'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
