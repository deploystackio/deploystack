import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, sql } from 'drizzle-orm';

// =============================================================================
// CONSTANTS - Hierarchical Router Token Savings
// =============================================================================

const HIERARCHICAL_META_TOOLS = 2; // discover_mcp_tools + execute_mcp_tool
const TOKEN_PER_META_TOOL = 686; // Tokens per meta-tool
const HIERARCHICAL_TOKEN_COUNT = HIERARCHICAL_META_TOOLS * TOKEN_PER_META_TOOL; // 1372 tokens total
const CONTEXT_WINDOW_SIZE = 200000; // Claude's context window (tokens)

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const TEAM_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    }
  },
  required: ['teamId'],
  additionalProperties: false
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const TOOL_DETAIL_SCHEMA = {
  type: 'object',
  properties: {
    tool_name: { type: 'string', description: 'Name of the tool' },
    token_count: { type: 'number', description: 'Token count for this tool' }
  },
  required: ['tool_name', 'token_count']
} as const;

const INSTALLATION_STATS_SCHEMA = {
  type: 'object',
  properties: {
    installation_id: { type: 'string', description: 'Installation unique identifier' },
    installation_name: { type: 'string', description: 'Installation name' },
    server_slug: { type: 'string', description: 'MCP server slug' },
    server_name: { type: 'string', description: 'MCP server name' },
    tool_count: { type: 'number', description: 'Number of tools in this installation' },
    total_tokens: { type: 'number', description: 'Total tokens consumed by all tools in this installation' },
    average_tokens_per_tool: { type: 'number', description: 'Average tokens per tool' },
    tools: {
      type: 'array',
      items: TOOL_DETAIL_SCHEMA,
      description: 'List of tools with their token counts'
    }
  },
  required: ['installation_id', 'installation_name', 'server_slug', 'server_name', 'tool_count', 'total_tokens', 'average_tokens_per_tool', 'tools']
} as const;

const TRADITIONAL_APPROACH_SCHEMA = {
  type: 'object',
  properties: {
    total_tools: { type: 'number', description: 'Total number of tools exposed directly to LLM' },
    total_tokens: { type: 'number', description: 'Total tokens consumed when exposing all tools' },
    context_window_utilization_percent: { type: 'number', description: 'Percentage of context window consumed' }
  },
  required: ['total_tools', 'total_tokens', 'context_window_utilization_percent']
} as const;

const HIERARCHICAL_APPROACH_SCHEMA = {
  type: 'object',
  properties: {
    exposed_tools: { type: 'number', description: 'Number of meta-tools exposed (always 2)', default: 2 },
    total_tokens: { type: 'number', description: 'Total tokens consumed by hierarchical router (always 1372)', default: 1372 },
    context_window_utilization_percent: { type: 'number', description: 'Percentage of context window consumed' }
  },
  required: ['exposed_tools', 'total_tokens', 'context_window_utilization_percent']
} as const;

const SAVINGS_SCHEMA = {
  type: 'object',
  properties: {
    tokens_saved: { type: 'number', description: 'Number of tokens saved by using hierarchical routing' },
    reduction_percent: { type: 'number', description: 'Percentage reduction in token consumption' }
  },
  required: ['tokens_saved', 'reduction_percent']
} as const;

const STATS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team identifier' },
        context_window_size: { type: 'number', description: 'Context window size used for calculations (in tokens). Claude: 200,000, GPT-4: 128,000', default: 200000 },
        total_installations: { type: 'number', description: 'Total number of installations with discovered tools' },
        total_tools: { type: 'number', description: 'Total number of tools across all installations' },
        total_tokens: { type: 'number', description: 'Total tokens consumed across all tools' },
        traditional_approach: TRADITIONAL_APPROACH_SCHEMA,
        hierarchical_approach: HIERARCHICAL_APPROACH_SCHEMA,
        savings: SAVINGS_SCHEMA,
        installations: {
          type: 'array',
          items: INSTALLATION_STATS_SCHEMA,
          description: 'Breakdown by installation'
        }
      },
      required: ['team_id', 'context_window_size', 'total_installations', 'total_tools', 'total_tokens', 'traditional_approach', 'hierarchical_approach', 'savings', 'installations']
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

