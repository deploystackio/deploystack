import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and, or, isNull } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import {
  CLIENT_PARAM_SCHEMA,
  CLIENT_CATEGORY_PARAM_SCHEMA,
  SATELLITE_ID_QUERY_SCHEMA,
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ClientParams,
  type ClientCategoryParams,
  type SatelliteIdQuery,
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

// Helper function to get satellite URL from database
async function getSatelliteUrl(
  satelliteId: string | undefined,
  teamId: string,
  db: ReturnType<typeof getDb>,
  satellites: ReturnType<typeof getSchema>['satellites']
): Promise<string> {
  // Build query condition - if satelliteId provided, use it; otherwise get first active satellite
  const query = satelliteId
    ? eq(satellites.id, satelliteId)
    : or(
        and(eq(satellites.satellite_type, 'global'), isNull(satellites.team_id)),
        and(eq(satellites.satellite_type, 'team'), eq(satellites.team_id, teamId))
      );

  const satelliteRecords = await db
    .select({ satellite_url: satellites.satellite_url })
    .from(satellites)
    .where(
      and(
        eq(satellites.status, 'active'),  // CRITICAL: Only active satellites
        query
      )
    )
    .limit(1);

  if (satelliteRecords.length === 0) {
    throw new Error('No active satellites available');
  }

  return satelliteRecords[0].satellite_url;
}

// Client configuration generator - now returns array of actions
export async function generateClientConfig(
  clientType: string,
  satelliteUrl: string
): Promise<ClientConfigResponse> {
  const actions: ClientConfigResponse = [];

  // Read AI instruction files from local directory
  const aiInstructionsDir = path.join(__dirname, 'ai-instructions');
  const claudeMdContent = fs.readFileSync(path.join(aiInstructionsDir, 'CLAUDE.md'), 'utf-8');
  const copilotContent = fs.readFileSync(path.join(aiInstructionsDir, 'copilot-instructions.md'), 'utf-8');
  const cursorRulesContent = fs.readFileSync(path.join(aiInstructionsDir, 'cursorrules.md'), 'utf-8');
  const geminiMdContent = fs.readFileSync(path.join(aiInstructionsDir, 'GEMINI.md'), 'utf-8');

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
        jsonContent: JSON.stringify({
          mcpServers: {
            deploystack: {
              url: `${satelliteUrl}/mcp`,
              type: 'http'
            }
          }
        }, null, 2),
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

    case 'gemini-cli':
      // Step 1: Initial setup command
      commandConfig = {
        type: 'command',
        category: 'connection',
        command: `gemini mcp add --transport http deploystack ${satelliteUrl}/mcp`,
        title: 'Step 1: Add DeployStack MCP Server',
        description: 'Run this command to register DeployStack with Gemini CLI',
        inputType: 'input'
      };
      actions.push(commandConfig);

      // Step 2: Open Gemini
      commandConfig = {
        type: 'command',
        category: 'connection',
        command: 'gemini',
        title: 'Step 2: Open Gemini CLI',
        description: 'Run this command to launch Gemini CLI',
        inputType: 'input'
      };
      actions.push(commandConfig);

      // Step 3: Authenticate inside Gemini
      commandConfig = {
        type: 'command',
        category: 'connection',
        command: '/mcp auth deploystack',
        title: 'Step 3: Authenticate (Inside Gemini)',
        description: 'Run this command inside Gemini CLI to complete authentication',
        inputType: 'input'
      };
      actions.push(commandConfig);

      // AI Instructions file
      textConfig = {
        type: 'text',
        category: 'ai-instructions',
        title: 'GEMINI.md - Project Instructions',
        description: 'Add this file to your project root as GEMINI.md to provide persistent context to Gemini CLI',
        content: geminiMdContent
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
  // New route with category filtering
  server.get<{
    Params: ClientCategoryParams;
    Querystring: SatelliteIdQuery;
  }>('/me/satellite/config/:category/:client', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read')
    ],
    schema: {
      tags: ['User Satellite Configuration'],
      summary: 'Get category-specific client configuration',
      description: 'Returns configuration actions filtered by category (connection, ai-instructions) for the specified MCP client.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: CLIENT_CATEGORY_PARAM_SCHEMA,
      querystring: SATELLITE_ID_QUERY_SCHEMA,
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Category-filtered client configuration'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid client type or category'
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
      const { category, client } = request.params as ClientCategoryParams;
      const { satelliteId } = request.query as SatelliteIdQuery;
      const userId = request.user!.id;

      const db = getDb();
      const { satellites, teams } = getSchema();

      // Get user's default team
      const defaultTeam = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.owner_id, userId),
            eq(teams.is_default, true)
          )
        )
        .limit(1);

      if (defaultTeam.length === 0) {
        throw new Error('No default team found for user');
      }

      const teamId = defaultTeam[0].id;

      // Get satellite URL from database
      const satelliteUrl = await getSatelliteUrl(satelliteId, teamId, db, satellites);

      // Generate all client-specific configuration actions with dynamic URL
      const allActions = await generateClientConfig(client, satelliteUrl);

      // Filter by category
      const filteredActions = allActions.filter(action => action.category === category);

      const jsonString = JSON.stringify(filteredActions);
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

  // Keep legacy route for backward compatibility (returns all actions)
  server.get<{
    Params: ClientParams;
    Querystring: SatelliteIdQuery;
  }>('/me/satellite/config/:client', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read')
    ],
    schema: {
      tags: ['User Satellite Configuration'],
      summary: 'Get client-specific satellite configuration (all categories)',
      description: 'Returns all configuration actions for the specified MCP client. Consider using /config/:category/:client for filtered results.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      params: CLIENT_PARAM_SCHEMA,
      querystring: SATELLITE_ID_QUERY_SCHEMA,
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
      const { satelliteId } = request.query as SatelliteIdQuery;
      const userId = request.user!.id;

      const db = getDb();
      const { satellites, teams } = getSchema();

      // Get user's default team
      const defaultTeam = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.owner_id, userId),
            eq(teams.is_default, true)
          )
        )
        .limit(1);

      if (defaultTeam.length === 0) {
        throw new Error('No default team found for user');
      }

      const teamId = defaultTeam[0].id;

      // Get satellite URL from database
      const satelliteUrl = await getSatelliteUrl(satelliteId, teamId, db, satellites);

      // Generate client-specific configuration actions with dynamic URL
      const configActions = await generateClientConfig(client, satelliteUrl);

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
