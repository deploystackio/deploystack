import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSchema } from 'zod-openapi';
import { TeamService } from '../../services/teamService';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import { TeamsListWithRoleInfoResponseSchema, ErrorResponseSchema } from './schemas';

export default async function getUserTeamsRoute(fastify: FastifyInstance) {
  // GET /teams/me - Get current user's teams
  fastify.get('/teams/me', {
    schema: {
      tags: ['Teams'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to, including their role, admin status, ownership status, and member count. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires teams:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: createSchema(TeamsListWithRoleInfoResponseSchema.describe('User teams retrieved successfully')),
        401: createSchema(ErrorResponseSchema.describe('Unauthorized - Authentication required or invalid token')),
        403: createSchema(ErrorResponseSchema.describe('Forbidden - Insufficient permissions or scope')),
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
        operation: 'get_user_teams',
        userId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for user teams retrieval');

      const teamsWithRoles = await TeamService.getUserTeamsWithRoles(request.user.id);

      return reply.status(200).send({
        success: true,
        data: teamsWithRoles,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user teams');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user teams',
      });
    }
  });
}
