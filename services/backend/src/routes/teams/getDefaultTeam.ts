import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import {
  TEAM_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type TeamSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getDefaultTeamRoute(server: FastifyInstance) {
  // GET /teams/me/default - Get current user's default team
  server.get('/teams/me/default', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('teams:read')
    ],
    schema: {
      tags: ['Teams'],
      summary: 'Get current user default team',
      description: 'Retrieves the default team for the currently authenticated user. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires teams:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: {
          ...TEAM_SUCCESS_RESPONSE_SCHEMA,
          description: 'Default team retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required or invalid token'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or scope'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - No default team found'
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
        operation: 'get_user_default_team',
        userId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for default team retrieval');

      const defaultTeam = await TeamService.getUserDefaultTeam(request.user.id);
      
      if (!defaultTeam) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'No default team found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: TeamSuccessResponse = {
        success: true,
        data: defaultTeam,
        message: 'Default team retrieved successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching user default team');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch default team'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
