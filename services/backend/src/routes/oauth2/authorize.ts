import { type FastifyInstance } from 'fastify';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import {
  REQUEST_ID_SCHEMA,
  CONSENT_ACTION_SCHEMA,
  API_ERROR_RESPONSE_SCHEMA,
  OAUTH2_SCOPE_DESCRIPTIONS,
  type ApiErrorResponse
} from './schemas';

// Schema for authorize details response (no client_id exposed to user)
const AUTHORIZE_DETAILS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    request_id: REQUEST_ID_SCHEMA
  },
  required: ['request_id'],
  additionalProperties: false
} as const;

const AUTHORIZE_DETAILS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the request was found'
    },
    request_id: {
      type: 'string',
      description: 'Authorization request ID'
    },
    user_email: {
      type: 'string',
      description: 'Email of the authenticated user'
    },
    scopes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Scope name'
          },
          description: {
            type: 'string',
            description: 'Human-readable scope description'
          }
        },
        required: ['name', 'description']
      },
      description: 'Requested scopes with descriptions'
    },
    expires_at: {
      type: 'string',
      description: 'When the authorization request expires (ISO string)'
    }
  },
  required: ['success', 'request_id', 'user_email', 'scopes', 'expires_at']
} as const;

const AUTHORIZE_BODY_SCHEMA = {
  type: 'object',
  properties: {
    request_id: REQUEST_ID_SCHEMA,
    team_id: {
      type: 'string',
      description: 'Selected team ID'
    },
    action: CONSENT_ACTION_SCHEMA
  },
  required: ['request_id', 'team_id', 'action'],
  additionalProperties: false
} as const;

const AUTHORIZE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the authorization was processed successfully'
    },
    redirect_url: {
      type: 'string',
      description: 'URL to redirect to after authorization'
    }
  },
  required: ['success']
} as const;

// TypeScript interfaces
interface AuthorizeDetailsQuery {
  request_id: string;
}

interface AuthorizeDetailsResponse {
  success: boolean;
  request_id: string;
  user_email: string;
  scopes: {
    name: string;
    description: string;
  }[];
  expires_at: string;
}

interface AuthorizeBody {
  request_id: string;
  team_id: string;
  action: 'approve' | 'deny';
}

interface AuthorizeResponse {
  success: boolean;
  redirect_url?: string;
}