interface TeamParams {
  teamId: string;
}

interface ToolDetail {
  tool_name: string;
  token_count: number;
}

interface InstallationStats {
  installation_id: string;
  installation_name: string;
  server_slug: string;
  server_name: string;
  tool_count: number;
  total_tokens: number;
  average_tokens_per_tool: number;
  tools: ToolDetail[];
}

interface TraditionalApproach {
  total_tools: number;
  total_tokens: number;
  context_window_utilization_percent: number;
}

interface HierarchicalApproach {
  exposed_tools: number;
  total_tokens: number;
  context_window_utilization_percent: number;
}

interface Savings {
  tokens_saved: number;
  reduction_percent: number;
}

interface StatsSuccessResponse {
  success: boolean;
  data: {
    team_id: string;
    context_window_size: number;
    total_installations: number;
    total_tools: number;
    total_tokens: number;
    traditional_approach: TraditionalApproach;
    hierarchical_approach: HierarchicalApproach;
    savings: Savings;
    installations: InstallationStats[];
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate context window utilization percentage
 */
function calculateUtilization(tokens: number): number {
  return Math.round((tokens / CONTEXT_WINDOW_SIZE) * 10000) / 100;
}

/**
 * Calculate token savings from hierarchical routing
 */
function calculateSavings(traditionalTokens: number): Savings {
  const tokensSaved = traditionalTokens - HIERARCHICAL_TOKEN_COUNT;
  const reductionPercent = traditionalTokens > 0
    ? Math.round((tokensSaved / traditionalTokens) * 10000) / 100
    : 0;

  return {
    tokens_saved: tokensSaved,
    reduction_percent: reductionPercent
  };
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getTeamMcpToolsStatsRoute(server: FastifyInstance) {
  server.get<{
    Params: TeamParams;
  }>('/teams/:teamId/mcp/tools/stats', {
    preValidation: requireTeamPermission('mcp.tools.stats.view'),
    schema: {
      tags: ['MCP Tools'],
      summary: 'Get team MCP tools statistics',
      description: 'Retrieves aggregated statistics for all MCP tool installations in a team, including token consumption analysis and hierarchical routing savings calculations. Shows the value of DeployStack\'s hierarchical router vs traditional MCP tool exposure. Requires mcp.tools.stats.view permission.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      params: TEAM_PARAMS_SCHEMA,

      response: {
        200: {
          ...STATS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Statistics retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or not a team member'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId } = request.params as TeamParams;
    const userId = request.user!.id;

    request.log.info({
      operation: 'get_team_mcp_tools_stats',
      teamId,
      userId
    }, 'Retrieving MCP tools statistics for team');

    try {
      const db = getDb();
      const { mcpToolMetadata, mcpServerInstallations, mcpServers, teams } = getSchema();

      // Step 1: Verify team exists
      const team = await db
        .select({
          id: teams.id,
          name: teams.name
        })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!team || team.length === 0) {
        request.log.warn({
          operation: 'get_team_mcp_tools_stats',
          teamId,
          userId
        }, 'Team not found');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Note: Team membership and permission checks are already handled by requireTeamPermission middleware
      // The middleware checks:
      // 1. User is authenticated
      // 2. User is either a global admin OR a member of the team
      // 3. User's role (global_admin, team_admin, or team_user) has the required permission

      // Step 2: Query all tools for all team installations
      const allTools = await db
        .select({
          installation_id: mcpToolMetadata.installation_id,
          tool_name: mcpToolMetadata.tool_name,
          token_count: mcpToolMetadata.token_count
        })
        .from(mcpToolMetadata)
        .where(eq(mcpToolMetadata.team_id, teamId))
        .orderBy(mcpToolMetadata.installation_id, mcpToolMetadata.tool_name);

      // Step 3: Query aggregated tool statistics by installation
      const installationStats = await db
        .select({
          installation_id: mcpServerInstallations.id,
          installation_name: mcpServerInstallations.installation_name,
          server_slug: mcpServers.slug,
          server_name: mcpServers.name,
          tool_count: sql<number>`COUNT(${mcpToolMetadata.id})`,
          total_tokens: sql<number>`COALESCE(SUM(${mcpToolMetadata.token_count}), 0)`
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .leftJoin(mcpToolMetadata, eq(mcpToolMetadata.installation_id, mcpServerInstallations.id))
        .where(eq(mcpServerInstallations.team_id, teamId))
        .groupBy(mcpServerInstallations.id, mcpServers.slug, mcpServers.name);

      // Step 4: Group tools by installation
      const toolsByInstallation = new Map<string, ToolDetail[]>();
      for (const tool of allTools) {
        if (!toolsByInstallation.has(tool.installation_id)) {
          toolsByInstallation.set(tool.installation_id, []);
        }
        toolsByInstallation.get(tool.installation_id)!.push({
          tool_name: tool.tool_name,
          token_count: tool.token_count
        });
      }

      // Step 5: Filter out installations with no tools and calculate averages
      // Note: SQL aggregate functions (COUNT, SUM) return strings from the database driver
      // We must convert them to numbers to avoid string concatenation in reduce operations
      const installationsWithTools = installationStats
        .filter((inst: typeof installationStats[0]) => Number(inst.tool_count) > 0)
        .map((inst: typeof installationStats[0]) => {
          const toolCount = Number(inst.tool_count);
          const totalTokens = Number(inst.total_tokens);
          return {
            installation_id: inst.installation_id,
            installation_name: inst.installation_name,
            server_slug: inst.server_slug || 'unknown',
            server_name: inst.server_name || 'Unknown Server',
            tool_count: toolCount,
            total_tokens: totalTokens,
            average_tokens_per_tool: toolCount > 0
              ? Math.round(totalTokens / toolCount)
              : 0,
            tools: toolsByInstallation.get(inst.installation_id) || []
          };
        });

      // Step 6: Calculate team-wide totals
      const totalInstallations = installationsWithTools.length;
      const totalTools = installationsWithTools.reduce((sum: number, inst: InstallationStats) => sum + inst.tool_count, 0);
      const totalTokens = installationsWithTools.reduce((sum: number, inst: InstallationStats) => sum + inst.total_tokens, 0);

      // Step 7: Calculate traditional approach metrics
      const traditionalApproach: TraditionalApproach = {
        total_tools: totalTools,
        total_tokens: totalTokens,
        context_window_utilization_percent: calculateUtilization(totalTokens)
      };

      // Step 8: Calculate hierarchical approach metrics
      const hierarchicalApproach: HierarchicalApproach = {
        exposed_tools: HIERARCHICAL_META_TOOLS,
        total_tokens: HIERARCHICAL_TOKEN_COUNT,
        context_window_utilization_percent: calculateUtilization(HIERARCHICAL_TOKEN_COUNT)
      };

      // Step 9: Calculate savings
      const savings = calculateSavings(totalTokens);

      request.log.info({
        operation: 'get_team_mcp_tools_stats',
        teamId,
        userId,
        totalInstallations,
        totalTools,
        totalTokens,
        tokensSaved: savings.tokens_saved,
        reductionPercent: savings.reduction_percent
      }, 'Retrieved MCP tools statistics for team');

      const successResponse: StatsSuccessResponse = {
        success: true,
        data: {
          team_id: teamId,
          context_window_size: CONTEXT_WINDOW_SIZE,
          total_installations: totalInstallations,
          total_tools: totalTools,
          total_tokens: totalTokens,
          traditional_approach: traditionalApproach,
          hierarchical_approach: hierarchicalApproach,
          savings,
          installations: installationsWithTools
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_team_mcp_tools_stats',
        error,
        teamId,
        userId
      }, 'Failed to retrieve team MCP tools statistics');

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
