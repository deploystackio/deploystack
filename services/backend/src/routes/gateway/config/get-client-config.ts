import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';

// Reusable Schema Constants
const CLIENT_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    client: {
      type: 'string',
      enum: ['claude-desktop', 'cline', 'vscode', 'cursor', 'windsurf'],
      description: 'The MCP client type'
    }
  },
  required: ['client'],
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  description: 'Client-specific gateway configuration (format varies by client type)',
  additionalProperties: true
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface ClientParams {
  client: 'claude-desktop' | 'cline' | 'vscode' | 'cursor' | 'windsurf';
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// Client configuration generator
function generateClientConfig(clientType: string): object {
  const gatewayUrl = 'http://localhost:9095/sse';
  
  switch (clientType) {
    case 'claude-desktop':
    case 'cline':
      return {
        mcpServers: {
          deploystack: {
            url: gatewayUrl,
            name: 'DeployStack Gateway',
            description: 'Enterprise MCP Gateway with team-based access control'
          }
        }
      };
    
    case 'vscode':
      return {
        mcpServers: {
          deploystack: {
            url: gatewayUrl
          }
        }
      };
    
    case 'cursor':
      return {
        mcpServers: {
          deploystack: {
            url: gatewayUrl,
            transport: 'sse'
          }
        }
      };
    
    case 'windsurf':
      return {
        mcpServers: {
          deploystack: {
            type: 'sse',
            url: gatewayUrl
          }
        }
      };
    
    default:
      throw new Error(`Unsupported client type: ${clientType}`);
  }
}

export default async function getClientConfig(server: FastifyInstance) {
  server.get('/config/:client', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('gateway:config:read')
    ],
    schema: {
      tags: ['Gateway Configuration'],
      summary: 'Get client-specific gateway configuration',
      description: 'Returns the appropriate configuration format for connecting the specified MCP client to the local DeployStack Gateway.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: CLIENT_PARAM_SCHEMA,
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Client-specific gateway configuration'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid client type'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { client } = request.params as ClientParams;
      
      // Generate client-specific configuration
      const config = generateClientConfig(client);
      
      const jsonString = JSON.stringify(config);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }
  });
}
