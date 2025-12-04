import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb } from '../../../db';
import {
  updateUserConfigurationSchema,
  formatUserConfigResponse,
  type UpdateUserConfigurationRequest,
  type UserConfigUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateUserConfigurationRoute(server: FastifyInstance) {
  server.put<UpdateUserConfigurationRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId',
    {
      preValidation: [
        requireAuthenticationAny()
      ],
      schema: updateUserConfigurationSchema
    },
    async (request, reply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;
      const updateData = request.body;
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
        operation: 'update_mcp_user_config',
        teamId,
        installationId,
        configId,
        userId,
        authType
      }, 'Updating MCP user configuration');

      try {
        const db = getDb();
        const userConfigService = new McpUserConfigurationService(db, request.log);
        
        const updatedConfig = await userConfigService.updateUserConfiguration(
          configId,
          userId,
          teamId,
          updateData
        );

        if (!updatedConfig) {
          request.log.warn({
            operation: 'update_mcp_user_config',
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
          operation: 'update_mcp_user_config',
          teamId,
          installationId,
          configId,
          userId,
          authType
        }, 'Successfully updated MCP user configuration');

        // Create satellite commands for immediate notification (restart MCP server with new config)
        try {
          const satelliteCommandService = new SatelliteCommandService(db, request.log);
          const commands = await satelliteCommandService.notifyMcpUpdate(
            installationId,
            teamId,
            userId
          );

          request.log.info({
            operation: 'update_mcp_user_config',
            installationId,
            commandsCreated: commands.length,
            satelliteIds: commands.map(c => c.satellite_id)
          }, 'Satellite commands created for user configuration update');
        } catch (commandError) {
          request.log.error(commandError, `Failed to create satellite commands for user config update ${configId}:`);
          // Don't fail update if command creation fails
        }

        const successResponse: UserConfigUpdateSuccessResponse = {
          success: true,
          data: formatUserConfigResponse(updatedConfig),
          message: 'User configuration updated successfully'
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'update_mcp_user_config',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Failed to update MCP user configuration');

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Handle specific error types
        if (error instanceof Error && error.message.includes('already exists')) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: errorMessage
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(409).type('application/json').send(jsonString);
        }
        
        if (error instanceof Error && (
          error.message.includes('required') || 
          error.message.includes('arguments') ||
          error.message.includes('environment variable')
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
