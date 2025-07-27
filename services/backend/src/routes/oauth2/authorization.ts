import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import { GlobalSettingsInitService } from '../../global-settings';

const authorizationQuerySchema = z.object({
  response_type: z.literal('code').describe('OAuth2 response type, must be "code"'),
  client_id: z.string().min(1).describe('OAuth2 client identifier'),
  redirect_uri: z.string().url().describe('OAuth2 redirect URI for callback'),
  scope: z.string().describe('Space-separated list of requested scopes'),
  state: z.string().min(1).describe('CSRF protection state parameter'),
  code_challenge: z.string().min(1).describe('PKCE code challenge'),
  code_challenge_method: z.literal('S256').describe('PKCE code challenge method, must be "S256"')
});

const errorResponseSchema = z.object({
  error: z.string().describe('OAuth2 error code'),
  error_description: z.string().describe('Human-readable error description')
});

export default async function authorizationRoute(fastify: FastifyInstance) {
  fastify.get('/oauth2/auth', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Authorization Endpoint',
      description: 'Initiates OAuth2 authorization flow with PKCE. Validates client credentials and redirects to consent page for user authorization.',
      querystring: createSchema(authorizationQuerySchema),
      response: {
        302: {
          type: 'string',
          description: 'Redirect to consent page or error redirect'
        },
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid parameters'))
      }
    }
  }, async (request, reply) => {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method
      } = request.query as z.infer<typeof authorizationQuerySchema>;

      // Validate response_type (additional validation beyond schema)
      if (response_type !== 'code') {
        request.log.warn({
          operation: 'oauth2_authorization',
          responseType: response_type,
          error: 'unsupported_response_type',
        }, 'Unsupported OAuth2 response type');

        const errorUrl = `${redirect_uri}?error=unsupported_response_type&error_description=${encodeURIComponent('Only "code" response type is supported')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      request.log.debug({
        operation: 'oauth2_authorization',
        clientId: client_id,
        redirectUri: redirect_uri,
        scope,
        responseType: response_type,
        codeChallengeMethod: code_challenge_method,
      }, 'OAuth2 authorization request received');

      // Validate client_id
      if (!AuthorizationService.validateClient(client_id)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          error: 'invalid_client',
        }, 'Invalid OAuth2 client');

        const errorUrl = `${redirect_uri}?error=invalid_client&error_description=${encodeURIComponent('Invalid client identifier')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Validate redirect_uri
      if (!AuthorizationService.validateRedirectUri(redirect_uri)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          redirectUri: redirect_uri,
          error: 'invalid_redirect_uri',
        }, 'Invalid OAuth2 redirect URI');

        const errorResponse = {
          error: 'invalid_request',
          error_description: 'Invalid redirect URI'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Validate scope
      if (!AuthorizationService.validateScope(scope)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          scope,
          error: 'invalid_scope',
        }, 'Invalid OAuth2 scope');

        const errorUrl = `${redirect_uri}?error=invalid_scope&error_description=${encodeURIComponent('Invalid or unsupported scope')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Check if user is authenticated
      if (!request.user) {
        request.log.debug({
          operation: 'oauth2_authorization',
          clientId: client_id,
          error: 'user_not_authenticated',
        }, 'User not authenticated, redirecting to login');

        // Redirect to login page with return URL
        const loginUrl = `/login?return_to=${encodeURIComponent(request.url)}`;
        return reply.redirect(loginUrl);
      }

      // Store authorization request for consent page
      const requestId = await AuthorizationService.storeAuthorizationRequest(
        request.user.id,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        request.log
      );

      request.log.debug({
        operation: 'oauth2_authorization',
        clientId: client_id,
        userId: request.user.id,
        requestId,
      }, 'Authorization request stored, redirecting to frontend consent');

      // Get frontend URL and redirect to frontend consent page
      const frontendUrl = await GlobalSettingsInitService.getPageUrl();
      const consentUrl = `${frontendUrl}/oauth/consent?request_id=${requestId}`;
      return reply.redirect(consentUrl);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_authorization',
        error,
      }, 'OAuth2 authorization error');

      const errorResponse = {
        error: 'server_error',
        error_description: 'An error occurred processing the authorization request'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