export default async function authorizeRoute(server: FastifyInstance) {
  // GET /oauth2/authorize/details - Get authorization details for frontend
  server.get('/oauth2/authorize/details', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Get OAuth2 Authorization Details',
      description: 'Returns authorization details as JSON for frontend to display team selection and consent page.',
      security: [{ cookieAuth: [] }],
      querystring: AUTHORIZE_DETAILS_QUERY_SCHEMA,
      response: {
        200: {
          ...AUTHORIZE_DETAILS_RESPONSE_SCHEMA,
          description: 'Authorization details'
        },
        400: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid request ID'
        },
        401: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - User not authenticated'
        },
        403: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - User mismatch'
        },
        404: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Request not found or expired'
        },
        500: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { request_id } = request.query as AuthorizeDetailsQuery;

      request.log.debug({
        operation: 'oauth2_authorize_details',
        requestId: request_id,
      }, 'OAuth2 authorize details requested');

      // Check if user is authenticated
      if (!request.user) {
        request.log.warn({
          operation: 'oauth2_authorize_details',
          requestId: request_id,
          error: 'user_not_authenticated',
        }, 'User not authenticated');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'unauthorized',
          error_description: 'User authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // Get authorization request
      const authRequest = await AuthorizationService.getAuthorizationRequest(request_id, request.log);

      if (!authRequest) {
        request.log.warn({
          operation: 'oauth2_authorize_details',
          requestId: request_id,
          error: 'request_not_found',
        }, 'Authorization request not found or expired');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'invalid_request',
          error_description: 'Authorization request not found or expired'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user matches the request
      if (request.user.id !== authRequest.userId) {
        request.log.warn({
          operation: 'oauth2_authorize_details',
          requestId: request_id,
          userId: request.user.id,
          expectedUserId: authRequest.userId,
          error: 'user_mismatch',
        }, 'User mismatch for authorization request');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'access_denied',
          error_description: 'User authentication mismatch'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Parse scopes and add descriptions
      const scopes = authRequest.scope.split(' ');
      const scopesWithDescriptions = scopes.map(scope => ({
        name: scope,
        description: OAUTH2_SCOPE_DESCRIPTIONS[scope] || scope
      }));

      const response: AuthorizeDetailsResponse = {
        success: true,
        request_id: request_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user_email: (request.user as any).email,
        scopes: scopesWithDescriptions,
        expires_at: authRequest.expiresAt.toISOString()
      };

      request.log.debug({
        operation: 'oauth2_authorize_details',
        requestId: request_id,
        userId: request.user.id,
        scopes: scopes,
      }, 'OAuth2 authorize details returned');

      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_authorize_details',
        error,
      }, 'OAuth2 authorize details error');

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'server_error',
        error_description: 'An error occurred retrieving authorization details'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // POST /oauth2/authorize - Process authorization with team selection
  server.post('/oauth2/authorize', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Process OAuth2 Authorization',
      description: 'Processes user authorization decision with team selection and returns redirect URL. Requires Content-Type: application/json header.',
      security: [{ cookieAuth: [] }],
      body: AUTHORIZE_BODY_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: AUTHORIZE_BODY_SCHEMA
          }
        }
      },
      response: {
        200: {
          ...AUTHORIZE_RESPONSE_SCHEMA,
          description: 'Authorization processed successfully'
        },
        400: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid parameters'
        },
        401: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - User not authenticated'
        },
        403: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - User mismatch or invalid team access'
        },
        404: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Request not found or expired'
        },
        500: {
          ...API_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { request_id, team_id, action } = request.body as AuthorizeBody;

      request.log.debug({
        operation: 'oauth2_authorize_process',
        requestId: request_id,
        teamId: team_id,
        action,
      }, 'OAuth2 authorization decision received');

      // Check if user is authenticated
      if (!request.user) {
        request.log.warn({
          operation: 'oauth2_authorize_process',
          requestId: request_id,
          error: 'user_not_authenticated',
        }, 'User not authenticated');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'unauthorized',
          error_description: 'User authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // Get authorization request
      const authRequest = await AuthorizationService.getAuthorizationRequest(request_id, request.log);

      if (!authRequest) {
        request.log.warn({
          operation: 'oauth2_authorize_process',
          requestId: request_id,
          error: 'request_not_found',
        }, 'Authorization request not found or expired');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'invalid_request',
          error_description: 'Authorization request not found or expired'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user matches the request
      if (request.user.id !== authRequest.userId) {
        request.log.warn({
          operation: 'oauth2_authorize_process',
          requestId: request_id,
          userId: request.user.id,
          expectedUserId: authRequest.userId,
          error: 'user_mismatch',
        }, 'User mismatch for authorization request');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'access_denied',
          error_description: 'User authentication mismatch'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Validate team access
      const hasTeamAccess = await AuthorizationService.validateTeamAccess(request.user.id, team_id, request.log);
      if (!hasTeamAccess) {
        request.log.warn({
          operation: 'oauth2_authorize_process',
          requestId: request_id,
          userId: request.user.id,
          teamId: team_id,
          error: 'invalid_team_access',
        }, 'User does not have access to selected team');

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'access_denied',
          error_description: 'You do not have access to the selected team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      if (action === 'deny') {
        request.log.info({
          operation: 'oauth2_authorize_process',
          requestId: request_id,
          userId: request.user.id,
          action: 'denied',
        }, 'User denied OAuth2 authorization');

        const errorUrl = `${authRequest.redirectUri}?error=access_denied&error_description=${encodeURIComponent('User denied the authorization request')}&state=${authRequest.state}`;

        const response: AuthorizeResponse = {
          success: true,
          redirect_url: errorUrl
        };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);
      }

      if (action === 'approve') {
        // Update the team_id on the authorization request
        await AuthorizationService.updateAuthorizationRequestTeam(request_id, team_id, request.log);

        // Generate authorization code
        const code = await AuthorizationService.generateAuthorizationCode(request_id, request.log);

        if (!code) {
          request.log.error({
            operation: 'oauth2_authorize_process',
            requestId: request_id,
            error: 'code_generation_failed',
          }, 'Failed to generate authorization code');

          const errorUrl = `${authRequest.redirectUri}?error=server_error&error_description=${encodeURIComponent('Failed to generate authorization code')}&state=${authRequest.state}`;

          const response: AuthorizeResponse = {
            success: true,
            redirect_url: errorUrl
          };
          const jsonString = JSON.stringify(response);
          return reply.status(200).type('application/json').send(jsonString);
        }

        request.log.info({
          operation: 'oauth2_authorize_process',
          requestId: request_id,
          userId: request.user.id,
          teamId: team_id,
          clientId: authRequest.clientId,
          action: 'approved',
        }, 'User approved OAuth2 authorization with team selection');

        // Return success URL with authorization code
        const successUrl = `${authRequest.redirectUri}?code=${code}&state=${authRequest.state}`;

        const response: AuthorizeResponse = {
          success: true,
          redirect_url: successUrl
        };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);
      }

      // Should not reach here due to schema validation
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'invalid_request',
        error_description: 'Invalid action'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_authorize_process',
        error,
      }, 'OAuth2 authorization processing error');

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'server_error',
        error_description: 'An error occurred processing the authorization'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
