/* eslint-disable @typescript-eslint/no-explicit-any */
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
    code_challenge_method: CODE_CHALLENGE_METHOD_SCHEMA,
    team: {
      type: 'string',
      description: 'Team ID for team-scoped OAuth flow (optional, defaults to user team)'
    }
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
  team?: string;
}

export default async function authorizationRoute(server: FastifyInstance) {
  // POST handler for team selection form submission
  server.post('/oauth2/auth', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Team Selection Submission',
      description: 'Processes team selection and generates authorization code',
      body: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          redirect_uri: { type: 'string' },
          scope: { type: 'string' },
          state: { type: 'string' },
          code_challenge: { type: 'string' },
          code_challenge_method: { type: 'string' },
          response_type: { type: 'string' },
          team_id: { type: 'string' },
          consent: { type: 'string', enum: ['true', 'false'] }
        },
        required: ['client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method', 'response_type', 'team_id', 'consent'],
        additionalProperties: false
      },
      response: {
        302: {
          type: 'string',
          description: 'Redirect to client callback or error redirect'
        },
        500: {
          type: 'string',
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, response_type, team_id, consent } = request.body as {
        client_id: string;
        redirect_uri: string;
        scope: string;
        state: string;
        code_challenge: string;
        code_challenge_method: string;
        response_type: string;
        team_id: string;
        consent: string;
      };

      // Check user authentication
      if (!request.user) {
        const errorUrl = `${redirect_uri}?error=access_denied&error_description=${encodeURIComponent('User not authenticated')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      if (consent !== 'true') {
        // User denied consent
        const errorUrl = `${redirect_uri}?error=access_denied&error_description=${encodeURIComponent('User denied authorization')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Debug logging for client validation
      request.log.debug({
        operation: 'oauth2_post_validation',
        client_id,
        isDynamicClient: client_id.startsWith('dyn_'),
        hasIsClientRegistered: typeof (server as any).isClientRegistered === 'function',
      }, 'Starting POST handler validation');

      // Validate client first
      const isValidClient = await AuthorizationService.validateClient(client_id, request.log);
      request.log.debug({
        operation: 'oauth2_post_validation',
        client_id,
        isValidClient,
      }, 'Client validation result');

      // Validate other parameters
      const isValidRedirectUri = await AuthorizationService.validateRedirectUri(redirect_uri, client_id, request.log);
      const isValidScope = AuthorizationService.validateScope(scope);
      const isValidResponseType = response_type === 'code';

      request.log.debug({
        operation: 'oauth2_post_validation',
        isValidClient,
        isValidRedirectUri,
        isValidScope,
        isValidResponseType,
      }, 'All validation results');

      // Check if any validation failed
      if (!isValidClient || !isValidRedirectUri || !isValidScope || !isValidResponseType) {
        request.log.warn({
          operation: 'oauth2_post_validation',
          client_id,
          isValidClient,
          isValidRedirectUri,
          isValidScope,
          isValidResponseType,
        }, 'OAuth parameter validation failed');

        const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent('Invalid OAuth parameters')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Validate team access
      if (!await AuthorizationService.validateTeamAccess(request.user.id, team_id)) {
        const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent('Invalid team selection')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Store authorization request and generate code
      const requestId = await AuthorizationService.storeAuthorizationRequest(
        request.user.id,
        team_id,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        request.log
      );

      const code = await AuthorizationService.generateAuthorizationCode(requestId, request.log);

      if (!code) {
        const errorUrl = `${redirect_uri}?error=server_error&error_description=${encodeURIComponent('Failed to generate authorization code')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      request.log.debug({
        operation: 'oauth2_team_selection',
        clientId: client_id,
        userId: request.user.id,
        teamId: team_id,
        requestId,
      }, 'Team selection processed, authorization code generated');

      // Redirect back to MCP client with authorization code
      const callbackUrl = `${redirect_uri}?code=${code}&state=${encodeURIComponent(state)}`;
      return reply.redirect(callbackUrl);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_team_selection',
        error,
      }, 'OAuth2 team selection error');

      // Try to redirect with error, fallback to generic error if redirect_uri is not available
      const redirectUri = (request.body as any)?.redirect_uri;
      const state = (request.body as any)?.state;
      
      if (redirectUri) {
        const errorUrl = `${redirectUri}?error=server_error&error_description=${encodeURIComponent('An error occurred processing the authorization request')}&state=${state || ''}`;
        return reply.redirect(errorUrl);
      } else {
        return reply.status(500).send('OAuth2 authorization error');
      }
    }
  });

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
        code_challenge_method,
        team
      } = request.query as AuthorizationQuery;

      // Check if user is authenticated first
      if (!request.user) {
        request.log.debug({
          operation: 'oauth2_authorization',
          clientId: client_id,
          error: 'user_not_authenticated',
        }, 'User not authenticated for OAuth authorization');

        // Build the full OAuth URL for return_to parameter using configured backend URL
        const backendUrl = await GlobalSettingsInitService.getBackendUrl();
        const fullOAuthUrl = `${backendUrl}${request.url}`;

        // Redirect to frontend login with return_to parameter
        const frontendUrl = await GlobalSettingsInitService.getPageUrl();
        const loginUrl = `${frontendUrl}/login?return_to=${encodeURIComponent(fullOAuthUrl)}`;

        request.log.debug({
          operation: 'oauth2_authorization',
          loginUrl,
          returnTo: fullOAuthUrl,
        }, 'Redirecting unauthenticated user to login');

        return reply.redirect(loginUrl);
      }

      // Team selection will happen in frontend Vue page
      if (!team) {
        // Validate client and redirect_uri before redirecting to frontend
        if (!await AuthorizationService.validateClient(client_id, request.log)) {
          request.log.warn({
            operation: 'oauth2_authorization',
            clientId: client_id,
            error: 'invalid_client',
          }, 'Invalid OAuth2 client');

          const errorUrl = `${redirect_uri}?error=invalid_client&error_description=${encodeURIComponent('Invalid client identifier')}&state=${state}`;
          return reply.redirect(errorUrl);
        }

        if (!await AuthorizationService.validateRedirectUri(redirect_uri, client_id, request.log)) {
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

        // Get user's teams to use default as placeholder
        const userTeams = await AuthorizationService.getUserTeams(request.user.id, request.log);

        if (userTeams.length === 0) {
          const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent('User has no teams configured')}&state=${state}`;
          return reply.redirect(errorUrl);
        }

        // Use default team or first team as placeholder (will be updated when user selects)
        const defaultTeam = userTeams.find(t => t.isDefault) || userTeams[0];

        // Store pending authorization request with placeholder team
        const requestId = await AuthorizationService.storeAuthorizationRequest(
          request.user.id,
          defaultTeam.id,
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
        }, 'Authorization request stored, redirecting to frontend authorize page');

        // Get frontend URL and redirect to frontend authorize page
        const frontendUrl = await GlobalSettingsInitService.getPageUrl();
        const authorizeUrl = `${frontendUrl}/oauth/authorize?request_id=${requestId}`;
        return reply.redirect(authorizeUrl);
      }
      
      const teamId = team;

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

      // Validate client_id (including dynamic registration support)
      if (!await AuthorizationService.validateClient(client_id, request.log)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          error: 'invalid_client',
        }, 'Invalid OAuth2 client');

        const errorUrl = `${redirect_uri}?error=invalid_client&error_description=${encodeURIComponent('Invalid client identifier')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Validate redirect_uri
      if (!await AuthorizationService.validateRedirectUri(redirect_uri, client_id, request.log)) {
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


      // Validate team access
      if (!await AuthorizationService.validateTeamAccess(request.user.id, teamId)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          userId: request.user.id,
          teamId: teamId,
          error: 'invalid_team',
        }, 'User not member of requested team');

        const errorUrl = `${redirect_uri}?error=invalid_team&error_description=${encodeURIComponent('User not member of requested team')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Store authorization request for consent page
      const requestId = await AuthorizationService.storeAuthorizationRequest(
        request.user.id,
        teamId,
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
