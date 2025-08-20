import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { getDb } from '../../../db';
import {
  TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
  USER_CONFIG_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatUserConfigResponse,
  type TeamAndInstallationAndConfigParams,
  type UserConfigSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getUserConfigurationRoute(server: FastifyInstance) {
  server.get<{
    Params: TeamAndInstallationAndConfigParams;
  }>('/teams/:teamId/mcp/installations/:installationId/user-configs/:configId', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:user-configs:read'),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP User Configurations'],
      summary: 'Get user configuration by ID',
      description: 'Retrieves a specific user configuration for an MCP server installation. No Content-Type header required for this GET request. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:user-configs:read scope for OAuth2 access.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...USER_CONFIG_SUCCESS_RESPONSE_SCHEMA,
          description: 'User configuration retrieved successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    const { teamId, installationId, configId } = request.params;
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
      operation: 'get_mcp_user_config',
      teamId,
      installationId,
      configId,
      userId,
      authType
    }, 'Getting MCP user configuration');

    try {
      const db = getDb();
      const userConfigService = new McpUserConfigurationService(db, request.log);
      
      const userConfig = await userConfigService.getUserConfigurationById(
        configId,
        userId,
        teamId
      );

      if (!userConfig) {
        request.log.warn({
          operation: 'get_mcp_user_config',
          teamId,
          installationId,
          configId,
          userId,
          found: false
        }, 'MCP user configuration not found');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User configuration not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'get_mcp_user_config',
        teamId,
        installationId,
        configId,
        userId,
        authType
      }, 'Successfully retrieved MCP user configuration');

      const successResponse: UserConfigSuccessResponse = {
        success: true,
        data: formatUserConfigResponse(userConfig)
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_mcp_user_config',
        error,
        teamId,
        installationId,
        configId,
        userId
      }, 'Failed to retrieve MCP user configuration');

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
