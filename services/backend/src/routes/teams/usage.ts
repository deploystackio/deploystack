import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeamService } from '../../services/teamService';
import { checkUserPermission } from '../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../db';
import { eq, sql } from 'drizzle-orm';
import {
  ERROR_RESPONSE_SCHEMA,
  TEAM_ID_PARAMS_SCHEMA,
  type ErrorResponse
} from './schemas';

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const TEAM_USAGE_DATA_SCHEMA = {
  type: 'object',
  properties: {
    is_default_team: {
      type: 'boolean',
      description: 'Whether this team is the calling user\'s default team'
    },
    total_installed_mcp_servers: {
      type: 'number',
      description: 'Total number of MCP servers installed for the team'
    },
    non_http_mcp_servers: {
      type: 'number',
      description: 'Number of non-HTTP MCP servers (stdio transport)'
    },
    http_mcp_servers: {
      type: 'number',
      description: 'Number of HTTP MCP servers (http/sse transport)'
    },
    limits: {
      type: 'object',
      properties: {
        mcp_server_limit: {
          type: 'number',
          description: 'Maximum total MCP servers allowed for the team'
        },
        non_http_mcp_limit: {
          type: 'number',
          description: 'Maximum non-HTTP MCP servers allowed for the team'
        }
      },
      required: ['mcp_server_limit', 'non_http_mcp_limit']
    }
  },
  required: ['is_default_team', 'total_installed_mcp_servers', 'non_http_mcp_servers', 'http_mcp_servers', 'limits']
} as const;

const TEAM_USAGE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: TEAM_USAGE_DATA_SCHEMA
  },
  required: ['success', 'data']
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface TeamIdParams {
  id: string;
}

interface TeamUsageLimits {
  mcp_server_limit: number;
  non_http_mcp_limit: number;
}

interface TeamUsageData {
  is_default_team: boolean;
  total_installed_mcp_servers: number;
  non_http_mcp_servers: number;
  http_mcp_servers: number;
  limits: TeamUsageLimits;
}

interface TeamUsageSuccessResponse {
  success: boolean;
  data: TeamUsageData;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function getTeamUsageRoute(server: FastifyInstance) {
  server.get('/teams/:id/usage', {
    schema: {
      tags: ['Teams'],
      summary: 'Get team usage statistics',
      description: 'Retrieves MCP server installation counts and limits for a specific team. Only team members can view their team\'s usage.',
      security: [{ cookieAuth: [] }],

      params: TEAM_ID_PARAMS_SCHEMA,

      response: {
        200: {
          ...TEAM_USAGE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Team usage retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: TeamIdParams }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const { id: teamId } = request.params as TeamIdParams;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user has access to view team usage
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.usage.view');

      if (!isTeamMember && !hasGlobalPermission) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'You do not have permission to view this team\'s usage'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const db = getDb();
      const { mcpServerInstallations, mcpServers, teams } = getSchema();

      // Get team limits and default team info
      const teamData = await db
        .select({
          mcp_server_limit: teams.mcp_server_limit,
          non_http_mcp_limit: teams.non_http_mcp_limit,
          is_default: teams.is_default,
          owner_id: teams.owner_id
        })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      const limits: TeamUsageLimits = {
        mcp_server_limit: teamData[0]?.mcp_server_limit ?? 5,
        non_http_mcp_limit: teamData[0]?.non_http_mcp_limit ?? 1
      };

      // Check if this is the calling user's default team
      const isDefaultTeam = teamData[0]?.is_default === true && teamData[0]?.owner_id === request.user.id;

      // Count installations by transport type
      const installationCounts = await db
        .select({
          transport_type: mcpServers.transport_type,
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(eq(mcpServerInstallations.team_id, teamId))
        .groupBy(mcpServers.transport_type);

      // Calculate counts
      let totalInstalled = 0;
      let nonHttpCount = 0;
      let httpCount = 0;

      for (const row of installationCounts) {
        const count = Number(row.count);
        totalInstalled += count;

        if (row.transport_type === 'http' || row.transport_type === 'sse') {
          httpCount += count;
        } else {
          // stdio or null defaults to non-http
          nonHttpCount += count;
        }
      }

      request.log.info({
        operation: 'get_team_usage',
        teamId,
        userId: request.user.id,
        totalInstalled,
        nonHttpCount,
        httpCount
      }, 'Retrieved team usage statistics');

      const successResponse: TeamUsageSuccessResponse = {
        success: true,
        data: {
          is_default_team: isDefaultTeam,
          total_installed_mcp_servers: totalInstalled,
          non_http_mcp_servers: nonHttpCount,
          http_mcp_servers: httpCount,
          limits
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching team usage');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch team usage'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
