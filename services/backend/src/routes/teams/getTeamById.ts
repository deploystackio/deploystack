import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../services/teamService';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import { TeamWithRoleInfoSchema, ErrorResponseSchema } from './schemas';

export default async function getTeamByIdRoute(fastify: FastifyInstance) {
  // GET /teams/:id - Get team by ID with user role info
  fastify.get<{ Params: { id: string } }>('/teams/:id', {
    schema: {
      tags: ['Teams'],
      summary: 'Get team by ID with user role',
      description: 'Retrieves a specific team by its ID with the current user\'s role and permissions within that team. User must be a member of the team. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires teams:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: createSchema(z.object({
          success: z.boolean().describe('Indicates if the operation was successful'),
          data: TeamWithRoleInfoSchema.describe('Team data with user role information')
        }).describe('Team retrieved successfully with user role info')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required or invalid token')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions or scope')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - Team not found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('teams:read')
    ]
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

      const authType = request.tokenPayload ? 'oauth2' : 'cookie';
      const userId = request.user.id;
      const teamId = request.params.id;

      request.log.debug({
        operation: 'get_team_by_id',
        userId,
        teamId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for team retrieval');

      const team = await TeamService.getTeamById(teamId);

      if (!team) {
        const errorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user has access to this team
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      
      if (!isTeamMember) {
        const errorResponse = {
          success: false,
          error: 'You do not have access to this team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Get user's role and permissions within this team
      const membership = await TeamService.getTeamMembership(teamId, request.user.id);
      const memberCount = await TeamService.getTeamMemberCount(teamId);
      
      // Build team response with role information
      const teamWithRoleInfo = {
        ...team,
        role: membership?.role || 'team_user',
        is_admin: membership?.role === 'team_admin',
        is_owner: team.owner_id === request.user.id,
        member_count: memberCount
      };

      const successResponse = {
        success: true,
        data: teamWithRoleInfo
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      fastify.log.error(error, 'Error fetching team');
      const errorResponse = {
        success: false,
        error: 'Failed to fetch team'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
