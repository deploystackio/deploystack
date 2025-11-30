import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const TEAM_AND_INSTALLATION_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID that owns the installation'
    },
    installationId: {
      type: 'string',
      minLength: 1,
      description: 'Installation ID'
    }
  },
  required: ['teamId', 'installationId'],
  additionalProperties: false
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Tool metadata unique identifier' },
    tool_name: { type: 'string', description: 'Name of the tool' },
    description: { type: 'string', description: 'Tool description' },
    input_schema: { type: 'object', description: 'JSON Schema for tool input' },
    token_count: { type: 'number', description: 'Token count for this tool' },
    is_disabled: { type: 'boolean', description: 'Whether the tool is disabled by team admin' },
    discovered_at: { type: 'string', description: 'ISO 8601 timestamp when tool was discovered' },
    updated_at: { type: 'string', description: 'ISO 8601 timestamp when tool was last updated' }
  },
  required: ['id', 'tool_name', 'description', 'input_schema', 'token_count', 'is_disabled', 'discovered_at', 'updated_at']
} as const;

const TOOLS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'object',
      properties: {
        installation_id: { type: 'string', description: 'Installation unique identifier' },
        installation_name: { type: 'string', description: 'Installation name' },
        team_id: { type: 'string', description: 'Team identifier' },
        server_slug: { type: 'string', description: 'MCP server slug' },
        tool_count: { type: 'number', description: 'Number of tools discovered' },
        total_tokens: { type: 'number', description: 'Total token count across all tools' },
        tools: {
          type: 'array',
          items: TOOL_SCHEMA,
          description: 'Array of discovered tools'
        }
      },
      required: ['installation_id', 'installation_name', 'team_id', 'server_slug', 'tool_count', 'total_tokens', 'tools']
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false, description: 'Indicates failure' },
    error: { type: 'string', description: 'Error message detailing what went wrong' }
  },
  required: ['success', 'error']
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamAndInstallationParams {
  teamId: string;
  installationId: string;
}

interface Tool {
  id: string;
  tool_name: string;
  description: string;
  input_schema: unknown;
  token_count: number;
  is_disabled: boolean;
  discovered_at: string;
  updated_at: string;
}

interface ToolsSuccessResponse {
  success: boolean;
  data: {
    installation_id: string;
    installation_name: string;
    team_id: string;
    server_slug: string;
    tool_count: number;
    total_tokens: number;
    tools: Tool[];
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getInstallationToolsRoute(server: FastifyInstance) {
  server.get<{
    Params: TeamAndInstallationParams;
  }>('/teams/:teamId/mcp/installations/:installationId/tools', {
    preValidation: requireTeamPermission('mcp.tools.view'),
    schema: {
      tags: ['MCP Tools'],
      summary: 'Get installation tool metadata',
      description: 'Retrieves all discovered tools for a specific MCP installation with token consumption data. Requires mcp.tools.view permission. Returns empty array if no tools have been discovered yet.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,

      response: {
        200: {
          ...TOOLS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Tool metadata retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or not a team member'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Installation does not exist or does not belong to specified team'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId, installationId } = request.params as TeamAndInstallationParams;
    const userId = request.user!.id;

    request.log.info({
      operation: 'get_installation_tools',
      teamId,
      installationId,
      userId
    }, 'Retrieving tool metadata for installation');

    try {
      const db = getDb();
      const { mcpToolMetadata, mcpServerInstallations, mcpServers } = getSchema();

      // Step 1: Verify installation exists and belongs to the specified team
      const installation = await db
        .select({
          id: mcpServerInstallations.id,
          installation_name: mcpServerInstallations.installation_name,
          team_id: mcpServerInstallations.team_id,
          server_slug: mcpServers.slug
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(
          and(
            eq(mcpServerInstallations.id, installationId),
            eq(mcpServerInstallations.team_id, teamId)
          )
        )
        .limit(1);

      if (!installation || installation.length === 0) {
        request.log.warn({
          operation: 'get_installation_tools',
          teamId,
          installationId,
          userId
        }, 'Installation not found or does not belong to team');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found or does not belong to specified team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const installationData = installation[0];

      // Step 2: Query tool metadata with team isolation
      const tools = await db
        .select()
        .from(mcpToolMetadata)
        .where(
          and(
            eq(mcpToolMetadata.installation_id, installationId),
            eq(mcpToolMetadata.team_id, teamId)
          )
        )
        .orderBy(mcpToolMetadata.tool_name);

      // Step 3: Calculate summary metrics
      const toolCount = tools.length;
      const totalTokens = tools.reduce((sum: number, tool: typeof tools[0]) => sum + tool.token_count, 0);

      // Step 4: Format tools response
      const formattedTools: Tool[] = tools.map((tool: typeof tools[0]) => ({
        id: tool.id,
        tool_name: tool.tool_name,
        description: tool.description,
        input_schema: tool.input_schema, // Already parsed by Drizzle (mode: 'json')
        token_count: tool.token_count,
        is_disabled: tool.is_disabled,
        discovered_at: tool.discovered_at.toISOString(),
        updated_at: tool.updated_at.toISOString()
      }));

      request.log.info({
        operation: 'get_installation_tools',
        teamId,
        installationId,
        userId,
        toolCount,
        totalTokens
      }, 'Retrieved tool metadata for installation');

      const successResponse: ToolsSuccessResponse = {
        success: true,
        data: {
          installation_id: installationData.id,
          installation_name: installationData.installation_name,
          team_id: installationData.team_id,
          server_slug: installationData.server_slug || 'unknown',
          tool_count: toolCount,
          total_tokens: totalTokens,
          tools: formattedTools
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_installation_tools',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to retrieve installation tool metadata');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
