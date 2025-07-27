import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { AuthorizationService } from '../../services/oauth/authorizationService';

const consentDetailsQuerySchema = z.object({
  request_id: z.string().min(1).describe('Authorization request ID')
});

const consentDetailsResponseSchema = z.object({
  success: z.boolean().describe('Whether the request was found'),
  request_id: z.string().describe('Authorization request ID'),
  client_id: z.string().describe('OAuth2 client identifier'),
  client_name: z.string().describe('Human-readable client name'),
  user_email: z.string().describe('Email of the authenticated user'),
  scopes: z.array(z.object({
    name: z.string().describe('Scope name'),
    description: z.string().describe('Human-readable scope description')
  })).describe('Requested scopes with descriptions'),
  expires_at: z.string().describe('When the authorization request expires (ISO string)')
});

const consentBodySchema = z.object({
  request_id: z.string().min(1).describe('Authorization request ID'),
  action: z.enum(['approve', 'deny']).describe('User consent decision')
});

const consentResponseSchema = z.object({
  success: z.boolean().describe('Whether the consent was processed successfully'),
  redirect_url: z.string().optional().describe('URL to redirect to after consent')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Always false for errors'),
  error: z.string().describe('OAuth2 error code'),
  error_description: z.string().describe('Human-readable error description')
});

export default async function consentRoute(fastify: FastifyInstance) {
  // GET /oauth2/consent/details - Get consent details as JSON for frontend
  fastify.get('/oauth2/consent/details', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Get OAuth2 Consent Details',
      description: 'Returns consent details as JSON for frontend to display consent page.',
      querystring: createSchema(consentDetailsQuerySchema),
      response: {
        200: createSchema(consentDetailsResponseSchema.describe('Consent details')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid request ID')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - User not authenticated')),
        403: createSchema(errorResponseSchema.describe('Forbidden - User mismatch')),
        404: createSchema(errorResponseSchema.describe('Not Found - Request not found or expired'))
      }
    }
  }, async (request, reply) => {
    try {
      const { request_id } = request.query as z.infer<typeof consentDetailsQuerySchema>;

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

        return reply.status(401).send({
          success: false,
          error: 'unauthorized',
          error_description: 'User authentication required'
        });
      }

      // Get authorization request
      const authRequest = await AuthorizationService.getAuthorizationRequest(request_id, request.log);
      
      if (!authRequest) {
        request.log.warn({
          operation: 'oauth2_consent_details',
          requestId: request_id,
          error: 'request_not_found',
        }, 'Authorization request not found or expired');

        return reply.status(404).send({
          success: false,
          error: 'invalid_request',
          error_description: 'Authorization request not found or expired'
        });
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

        return reply.status(403).send({
          success: false,
          error: 'access_denied',
          error_description: 'User authentication mismatch'
        });
      }

      // Parse scopes and add descriptions
      const scopes = authRequest.scope.split(' ');
      const scopeDescriptions: Record<string, string> = {
        'mcp:read': 'Access your MCP server installations and configurations',
        'account:read': 'Read your account information',
        'user:read': 'Read your user profile information',
        'teams:read': 'Read your team memberships and team information',
        'offline_access': 'Maintain access when you\'re not actively using the application'
      };

      const scopesWithDescriptions = scopes.map(scope => ({
        name: scope,
        description: scopeDescriptions[scope] || scope
      }));

      // Client name mapping
      const clientNames: Record<string, string> = {
        'deploystack-gateway-cli': 'DeployStack Gateway CLI'
      };

      const response = {
        success: true,
        request_id: request_id,
        client_id: authRequest.clientId,
        client_name: clientNames[authRequest.clientId] || authRequest.clientId,
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

      return reply.send(response);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_consent_details',
        error,
      }, 'OAuth2 consent details error');

      return reply.status(500).send({
        success: false,
        error: 'server_error',
        error_description: 'An error occurred retrieving consent details'
      });
    }
  });

  // POST /oauth2/consent - Process consent decision (JSON only)
  fastify.post('/oauth2/consent', {
    schema: {
      tags: ['OAuth2'],
      summary: 'Process OAuth2 Consent',
      description: 'Processes user consent decision and returns redirect URL or error.',
      body: createSchema(consentBodySchema),
      response: {
        200: createSchema(consentResponseSchema.describe('Consent processed successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid parameters')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - User not authenticated')),
        403: createSchema(errorResponseSchema.describe('Forbidden - User mismatch')),
        404: createSchema(errorResponseSchema.describe('Not Found - Request not found or expired'))
      }
    }
  }, async (request, reply) => {
    try {
      const { request_id, action } = request.body as z.infer<typeof consentBodySchema>;

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

        return reply.status(401).send({
          success: false,
          error: 'unauthorized',
          error_description: 'User authentication required'
        });
      }

      // Get authorization request
      const authRequest = await AuthorizationService.getAuthorizationRequest(request_id, request.log);
      
      if (!authRequest) {
        request.log.warn({
          operation: 'oauth2_consent_process',
          requestId: request_id,
          error: 'request_not_found',
        }, 'Authorization request not found or expired');

        return reply.status(404).send({
          success: false,
          error: 'invalid_request',
          error_description: 'Authorization request not found or expired'
        });
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

        return reply.status(403).send({
          success: false,
          error: 'access_denied',
          error_description: 'User authentication mismatch'
        });
      }

      if (action === 'deny') {
        request.log.info({
          operation: 'oauth2_consent_process',
          requestId: request_id,
          userId: request.user.id,
          action: 'denied',
        }, 'User denied OAuth2 authorization');

        const errorUrl = `${authRequest.redirectUri}?error=access_denied&error_description=${encodeURIComponent('User denied the authorization request')}&state=${authRequest.state}`;
        
        return reply.send({
          success: true,
          redirect_url: errorUrl
        });
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
          
          return reply.send({
            success: true,
            redirect_url: errorUrl
          });
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
        
        return reply.send({
          success: true,
          redirect_url: successUrl
        });
      }

      // Should not reach here due to Zod validation
      return reply.status(400).send({
        success: false,
        error: 'invalid_request',
        error_description: 'Invalid action'
      });

    } catch (error) {
      request.log.error({
        operation: 'oauth2_consent_process',
        error,
      }, 'OAuth2 consent processing error');

      return reply.status(500).send({
        success: false,
        error: 'server_error',
        error_description: 'An error occurred processing the consent'
      });
    }
  });
}
