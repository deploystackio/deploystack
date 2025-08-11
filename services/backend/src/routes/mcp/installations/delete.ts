import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  INSTALLATION_DELETE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  type TeamAndInstallationParams,
  type InstallationDeleteSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function deleteInstallationRoute(server: FastifyInstance) {
  server.delete('/teams/:teamId/mcp/installations/:installationId', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.delete')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Delete MCP installation',
      description: 'Removes an MCP server installation from the specified team. No Content-Type header required for this DELETE request. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_DELETE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Installation deleted successfully'
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
      operation: 'delete_mcp_installation',
      teamId,
      installationId,
      userId,
      authType
    }, 'Deleting MCP installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const deleted = await installationService.deleteInstallation(installationId, teamId);

      if (!deleted) {
        const notFoundResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'delete_mcp_installation',
        teamId,
        installationId,
        userId,
      authType
      }, 'MCP installation deleted successfully');

      const response: InstallationDeleteSuccessResponse = {
        success: true,
        data: {
          id: installationId,
          deleted: true
        }
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'delete_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to delete MCP installation');

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
