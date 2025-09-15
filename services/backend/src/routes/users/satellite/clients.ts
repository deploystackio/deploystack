import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { 
  CLIENT_TYPES, 
  CLIENTS_LIST_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type ClientsListResponse,
  type ErrorResponse
} from './schemas';

export default async function listClients(server: FastifyInstance) {
  server.get('/me/satellite/clients', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read')
    ],
    schema: {
      tags: ['User Satellite Configuration'],
      summary: 'List supported MCP client types',
      description: 'Returns a list of all supported MCP client types that can be configured with the DeployStack Satellite service. No Content-Type header required for this GET request.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: {
          ...CLIENTS_LIST_RESPONSE_SCHEMA,
          description: 'List of supported MCP client types'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const response: ClientsListResponse = {
        clients: CLIENT_TYPES
      };
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
