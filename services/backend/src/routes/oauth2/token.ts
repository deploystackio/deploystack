import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import { TokenService } from '../../services/oauth/tokenService';

const tokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code').describe('OAuth2 grant type, must be "authorization_code"'),
  code: z.string().min(1).describe('Authorization code received from authorization endpoint'),
  redirect_uri: z.string().url().describe('OAuth2 redirect URI, must match the one used in authorization'),
  client_id: z.string().min(1).describe('OAuth2 client identifier'),
  code_verifier: z.string().min(1).describe('PKCE code verifier')
});

const refreshTokenRequestSchema = z.object({
  grant_type: z.literal('refresh_token').describe('OAuth2 grant type, must be "refresh_token"'),
  refresh_token: z.string().min(1).describe('Refresh token to exchange for new access token'),
  client_id: z.string().min(1).describe('OAuth2 client identifier')
});

const tokenRequestBodySchema = z.union([tokenRequestSchema, refreshTokenRequestSchema]);

const tokenResponseSchema = z.object({
  access_token: z.string().describe('OAuth2 access token'),
  token_type: z.literal('Bearer').describe('Token type, always "Bearer"'),
  expires_in: z.number().describe('Access token lifetime in seconds'),
  refresh_token: z.string().describe('Refresh token for obtaining new access tokens'),
  scope: z.string().describe('Space-separated list of granted scopes')
});

const errorResponseSchema = z.object({
  error: z.string().describe('OAuth2 error code'),
  error_description: z.string().describe('Human-readable error description')
});

export default async function tokenRoute(fastify: FastifyInstance) {
  fastify.post('/oauth2/token', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Token Endpoint',
      description: 'Exchanges authorization code for access token using PKCE, or refreshes access token using refresh token.',
      body: createSchema(tokenRequestBodySchema),
      response: {
        200: createSchema(tokenResponseSchema.describe('Successful token response')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid parameters')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Invalid client or credentials'))
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as z.infer<typeof tokenRequestBodySchema>;

      request.log.debug({
        operation: 'oauth2_token',
        grantType: body.grant_type,
        clientId: body.client_id,
      }, 'OAuth2 token request received');

      // Handle authorization_code grant
      if (body.grant_type === 'authorization_code') {
        const { code, redirect_uri, client_id, code_verifier } = body;

        // Validate client
        if (!AuthorizationService.validateClient(client_id)) {
          request.log.warn({
            operation: 'oauth2_token',
            clientId: client_id,
            error: 'invalid_client',
          }, 'Invalid OAuth2 client');

          const errorResponse = {
            error: 'invalid_client',
            error_description: 'Invalid client identifier'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(401).type('application/json').send(jsonString);
        }

        // Verify authorization code and PKCE
        const authCode = await AuthorizationService.verifyAuthorizationCode(
          code,
          code_verifier,
          client_id,
          redirect_uri,
          request.log
        );

        if (!authCode) {
          request.log.warn({
            operation: 'oauth2_token',
            clientId: client_id,
            code: code.substring(0, 8) + '...',
            error: 'invalid_grant',
          }, 'Invalid authorization code or PKCE verification failed');

          const errorResponse = {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code or PKCE verification failed'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Generate tokens
        const accessToken = await TokenService.generateAccessToken(
          authCode.userId,
          authCode.scope,
          client_id,
          request.log
        );

        const refreshToken = await TokenService.generateRefreshToken(
          authCode.userId,
          client_id,
          request.log
        );

        request.log.info({
          operation: 'oauth2_token',
          userId: authCode.userId,
          clientId: client_id,
          scope: authCode.scope,
        }, 'OAuth2 tokens generated successfully');

        const tokenResponse = {
          access_token: accessToken,
          token_type: 'Bearer' as const,
          expires_in: 7 * 24 * 3600, // 1 week
          refresh_token: refreshToken,
          scope: authCode.scope
        };

        const jsonString = JSON.stringify(tokenResponse);
        return reply.status(200).type('application/json').send(jsonString);
      }

      // Handle refresh_token grant
      if (body.grant_type === 'refresh_token') {
        const { refresh_token, client_id } = body;

        // Validate client
        if (!AuthorizationService.validateClient(client_id)) {
          request.log.warn({
            operation: 'oauth2_token_refresh',
            clientId: client_id,
            error: 'invalid_client',
          }, 'Invalid OAuth2 client');

          const errorResponse = {
            error: 'invalid_client',
            error_description: 'Invalid client identifier'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(401).type('application/json').send(jsonString);
        }

        // Refresh tokens
        const tokenResponse = await TokenService.refreshAccessToken(
          refresh_token,
          client_id,
          request.log
        );

        if (!tokenResponse) {
          request.log.warn({
            operation: 'oauth2_token_refresh',
            clientId: client_id,
            error: 'invalid_grant',
          }, 'Invalid or expired refresh token');

          const errorResponse = {
            error: 'invalid_grant',
            error_description: 'Invalid or expired refresh token'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        request.log.info({
          operation: 'oauth2_token_refresh',
          clientId: client_id,
        }, 'OAuth2 tokens refreshed successfully');

        const jsonString = JSON.stringify(tokenResponse);
        return reply.status(200).type('application/json').send(jsonString);
      }

      // Should not reach here due to Zod validation
      const errorResponse = {
        error: 'unsupported_grant_type',
        error_description: 'Unsupported grant type'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_token',
        error,
      }, 'OAuth2 token error');

      const errorResponse = {
        error: 'server_error',
        error_description: 'An error occurred processing the token request'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
