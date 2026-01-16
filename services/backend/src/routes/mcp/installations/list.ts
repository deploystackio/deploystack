import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission, checkUserTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';
import {
  TEAM_ID_PARAM_SCHEMA,
  INSTALLATION_LIST_QUERY_SCHEMA,
  INSTALLATION_LIST_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationListResponse,
  type TeamIdParams,
  type InstallationListSuccessResponse,
  type ErrorResponse
} from './schemas';

interface InstallationListQuery {
  include_stats?: boolean;
}

export default async function listInstallationsRoute(server: FastifyInstance) {
  server.get<{
    Params: TeamIdParams;
    Querystring: InstallationListQuery;
  }>('/teams/:teamId/mcp/installations', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'List team MCP installations',
      description: 'Retrieves all MCP server installations for the specified team. Optionally include instance statistics with ?include_stats=true (requires mcp.installations.stats.view permission).',
      security: DUAL_AUTH_SECURITY,

      // Fastify validation schema
      params: TEAM_ID_PARAM_SCHEMA,
      querystring: INSTALLATION_LIST_QUERY_SCHEMA,

      response: {
        200: {
          ...INSTALLATION_LIST_SUCCESS_RESPONSE_SCHEMA,
          description: 'List of team installations retrieved successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId } = request.params as TeamIdParams;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    // Parse include_stats query parameter
    const query = request.query as InstallationListQuery;
    const includeStats = query.include_stats === true || query.include_stats === 'true' as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    request.log.debug({
      operation: 'list_mcp_installations',
      teamId,
      userId,
      authType,
      includeStats,
      clientId: request.tokenPayload?.clientId,
      scope: request.tokenPayload?.scope,
      endpoint: request.url
    }, 'Authentication method determined for MCP installations list');

    // Check permission for instance statistics if requested
    if (includeStats) {
      const hasStatsPermission = await checkUserTeamPermission(
        userId,
        teamId,
        'mcp.installations.stats.view'
      );

      if (!hasStatsPermission) {
        request.log.warn({
          operation: 'list_mcp_installations',
          teamId,
          userId,
          authType
        }, 'User lacks mcp.installations.stats.view permission');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Insufficient permissions to view instance statistics'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }
    }

    request.log.info({
      operation: 'list_mcp_installations',
      teamId,
      userId,
      authType,
      includeStats
    }, 'Listing MCP installations for team');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);

      const installations = await installationService.getTeamInstallations(teamId, userId, includeStats);

      request.log.info({
        operation: 'list_mcp_installations',
        teamId,
        userId,
        installationsCount: installations.length,
        includeStats
      }, 'Retrieved MCP installations for team');

      const successResponse: InstallationListSuccessResponse = {
        success: true,
        data: formatInstallationListResponse(installations as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'list_mcp_installations',
        error,
        teamId,
        userId
      }, 'Failed to list MCP installations');

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
