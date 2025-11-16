import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import fs from 'fs';
import path from 'path';
import {
  CLIENT_PARAM_SCHEMA,
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ClientParams,
  type ErrorResponse,
  type JsonAction,
  type LinkAction,
  type TextAction,
  type CommandAction,
  type StepsAction,
  type ClientConfigResponse
} from './schemas';

// Helper function to create base64 encoded configuration for Cursor deeplinks
function createBase64Config(config: object): string {
  return Buffer.from(JSON.stringify(config)).toString('base64');
}

// Client configuration generator - now returns array of actions
export function generateClientConfig(clientType: string): ClientConfigResponse {
  const satelliteUrl = 'https://satellite.deploystack.io';
  const actions: ClientConfigResponse = [];

  // Read AI instruction files from local directory
  const aiInstructionsDir = path.join(__dirname, 'ai-instructions');
  const claudeMdContent = fs.readFileSync(path.join(aiInstructionsDir, 'CLAUDE.md'), 'utf-8');
  const copilotContent = fs.readFileSync(path.join(aiInstructionsDir, 'copilot-instructions.md'), 'utf-8');
  const cursorRulesContent = fs.readFileSync(path.join(aiInstructionsDir, 'cursorrules.md'), 'utf-8');

  // Base configuration for different action types
  let jsonConfig: JsonAction;
  let stepsConfig: StepsAction;
  let commandConfig: CommandAction;
  let textConfig: TextAction;
  let linkAction: LinkAction;

  switch (clientType) {
    case 'claude-desktop':
      jsonConfig = {
        type: 'json',
        category: 'connection',
        inputs: [],
        servers: {
          deploystack: {
            url: `${satelliteUrl}/mcp`,
            type: 'http'
          }
        },
        title: 'Claude Desktop Configuration',
        description: 'Add this configuration to your Claude Desktop settings file',
        inputType: 'textarea'
      };
      actions.push(jsonConfig);

      textConfig = {
        type: 'text',
        category: 'ai-instructions',
        title: 'CLAUDE.md - Project Instructions',
        description: 'Add this file to your project root as CLAUDE.md to provide persistent context to Claude Desktop',
        content: claudeMdContent
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
      stepsConfig = {
        type: 'steps',
        category: 'connection',
        steps: [
          {
            name: 'Open Command Palette',
            required: true,
            content: 'Press Shift + Command + P (Mac) or Shift + Ctrl + P (Windows/Linux)'
          },
          {
            name: 'Add MCP Server',
            required: true,
            content: 'Type "MCP: Add Server" and select it from the list'
          },
          {
            name: 'Choose Server Type',
            required: true,
            content: 'Select "HTTP Server Type" from the options'
          },
          {
            name: 'Paste DeployStack URL',
            required: true,
            content: `Paste the DeployStack satellite URL: ${satelliteUrl}/mcp`
          },
          {
            name: 'Follow Auth Flow',
            required: true,
            content: 'Complete the authentication flow when prompted'
          }
        ],
        title: 'Manual Configuration Steps',
        description: 'Follow these steps to manually configure DeployStack in VS Code'
      };
      actions.push(stepsConfig);

      textConfig = {
        type: 'text',
        category: 'ai-instructions',
        title: 'GitHub Copilot Instructions',
        description: 'Add this file to .github/copilot-instructions.md to configure GitHub Copilot for your DeployStack project',
        content: copilotContent
      };
      actions.push(textConfig);
      break;

    case 'claude-code':
      commandConfig = {
        type: 'command',
        category: 'connection',
        command: `claude mcp add --transport http deploystack ${satelliteUrl}/mcp`,
        title: 'Claude Code CLI Command',
        description: 'Run this command in your terminal to configure Claude Code with DeployStack',
        inputType: 'input'
      };
      actions.push(commandConfig);

      textConfig = {
        type: 'text',
        category: 'ai-instructions',
        title: 'CLAUDE.md - Project Instructions',
        description: 'Add this file to your project root as CLAUDE.md to provide persistent context to Claude Code',
        content: claudeMdContent
      };
      actions.push(textConfig);
      break;

    case 'cursor':
      // Create Cursor deeplink with base64-encoded config
      const cursorConfig = {
        url: `${satelliteUrl}/mcp`,
        transport: 'streamable_http'
      };
      const base64Config = createBase64Config(cursorConfig);
      const cursorDeeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=deploystack&config=${base64Config}`;

      linkAction = {
        type: 'link',
        category: 'connection',
        url: cursorDeeplink,
        name: 'Add DeployStack to Cursor',
        description: 'Click the button below to install DeployStack MCP server in Cursor with one click',
        imageUrl: '/images/add-to/cursor-mcp-install-dark.svg',
        buttonText: 'Add to Cursor'
      };
      actions.push(linkAction);

      textConfig = {
        type: 'text',
        category: 'ai-instructions',
        title: '.cursorrules - Cursor AI Rules',
        description: 'Add this file to .cursor/rules/deploystack.md to configure Cursor AI for your DeployStack project',
        content: cursorRulesContent
      };
      actions.push(textConfig);
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
