import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { 
  CLIENT_PARAM_SCHEMA, 
  SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type ClientParams,
  type ErrorResponse,
  type JsonAction,
  // type LinkAction,
  type TextAction,
  type ClientConfigResponse
} from './schemas';

// Helper function to create base64 encoded configuration for Cursor deeplinks
// function createBase64Config(config: object): string {
//   return Buffer.from(JSON.stringify(config)).toString('base64');
// }

// Client configuration generator - now returns array of actions
function generateClientConfig(clientType: string): ClientConfigResponse {
  const satelliteUrl = 'https://satellite.deploystack.io';
  const actions: ClientConfigResponse = [];
  
  // Base configuration for different action types
  let jsonConfig: JsonAction;
  let textConfig: TextAction;
  
  switch (clientType) {
    case 'claude-desktop':
      textConfig = {
        type: 'text',
        content: `Open Claude Desktop and navigate to Settings > Connectors > Add Custom Connector. Enter the name as \`DeployStack\` and the remote MCP server URL as \`${satelliteUrl}/mcp\`.`,
        title: 'Manual Configuration Steps',
        description: 'Follow these steps to manually configure DeployStack in Claude Desktop'
      };
      actions.push(textConfig);
      break;
    
    // case 'cline':
    //   // Cline still needs the old SSE endpoint
    //   jsonConfig = {
    //     type: 'json',
    //     mcpServers: {
    //       deploystack: {
    //         url: `${satelliteUrl}/sse`,
    //         name: 'DeployStack Satellite',
    //         description: 'Enterprise MCP Satellite with team-based access control'
    //       }
    //     }
    //   };
    //   actions.push(jsonConfig);
    //   break;
    
    case 'vscode':
      jsonConfig = {
        type: 'json',
        inputs: [],
        servers: {
          deploystack: {
            url: `${satelliteUrl}/mcp`,
            type: 'http'
          }
        }
      };
      actions.push(jsonConfig);
      break;
    
    // case 'cursor':
    //   // JSON configuration for Cursor
    //   jsonConfig = {
    //     type: 'json',
    //     mcpServers: {
    //       deploystack: {
    //         url: `${satelliteUrl}/mcp`,
    //         transport: 'streamable_http'
    //       }
    //     }
    //   };
    //   actions.push(jsonConfig);
      
    //   // Cursor deeplink action - using the same MCP server config
    //   const cursorMcpConfig = {
    //     deploystack: {
    //       url: `${satelliteUrl}/mcp`,
    //       transport: 'streamable_http'
    //     }
    //   };
      
    //   const base64Config = createBase64Config(cursorMcpConfig);
    //   const cursorDeeplink: LinkAction = {
    //     type: 'link',
    //     url: `cursor://anysphere.cursor-deeplink/mcp/install?name=deploystack&config=${base64Config}`,
    //     name: 'Install DeployStack in Cursor',
    //     description: 'One-click installation for Cursor IDE'
    //   };
    //   actions.push(cursorDeeplink);
    //   break;
    
    // case 'windsurf':
    //   jsonConfig = {
    //     type: 'json',
    //     mcpServers: {
    //       deploystack: {
    //         type: 'sse',
    //         url: `${satelliteUrl}/sse`,
    //         headers: {
    //           'Authorization': 'Bearer your-jwt-token-here',
    //           'Content-Type': 'application/json'
    //         }
    //       }
    //     }
    //   };
    //   actions.push(jsonConfig);
    //   break;
    
    default:
      throw new Error(`Unsupported client type: ${clientType}`);
  }
  
  return actions;
}

export default async function getClientConfig(server: FastifyInstance) {
  server.get('/me/satellite/config/:client', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read')
    ],
    schema: {
      tags: ['User Satellite Configuration'],
      summary: 'Get client-specific satellite configuration',
      description: 'Returns the appropriate configuration format for connecting the specified MCP client to the DeployStack Satellite service. Requires Content-Type: application/json header when sending request body.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: CLIENT_PARAM_SCHEMA,
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Client-specific satellite configuration'
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
      
      // Generate client-specific configuration actions
      const configActions = generateClientConfig(client);
      
      const jsonString = JSON.stringify(configActions);
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
