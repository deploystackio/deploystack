import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireValidAccessToken, requireOAuthScope } from '../../middleware/oauthMiddleware';
import { UserService } from '../../services/userService';
import {
  USER_SUBJECT_SCHEMA,
  USER_EMAIL_SCHEMA,
  USER_NAME_SCHEMA,
  USERNAME_SCHEMA,
  EMAIL_VERIFIED_SCHEMA,
  GIVEN_NAME_SCHEMA,
  FAMILY_NAME_SCHEMA,
  OAUTH2_ERROR_RESPONSE_SCHEMA,
  type OAuth2ErrorResponse
} from './schemas';

// Reusable Schema Constants
const USERINFO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sub: USER_SUBJECT_SCHEMA,
    email: USER_EMAIL_SCHEMA,
    name: USER_NAME_SCHEMA,
    preferred_username: USERNAME_SCHEMA,
    email_verified: EMAIL_VERIFIED_SCHEMA,
    given_name: GIVEN_NAME_SCHEMA,
    family_name: FAMILY_NAME_SCHEMA
  },
  required: ['sub', 'email', 'preferred_username', 'email_verified']
} as const;

// TypeScript interfaces
interface UserInfoResponse {
  sub: string;
  email: string;
  preferred_username: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
}


export default async function userinfoRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /oauth2/userinfo - Standard OAuth2 UserInfo endpoint
  server.get('/oauth2/userinfo', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Get user information',
      description: 'Returns user information for the authenticated user. This is the standard OAuth2/OpenID Connect UserInfo endpoint. Requires a valid OAuth2 access token with user:read scope.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          ...USERINFO_RESPONSE_SCHEMA,
          description: 'User information retrieved successfully'
        },
        401: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid or missing access token'
        },
        403: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient scope'
        },
        404: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - User not found'
        },
        500: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
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
        server.log.error({
          operation: 'oauth2_userinfo',
          error: 'Missing token payload after validation'
        }, 'OAuth2 userinfo: Missing token payload');
        
        const errorResponse: OAuth2ErrorResponse = {
          error: 'server_error',
          error_description: 'Internal authentication error'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      const userId = request.tokenPayload.user.id;
      const userEmail = request.tokenPayload.user.email;
      
      server.log.debug({
        operation: 'oauth2_userinfo',
        userId,
        userEmail,
        clientId: request.tokenPayload.clientId,
        scope: request.tokenPayload.scope
      }, `User ${userEmail} retrieving userinfo via OAuth2`);

      // Get full user data from database
      const user = await userService.getUserById(userId);
      
      if (!user) {
        server.log.warn({
          operation: 'oauth2_userinfo',
          userId,
          userEmail
        }, 'OAuth2 userinfo: User not found in database');
        
        const errorResponse: OAuth2ErrorResponse = {
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
      const userInfoResponse: UserInfoResponse = {
        sub: String(user.id),                    // Subject identifier (required)
        email: String(user.email),               // Email address (required)
        preferred_username: String(user.username), // Username (required)
        email_verified: true,                    // Assume verified for now
        ...(fullName && { name: fullName }),     // Full name (optional)
        ...(user.first_name && { given_name: String(user.first_name) }), // First name (optional)
        ...(user.last_name && { family_name: String(user.last_name) })   // Last name (optional)
      };

      server.log.info({
        operation: 'oauth2_userinfo',
        userId,
        userEmail,
        clientId: request.tokenPayload.clientId,
        responseFields: Object.keys(userInfoResponse)
      }, `OAuth2 userinfo retrieved successfully for user ${userEmail}`);

      const jsonString = JSON.stringify(userInfoResponse);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      server.log.error({
        operation: 'oauth2_userinfo',
        error,
        userId: request.tokenPayload?.user.id,
        userEmail: request.tokenPayload?.user.email
      }, 'OAuth2 userinfo: Unexpected error');
      
      const errorResponse: OAuth2ErrorResponse = {
        error: 'server_error',
        error_description: 'An error occurred while retrieving user information'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
