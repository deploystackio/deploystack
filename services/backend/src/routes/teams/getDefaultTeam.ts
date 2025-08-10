import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../services/teamService';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import { TeamResponseSchema, ErrorResponseSchema } from './schemas';

export default async function getDefaultTeamRoute(fastify: FastifyInstance) {
  // GET /teams/me/default - Get current user's default team
  fastify.get('/teams/me/default', {
    schema: {
      tags: ['Teams'],
      summary: 'Get current user default team',
      description: 'Retrieves the default team for the currently authenticated user. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires teams:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: createSchema(TeamResponseSchema.describe('Default team retrieved successfully')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required or invalid token')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions or scope')),
        404: createSchema(ErrorResponseSchema.describe('Not Found - No default team found')),
        500: createSchema(ErrorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('teams:read')
    ]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
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
        return reply.status(404).send({
          success: false,
          error: 'No default team found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: defaultTeam,
        message: 'Default team retrieved successfully',
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user default team');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch default team',
      });
    }
  });
}
