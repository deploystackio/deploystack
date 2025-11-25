/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';

// Database-backed client registration functions
export async function isClientRegistered(clientId: string, logger: FastifyBaseLogger): Promise<boolean> {
  try {
    const db = getDb();
    const { dynamicOauthClients } = getSchema();

    const result = await db
      .select()
      .from(dynamicOauthClients)
      .where(eq(dynamicOauthClients.client_id, clientId))
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    logger.error({
      operation: 'check_client_registration',
      clientId,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error checking client registration');
    return false;
  }
}

export async function getRegisteredClient(clientId: string, logger: FastifyBaseLogger): Promise<any> {
  try {
    const db = getDb();
    const { dynamicOauthClients } = getSchema();

    const result = await db
      .select()
      .from(dynamicOauthClients)
      .where(eq(dynamicOauthClients.client_id, clientId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    logger.error({
      operation: 'get_registered_client',
      clientId,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error getting registered client');
    return null;
  }
}

export async function getRegisteredClientsDebugInfo(logger: FastifyBaseLogger): Promise<any> {
  try {
    const db = getDb();
    const { dynamicOauthClients } = getSchema();

    const allClients = await db
      .select()
      .from(dynamicOauthClients);
    
    return {
      mapSize: allClients.length,
      allClientIds: allClients.map((client: any) => client.client_id),
      allClients: allClients.map((client: any) => ({
        id: client.client_id,
        name: client.client_name,
        registeredAt: client.client_id_issued_at
      }))
    };
  } catch (error) {
    logger.error({
      operation: 'get_registered_clients_debug',
      error: error instanceof Error ? error.message : String(error)
    }, 'Error getting debug info');
    return {
      mapSize: 0,
      allClientIds: [],
      allClients: []
    };
  }
}

/**
 * RFC 7591 Dynamic Client Registration Protocol
 * Allows MCP clients (like VS Code) to automatically register themselves
 */
export default async function registerRoute(server: FastifyInstance) {

  server.post('/oauth2/register', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth 2.0 Dynamic Client Registration',
      description: 'RFC 7591 compliant dynamic client registration endpoint for MCP clients',
      body: {
        type: 'object',
        properties: {
          client_name: { type: 'string' },
          redirect_uris: { 
            type: 'array', 
            items: { type: 'string' },
            minItems: 1
          },
          grant_types: { 
            type: 'array', 
            items: { type: 'string' }
          },
          response_types: { 
            type: 'array', 
            items: { type: 'string' }
          },
          scope: { type: 'string' },
          token_endpoint_auth_method: { type: 'string' }
        },
        required: ['redirect_uris'],
        additionalProperties: true
      },
      response: {
        201: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
            client_name: { type: 'string' },
            redirect_uris: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            grant_types: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            response_types: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            scope: { type: 'string' },
            token_endpoint_auth_method: { type: 'string' },
            client_id_issued_at: { type: 'number' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            error_description: { type: 'string' }
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
    const {
      client_name,
      redirect_uris,
      grant_types = ['authorization_code'],
      response_types = ['code'],
      scope = 'mcp:read mcp:tools:execute offline_access',
      token_endpoint_auth_method = 'none'
    } = request.body as any;

    // Validate redirect URIs for MCP clients
    const validRedirectUris = redirect_uris.filter((uri: string) => {
      // VS Code specific URIs
      if (uri === 'http://127.0.0.1:33418' || uri === 'https://vscode.dev/redirect') {
        return true;
      }
      // Localhost URIs for development
      if (uri.startsWith('http://127.0.0.1:') || uri.startsWith('http://localhost:')) {
        return true;
      }
      // Other MCP client patterns
      if (uri.startsWith('cursor://') || uri.startsWith('vscode://')) {
        return true;
      }
      // HTTPS URIs for production
      if (uri.startsWith('https://')) {
        return true;
      }
      return false;
    });

    if (validRedirectUris.length === 0) {
      return reply.status(400).send({
        error: 'invalid_redirect_uri',
        error_description: 'No valid redirect URIs provided for MCP client registration'
      });
    }

    // Validate grant types
    const allowedGrantTypes = ['authorization_code', 'refresh_token'];
    const validGrantTypes = grant_types.filter((type: string) => allowedGrantTypes.includes(type));
    if (validGrantTypes.length === 0) {
      validGrantTypes.push('authorization_code'); // Default
    }

    // Validate response types
    const allowedResponseTypes = ['code'];
    const validResponseTypes = response_types.filter((type: string) => allowedResponseTypes.includes(type));
    if (validResponseTypes.length === 0) {
      validResponseTypes.push('code'); // Default
    }

    // Generate unique client ID
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const client_id = `dyn_${timestamp}_${randomSuffix}`;
    
    // Create client registration
    const registration = {
      client_id,
      client_name: client_name || 'Dynamically Registered MCP Client',
      redirect_uris: validRedirectUris,
      grant_types: validGrantTypes,
      response_types: validResponseTypes,
      scope,
      token_endpoint_auth_method,
      client_id_issued_at: Math.floor(timestamp / 1000)
    };

    try {
      // Store client registration in database
      const db = getDb();
      const { dynamicOauthClients } = getSchema();

      const dbRegistration = {
        client_id,
        client_name: registration.client_name,
        redirect_uris: JSON.stringify(validRedirectUris),
        grant_types: JSON.stringify(validGrantTypes),
        response_types: JSON.stringify(validResponseTypes),
        scope,
        token_endpoint_auth_method,
        client_id_issued_at: registration.client_id_issued_at,
        expires_at: null, // No expiration for now
      };

      await db.insert(dynamicOauthClients).values(dbRegistration);

      request.log.info({
        operation: 'dynamic_client_registration',
        client_id,
        client_name: registration.client_name,
        redirect_uris: validRedirectUris,
        grant_types: validGrantTypes,
        scope
      }, 'MCP client registered successfully via RFC 7591 (database)');

      return reply.status(201).send(registration);
    } catch (error) {
      request.log.error({
        operation: 'dynamic_client_registration',
        error: error instanceof Error ? error.message : String(error),
        client_id,
      }, 'Failed to register MCP client in database');

      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Failed to register client'
      });
    }
  });
}
