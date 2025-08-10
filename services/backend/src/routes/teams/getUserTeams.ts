import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import {
  TEAMS_LIST_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type TeamsListSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getUserTeamsRoute(server: FastifyInstance) {
  // GET /teams/me - Get current user's teams
  server.get('/teams/me', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('teams:read')
    ],
    schema: {
      tags: ['Teams'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to, including their role, admin status, ownership status, and member count. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires teams:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: {
          ...TEAMS_LIST_SUCCESS_RESPONSE_SCHEMA,
          description: 'User teams retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required or invalid token'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or scope'
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

      request.log.debug({
        operation: 'get_user_teams',
        userId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for user teams retrieval');

      const teamsWithRoles = await TeamService.getUserTeamsWithRoles(request.user.id);

      const successResponse: TeamsListSuccessResponse = {
        success: true,
        data: teamsWithRoles
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching user teams');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user teams'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
