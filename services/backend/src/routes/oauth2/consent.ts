import { type FastifyInstance } from 'fastify';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import {
  REQUEST_ID_SCHEMA,
  CONSENT_ACTION_SCHEMA,
  API_ERROR_RESPONSE_SCHEMA,
  OAUTH2_SCOPE_DESCRIPTIONS,
  OAUTH2_CLIENT_NAMES,
  type ApiErrorResponse
} from './schemas';

// Reusable Schema Constants
const CONSENT_DETAILS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    request_id: REQUEST_ID_SCHEMA
  },
  required: ['request_id'],
  additionalProperties: false
} as const;

const CONSENT_DETAILS_RESPONSE_SCHEMA = {
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
    client_id: {
      type: 'string',
      description: 'OAuth2 client identifier'
    },
    client_name: {
      type: 'string',
      description: 'Human-readable client name'
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
  required: ['success', 'request_id', 'client_id', 'client_name', 'user_email', 'scopes', 'expires_at']
} as const;

const CONSENT_BODY_SCHEMA = {
  type: 'object',
  properties: {
    request_id: REQUEST_ID_SCHEMA,
    action: CONSENT_ACTION_SCHEMA
  },
  required: ['request_id', 'action'],
  additionalProperties: false
} as const;

const CONSENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the consent was processed successfully'
    },
    redirect_url: {
      type: 'string',
      description: 'URL to redirect to after consent'
    }
  },
  required: ['success']
} as const;

// TypeScript interfaces
interface ConsentDetailsQuery {
  request_id: string;
}

interface ConsentDetailsResponse {
  success: boolean;
  request_id: string;
  client_id: string;
  client_name: string;
  user_email: string;
  scopes: {
    name: string;
    description: string;
  }[];
  expires_at: string;
}

interface ConsentBody {
  request_id: string;
  action: 'approve' | 'deny';
}

interface ConsentResponse {
  success: boolean;
  redirect_url?: string;
}

export default async function consentRoute(server: FastifyInstance) {
  // GET /oauth2/consent/details - Get consent details as JSON for frontend
  server.get('/oauth2/consent/details', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Get OAuth2 Consent Details',
      description: 'Returns consent details as JSON for frontend to display consent page.',
      querystring: CONSENT_DETAILS_QUERY_SCHEMA,
      response: {
        200: {
          ...CONSENT_DETAILS_RESPONSE_SCHEMA,
          description: 'Consent details'
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
      const { request_id } = request.query as ConsentDetailsQuery;

      request.log.debug({
        operation: 'oauth2_consent_details',
        requestId: request_id,
      }, 'OAuth2 consent details requested');

      // Check if user is authenticated
      if (!request.user) {
        request.log.warn({
          operation: 'oauth2_consent_details',
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
          operation: 'oauth2_consent_details',
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
          operation: 'oauth2_consent_details',
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

      const response: ConsentDetailsResponse = {
        success: true,
        request_id: request_id,
        client_id: authRequest.clientId,
        client_name: OAUTH2_CLIENT_NAMES[authRequest.clientId] || authRequest.clientId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user_email: (request.user as any).email,
        scopes: scopesWithDescriptions,
        expires_at: authRequest.expiresAt.toISOString()
      };

      request.log.debug({
        operation: 'oauth2_consent_details',
        requestId: request_id,
        userId: request.user.id,
        clientId: authRequest.clientId,
        scopes: scopes,
      }, 'OAuth2 consent details returned');

      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_consent_details',
        error,
      }, 'OAuth2 consent details error');

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'server_error',
        error_description: 'An error occurred retrieving consent details'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // POST /oauth2/consent - Process consent decision (JSON only)
  server.post('/oauth2/consent', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Process OAuth2 Consent',
      description: 'Processes user consent decision and returns redirect URL or error. Requires Content-Type: application/json header when sending request body.',
      
      // Fastify validation schema
      body: CONSENT_BODY_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: CONSENT_BODY_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...CONSENT_RESPONSE_SCHEMA,
          description: 'Consent processed successfully'
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
      const { request_id, action } = request.body as ConsentBody;

      request.log.debug({
        operation: 'oauth2_consent_process',
        requestId: request_id,
        action,
      }, 'OAuth2 consent decision received');

      // Check if user is authenticated
      if (!request.user) {
        request.log.warn({
          operation: 'oauth2_consent_process',
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
          operation: 'oauth2_consent_process',
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
          operation: 'oauth2_consent_process',
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

      if (action === 'deny') {
        request.log.info({
          operation: 'oauth2_consent_process',
          requestId: request_id,
          userId: request.user.id,
          action: 'denied',
        }, 'User denied OAuth2 authorization');

        const errorUrl = `${authRequest.redirectUri}?error=access_denied&error_description=${encodeURIComponent('User denied the authorization request')}&state=${authRequest.state}`;
        
        const response: ConsentResponse = {
          success: true,
          redirect_url: errorUrl
        };
        const jsonString = JSON.stringify(response);
        return reply.status(200).type('application/json').send(jsonString);
      }

      if (action === 'approve') {
        // Generate authorization code
        const code = await AuthorizationService.generateAuthorizationCode(request_id, request.log);
        
        if (!code) {
          request.log.error({
            operation: 'oauth2_consent_process',
            requestId: request_id,
            error: 'code_generation_failed',
          }, 'Failed to generate authorization code');

          const errorUrl = `${authRequest.redirectUri}?error=server_error&error_description=${encodeURIComponent('Failed to generate authorization code')}&state=${authRequest.state}`;
          
          const response: ConsentResponse = {
            success: true,
            redirect_url: errorUrl
          };
          const jsonString = JSON.stringify(response);
          return reply.status(200).type('application/json').send(jsonString);
        }

        request.log.info({
          operation: 'oauth2_consent_process',
          requestId: request_id,
          userId: request.user.id,
          clientId: authRequest.clientId,
          action: 'approved',
        }, 'User approved OAuth2 authorization');

        // Return success URL with authorization code
        const successUrl = `${authRequest.redirectUri}?code=${code}&state=${authRequest.state}`;
        
        const response: ConsentResponse = {
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
        operation: 'oauth2_consent_process',
        error,
      }, 'OAuth2 consent processing error');

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'server_error',
        error_description: 'An error occurred processing the consent'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
