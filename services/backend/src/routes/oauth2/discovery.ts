import { type FastifyInstance } from 'fastify';
import { GlobalSettingsInitService } from '../../global-settings';

export default async function discoveryRoute(server: FastifyInstance) {
  server.get('/.well-known/oauth-authorization-server', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Authorization Server Metadata',
      description: 'RFC 8414 compliant OAuth2 authorization server metadata for MCP client discovery',
      response: {
        200: {
          type: 'object',
          properties: {
            issuer: { type: 'string' },
            authorization_endpoint: { type: 'string' },
            token_endpoint: { type: 'string' },
            userinfo_endpoint: { type: 'string' },
            introspection_endpoint: { type: 'string' },
            scopes_supported: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            response_types_supported: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            grant_types_supported: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            code_challenge_methods_supported: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            registration_endpoint: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            error_description: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Get backend URL dynamically
      const backendUrl = await GlobalSettingsInitService.getBackendUrl();
      
      // OAuth2 Authorization Server Metadata (RFC 8414)
      const metadata = {
        issuer: backendUrl,
        authorization_endpoint: `${backendUrl}/api/oauth2/auth`,
        token_endpoint: `${backendUrl}/api/oauth2/token`,
        userinfo_endpoint: `${backendUrl}/api/oauth2/userinfo`,
        introspection_endpoint: `${backendUrl}/api/oauth2/introspect`,
        scopes_supported: [
          'mcp:read',           // Tool discovery within team
          'mcp:tools:execute',  // Tool execution within team
          'offline_access'      // Refresh tokens
        ],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'], // Public clients (PKCE)
        
        // RFC 7591 Dynamic Client Registration
        registration_endpoint: `${backendUrl}/api/oauth2/register`
      };

      request.log.debug({
        operation: 'oauth2_discovery',
        backendUrl,
        registration_endpoint: metadata.registration_endpoint,
      }, 'OAuth2 discovery metadata requested');

      const jsonString = JSON.stringify(metadata);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_discovery',
        error,
      }, 'OAuth2 discovery error');

      const errorResponse = {
        error: 'server_error',
        error_description: 'Failed to retrieve OAuth2 authorization server metadata'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
