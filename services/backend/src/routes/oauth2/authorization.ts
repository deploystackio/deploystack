import { type FastifyInstance } from 'fastify';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import { GlobalSettingsInitService } from '../../global-settings';
import {
  RESPONSE_TYPE_SCHEMA,
  CLIENT_ID_SCHEMA,
  REDIRECT_URI_SCHEMA,
  SCOPE_SCHEMA,
  STATE_SCHEMA,
  CODE_CHALLENGE_SCHEMA,
  CODE_CHALLENGE_METHOD_SCHEMA,
  OAUTH2_ERROR_RESPONSE_SCHEMA,
  type OAuth2ErrorResponse
} from './schemas';

// Reusable Schema Constants
const AUTHORIZATION_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    response_type: {
      ...RESPONSE_TYPE_SCHEMA,
      description: 'OAuth2 response type, must be "code"'
    },
    client_id: {
      ...CLIENT_ID_SCHEMA,
      description: 'OAuth2 client identifier'
    },
    redirect_uri: {
      ...REDIRECT_URI_SCHEMA,
      description: 'OAuth2 redirect URI for callback'
    },
    scope: {
      ...SCOPE_SCHEMA,
      description: 'Space-separated list of requested scopes'
    },
    state: STATE_SCHEMA,
    code_challenge: CODE_CHALLENGE_SCHEMA,
    code_challenge_method: CODE_CHALLENGE_METHOD_SCHEMA
  },
  required: ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method'],
  additionalProperties: false
} as const;

// TypeScript interfaces
interface AuthorizationQuery {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: 'S256';
}

export default async function authorizationRoute(server: FastifyInstance) {
  server.get('/oauth2/auth', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Authorization Endpoint',
      description: 'Initiates OAuth2 authorization flow with PKCE. Validates client credentials and redirects to consent page for user authorization.',
      querystring: AUTHORIZATION_QUERY_SCHEMA,
      response: {
        302: {
          type: 'string',
          description: 'Redirect to consent page or error redirect'
        },
        400: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid parameters'
        },
        500: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
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
      } = request.query as AuthorizationQuery;

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

        const errorResponse: OAuth2ErrorResponse = {
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

      const errorResponse: OAuth2ErrorResponse = {
        error: 'server_error',
        error_description: 'An error occurred processing the authorization request'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
