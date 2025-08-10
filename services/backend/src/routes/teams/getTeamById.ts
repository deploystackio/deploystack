import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import {
  TEAM_ID_PARAMS_SCHEMA,
  TEAM_WITH_ROLE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type TeamIdParams,
  type TeamWithRoleSuccessResponse,
  type ErrorResponse,
  type TeamWithRoleInfo
} from './schemas';

export default async function getTeamByIdRoute(server: FastifyInstance) {
  // GET /teams/:id - Get team by ID with user role info
  server.get('/teams/:id', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('teams:read')
    ],
    schema: {
      tags: ['Teams'],
      summary: 'Get team by ID with user role',
      description: 'Retrieves a specific team by its ID with the current user\'s role and permissions within that team. User must be a member of the team. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires teams:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      
      // Fastify validation schema
      params: TEAM_ID_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...TEAM_WITH_ROLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Team retrieved successfully with user role info'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required or invalid token'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions, scope, or not team member'
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

      const authType = request.tokenPayload ? 'oauth2' : 'cookie';
      const userId = request.user.id;
      // TypeScript type assertion (Fastify has already validated)
      const { id: teamId } = request.params as TeamIdParams;

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
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user has access to this team
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      
      if (!isTeamMember) {
        const errorResponse: ErrorResponse = {
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
      const teamWithRoleInfo: TeamWithRoleInfo = {
        ...team,
        role: (membership?.role as 'team_admin' | 'team_user') || 'team_user',
        is_admin: membership?.role === 'team_admin',
        is_owner: team.owner_id === request.user.id,
        member_count: memberCount
      };

      const successResponse: TeamWithRoleSuccessResponse = {
        success: true,
        data: teamWithRoleInfo
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching team');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch team'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
