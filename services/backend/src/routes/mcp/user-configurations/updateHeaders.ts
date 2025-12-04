import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb } from '../../../db';
import {
  updateUserHeadersSchema,
  formatUserConfigResponse,
  type UpdateUserHeadersRouteRequest,
  type UserConfigUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateUserHeadersRoute(server: FastifyInstance) {
  server.patch<UpdateUserHeadersRouteRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId/headers',
    {
      preValidation: [
        requireAuthenticationAny()
      ],
      schema: {
        ...updateUserHeadersSchema,
        tags: ['MCP User Configurations'],
        summary: 'Update user configuration headers',
        description: 'Updates the user-specific HTTP headers for an MCP server installation configuration. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users).'
      }
    },
    async (request, reply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;
      const { headers } = request.body;
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
        operation: 'update_mcp_user_config_headers',
        teamId,
        installationId,
        configId,
        userId,
        authType,
        headerCount: Object.keys(headers).length
      }, 'Updating MCP user configuration headers');

      try {
        const db = getDb();
        const userConfigService = new McpUserConfigurationService(db, request.log);

        const updatedConfig = await userConfigService.updateUserHeaders(
          configId,
          userId,
          teamId,
          headers
        );

        if (!updatedConfig) {
          request.log.warn({
            operation: 'update_mcp_user_config_headers',
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
          operation: 'update_mcp_user_config_headers',
          teamId,
          installationId,
          configId,
          userId,
          authType
        }, 'Successfully updated MCP user configuration headers');

        // Create satellite commands for immediate notification (restart MCP server with new config)
        try {
          const satelliteCommandService = new SatelliteCommandService(db, request.log);
          const commands = await satelliteCommandService.notifyMcpUpdate(
            installationId,
            teamId,
            userId
          );

          request.log.info({
            operation: 'update_mcp_user_config_headers',
            installationId,
            commandsCreated: commands.length,
            satelliteIds: commands.map(c => c.satellite_id)
          }, 'Satellite commands created for user headers update');
        } catch (commandError) {
          request.log.error(commandError, `Failed to create satellite commands for user headers update ${configId}:`);
          // Don't fail update if command creation fails
        }

        const successResponse: UserConfigUpdateSuccessResponse = {
          success: true,
          data: formatUserConfigResponse(updatedConfig),
          message: 'User configuration headers updated successfully'
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'update_mcp_user_config_headers',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Failed to update MCP user configuration headers');

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        // Handle validation errors
        if (error instanceof Error && (
          error.message.includes('required') ||
          error.message.includes('header')
        )) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: errorMessage
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        const errorResponse: ErrorResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
