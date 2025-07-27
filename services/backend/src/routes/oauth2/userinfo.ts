import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireValidAccessToken, requireOAuthScope } from '../../middleware/oauthMiddleware';
import { UserService } from '../../services/userService';

// OAuth2 UserInfo response schema (RFC 6749 / OpenID Connect standard)
const userInfoResponseSchema = z.object({
  sub: z.string().describe('Subject identifier - unique user ID'),
  email: z.string().email().describe('User email address'),
  name: z.string().optional().describe('Full name of the user'),
  preferred_username: z.string().describe('Preferred username'),
  email_verified: z.boolean().describe('Whether the email address has been verified'),
  given_name: z.string().optional().describe('Given name (first name)'),
  family_name: z.string().optional().describe('Family name (last name)')
});

// Error response schema for OAuth2 errors
const oauthErrorResponseSchema = z.object({
  error: z.string().describe('OAuth2 error code'),
  error_description: z.string().describe('Human-readable error description')
});

export default async function userinfoRoute(fastify: FastifyInstance) {
  const userService = new UserService();

  // GET /oauth2/userinfo - Standard OAuth2 UserInfo endpoint
  fastify.get('/oauth2/userinfo', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Get user information',
      description: 'Returns user information for the authenticated user. This is the standard OAuth2/OpenID Connect UserInfo endpoint. Requires a valid OAuth2 access token with user:read scope.',
      security: [{ bearerAuth: [] }],
      response: {
        200: createSchema(userInfoResponseSchema.describe('User information retrieved successfully')),
        401: createSchema(oauthErrorResponseSchema.describe('Unauthorized - Invalid or missing access token')),
        403: createSchema(oauthErrorResponseSchema.describe('Forbidden - Insufficient scope')),
        404: createSchema(oauthErrorResponseSchema.describe('Not Found - User not found')),
        500: createSchema(oauthErrorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: [
      requireValidAccessToken(),
      requireOAuthScope('user:read')
    ]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // At this point, the user is authenticated via OAuth2 and has the required scope
      if (!request.tokenPayload) {
        fastify.log.error({
          operation: 'oauth2_userinfo',
          error: 'Missing token payload after validation'
        }, 'OAuth2 userinfo: Missing token payload');
        
        const errorResponse = {
          error: 'server_error',
          error_description: 'Internal authentication error'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      const userId = request.tokenPayload.user.id;
      const userEmail = request.tokenPayload.user.email;
      
      fastify.log.debug({
        operation: 'oauth2_userinfo',
        userId,
        userEmail,
        clientId: request.tokenPayload.clientId,
        scope: request.tokenPayload.scope
      }, `User ${userEmail} retrieving userinfo via OAuth2`);

      // Get full user data from database
      const user = await userService.getUserById(userId);
      
      if (!user) {
        fastify.log.warn({
          operation: 'oauth2_userinfo',
          userId,
          userEmail
        }, 'OAuth2 userinfo: User not found in database');
        
        const errorResponse = {
          error: 'invalid_token',
          error_description: 'User associated with token not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Build full name from first_name and last_name
      let fullName: string | undefined;
      if (user.first_name || user.last_name) {
        const parts = [];
        if (user.first_name) parts.push(user.first_name);
        if (user.last_name) parts.push(user.last_name);
        fullName = parts.join(' ');
      }

      // Create OAuth2 UserInfo response following RFC standards
      const userInfoResponse = {
        sub: String(user.id),                    // Subject identifier (required)
        email: String(user.email),               // Email address (required)
        preferred_username: String(user.username), // Username (required)
        email_verified: true,                    // Assume verified for now
        ...(fullName && { name: fullName }),     // Full name (optional)
        ...(user.first_name && { given_name: String(user.first_name) }), // First name (optional)
        ...(user.last_name && { family_name: String(user.last_name) })   // Last name (optional)
      };

      fastify.log.info({
        operation: 'oauth2_userinfo',
        userId,
        userEmail,
        clientId: request.tokenPayload.clientId,
        responseFields: Object.keys(userInfoResponse)
      }, `OAuth2 userinfo retrieved successfully for user ${userEmail}`);

      const jsonString = JSON.stringify(userInfoResponse);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      fastify.log.error({
        operation: 'oauth2_userinfo',
        error,
        userId: request.tokenPayload?.user.id,
        userEmail: request.tokenPayload?.user.email
      }, 'OAuth2 userinfo: Unexpected error');
      
      const errorResponse = {
        error: 'server_error',
        error_description: 'An error occurred while retrieving user information'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
