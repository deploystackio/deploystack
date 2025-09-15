import { type FastifyInstance } from 'fastify';

/**
 * OAuth Discovery Routes
 * Implements RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata)
 * for MCP client OAuth discovery
 */
export default async function oauthDiscoveryRoutes(server: FastifyInstance) {
  const backendUrl = process.env.DEPLOYSTACK_BACKEND_URL || 'http://localhost:3000';
  const satelliteUrl = `http://localhost:${process.env.PORT || 3001}`;

  // RFC 9728: OAuth 2.0 Protected Resource Metadata
  server.get('/.well-known/oauth-protected-resource', {
    schema: {
      tags: ['OAuth Discovery'],
      summary: 'OAuth 2.0 Protected Resource Metadata',
      description: 'RFC 9728 compliant protected resource metadata for MCP client discovery',
      response: {
        200: {
          type: 'object',
          properties: {
            resource: { type: 'string' },
            authorization_servers: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const metadata = {
      resource: satelliteUrl,
      authorization_servers: [backendUrl]
    };

    server.log.debug({
      operation: 'oauth_protected_resource_metadata',
      resource: metadata.resource,
      authorization_servers: metadata.authorization_servers
    }, 'Serving OAuth 2.0 Protected Resource Metadata');

    const jsonString = JSON.stringify(metadata);
    return reply.status(200).type('application/json').send(jsonString);
  });

  // RFC 8414: OAuth 2.0 Authorization Server Metadata
  server.get('/.well-known/oauth-authorization-server', {
    schema: {
      tags: ['OAuth Discovery'],
      summary: 'OAuth 2.0 Authorization Server Metadata',
      description: 'RFC 8414 compliant authorization server metadata for MCP client discovery',
      response: {
        200: {
          type: 'object',
          properties: {
            issuer: { type: 'string' },
            authorization_endpoint: { type: 'string' },
            token_endpoint: { type: 'string' },
            introspection_endpoint: { type: 'string' },
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
            scopes_supported: {
              type: 'array',
              items: { type: 'string' }
            },
            registration_endpoint: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const metadata = {
      issuer: backendUrl,
      authorization_endpoint: `${backendUrl}/api/oauth2/auth`,
      token_endpoint: `${backendUrl}/api/oauth2/token`,
      introspection_endpoint: `${backendUrl}/api/oauth2/introspect`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['mcp:read', 'mcp:tools:execute', 'offline_access'],
      registration_endpoint: `${backendUrl}/api/oauth2/register`
    };

    server.log.debug({
      operation: 'oauth_authorization_server_metadata',
      issuer: metadata.issuer,
      endpoints: {
        authorization: metadata.authorization_endpoint,
        token: metadata.token_endpoint,
        introspection: metadata.introspection_endpoint
      }
    }, 'Serving OAuth 2.0 Authorization Server Metadata');

    const jsonString = JSON.stringify(metadata);
    return reply.status(200).type('application/json').send(jsonString);
  });

  // OpenID Connect Discovery (for VS Code compatibility)
  // VS Code MCP extension looks for this endpoint
  server.get('/.well-known/openid-configuration', {
    schema: {
      tags: ['OAuth Discovery'],
      summary: 'OpenID Connect Discovery (VS Code Compatibility)',
      description: 'OpenID Connect discovery endpoint for VS Code MCP extension compatibility',
      response: {
        200: {
          type: 'object',
          properties: {
            issuer: { type: 'string' },
            authorization_endpoint: { type: 'string' },
            token_endpoint: { type: 'string' },
            introspection_endpoint: { type: 'string' },
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
            scopes_supported: {
              type: 'array',
              items: { type: 'string' }
            },
            registration_endpoint: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    // Return the same metadata as OAuth authorization server for compatibility
    const metadata = {
      issuer: backendUrl,
      authorization_endpoint: `${backendUrl}/api/oauth2/auth`,
      token_endpoint: `${backendUrl}/api/oauth2/token`,
      introspection_endpoint: `${backendUrl}/api/oauth2/introspect`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['mcp:read', 'mcp:tools:execute', 'offline_access'],
      registration_endpoint: `${backendUrl}/api/oauth2/register`
    };

    server.log.debug({
      operation: 'openid_connect_discovery',
      issuer: metadata.issuer,
      client_compatibility: 'vscode_mcp_extension'
    }, 'Serving OpenID Connect Discovery for VS Code compatibility');

    const jsonString = JSON.stringify(metadata);
    return reply.status(200).type('application/json').send(jsonString);
  });
}
