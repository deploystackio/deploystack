import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import {
  CLIENT_TYPES,
  CLIENTS_LIST_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ClientsListResponse,
  type ErrorResponse,
  type ClientCategory,
  type ClientInfo
} from './schemas';

// Import the config generator to extract categories dynamically
import { generateClientConfig } from './config';

export default async function listClients(server: FastifyInstance) {
  server.get('/me/satellite/clients', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read')
    ],
    schema: {
      tags: ['User Satellite Configuration'],
      summary: 'List supported MCP client types',
      description: 'Returns a list of all supported MCP client types grouped by action category (connection, ai-instructions). Categories are dynamically extracted from client configurations.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      response: {
        200: {
          ...CLIENTS_LIST_RESPONSE_SCHEMA,
          description: 'List of supported MCP client types grouped by category'
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
      // Build category map: category -> clients that support it
      const categoryMap = new Map<string, Set<ClientInfo>>();

      // Loop through all client types and extract their categories
      for (const client of CLIENT_TYPES) {
        try {
          const actions = generateClientConfig(client.id);
          server.log.debug({ clientId: client.id, actionsCount: actions.length }, 'Generated client config');

          // Extract unique categories from this client's actions
          for (const action of actions) {
            if (action.category) {
              if (!categoryMap.has(action.category)) {
                categoryMap.set(action.category, new Set());
              }
              categoryMap.get(action.category)!.add(client);
              server.log.debug({ category: action.category, clientId: client.id }, 'Added client to category');
            }
          }
        } catch (err) {
          // Log error for debugging
          server.log.error({ clientId: client.id, error: err }, 'Failed to generate config for client');
          continue;
        }
      }

      server.log.debug({ categoriesCount: categoryMap.size }, 'Total categories extracted');

      // Convert map to array of categories
      const categories: ClientCategory[] = Array.from(categoryMap.entries()).map(([categoryId, clients]) => {
        // Determine category name and description based on ID
        let name = categoryId;
        let description = '';

        switch (categoryId) {
          case 'connection':
            name = 'Connection Setup';
            description = 'Configure MCP client settings and parameters';
            break;
          case 'ai-instructions':
            name = 'AI Instructions';
            description = 'Project-specific instruction files for AI coding assistants';
            break;
          default:
            name = categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
            description = `${name} configuration`;
        }

        return {
          id: categoryId,
          name,
          description,
          clients: Array.from(clients)
        };
      });

      const response: ClientsListResponse = {
        categories
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
