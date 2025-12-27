import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  INSTALLATION_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type InstallationData,
  type InstallationSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getInstallationRoute(server: FastifyInstance) {
  server.get('/teams/:teamId/mcp/installations/:installationId', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Get MCP installation by ID',
      description: 'Retrieves a specific MCP server installation by ID for the specified team. No Content-Type header required for this GET request.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_SUCCESS_RESPONSE_SCHEMA,
          description: 'Installation details'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId, installationId } = request.params as TeamAndInstallationParams;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.debug({
      operation: 'mcp_installation_operation',
      userId,
      authType,
      clientId: request.tokenPayload?.clientId,
      scope: request.tokenPayload?.scope,
      endpoint: request.url
    }, 'Authentication method determined for MCP installation operation');

    request.log.info({
      operation: 'get_mcp_installation',
      teamId,
      installationId,
      userId,
      authType
    }, 'Getting MCP installation by ID');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const installation = await installationService.getInstallationById(installationId, teamId) as InstallationData | null;

      if (!installation) {
        request.log.warn({
          operation: 'get_mcp_installation',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found');

        const notFoundResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'get_mcp_installation',
        teamId,
        installationId,
        userId,
      authType
      }, 'Retrieved MCP installation');

      const response: InstallationSuccessResponse = {
        success: true,
        data: formatInstallationResponse(installation)
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to get MCP installation');

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
