import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { getDb } from '../../../db';
import {
  listUserConfigurationsSchema,
  formatUserConfigResponse,
  type ListUserConfigurationsRequest,
  type UserConfigListResponse,
  type ErrorResponse
} from './schemas';

export default async function listUserConfigsRoute(server: FastifyInstance) {
  server.get<ListUserConfigurationsRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs',
    {
      preValidation: [
        requireAuthenticationAny(),
        requireOAuthScope('mcp:user-configs:read'),
        requireTeamPermission('mcp.installations.view')
      ],
      schema: {
        ...listUserConfigurationsSchema,
        tags: ['MCP User Configurations'],
        summary: 'List user configurations for MCP installation',
        description: 'Retrieves all user-specific configurations for an MCP server installation belonging to the authenticated user. No Content-Type header required for this GET request. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:user-configs:read scope for OAuth2 access.'
      }
    },
    async (request, reply) => {
      const { teamId, installationId } = request.params;
      const userId = request.user!.id;
      const authType = request.tokenPayload ? 'oauth2' : 'cookie';

      request.log.debug({
        operation: 'mcp_user_config_operation',
        userId,
        authType,
        clientId: request.tokenPayload?.clientId,
        scope: request.tokenPayload?.scope,
        endpoint: request.url
      }, 'Authentication method determined for MCP user configuration operation');

      request.log.info({
        operation: 'list_mcp_user_configs',
        teamId,
        installationId,
        userId,
        authType
      }, 'Listing MCP user configurations');

      try {
        const db = getDb();
        const userConfigService = new McpUserConfigurationService(db, request.log);
        
        const userConfigs = await userConfigService.getUserConfigurations(
          installationId,
          userId,
          teamId
        );

        request.log.info({
          operation: 'list_mcp_user_configs',
          teamId,
          installationId,
          userId,
          authType,
          configCount: userConfigs.length
        }, 'Successfully retrieved MCP user configurations');

        const successResponse: UserConfigListResponse = {
          success: true,
          data: userConfigs.map(config => formatUserConfigResponse(config)),
          message: `Retrieved ${userConfigs.length} user configuration(s)`
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'list_mcp_user_configs',
          error,
          teamId,
          installationId,
          userId
        }, 'Failed to retrieve MCP user configurations');

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
