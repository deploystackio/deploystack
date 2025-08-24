import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { getDb } from '../../../db';
import {
  updateUserArgsSchema,
  formatUserConfigResponse,
  type UpdateUserArgsRouteRequest,
  type UserConfigUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateUserArgsRoute(server: FastifyInstance) {
  server.patch<UpdateUserArgsRouteRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId/args',
    {
      preValidation: [
        requireAuthenticationAny()
      ],
      schema: {
        ...updateUserArgsSchema,
        tags: ['MCP User Configurations'],
        summary: 'Update user configuration arguments',
        description: 'Updates the user-specific arguments for an MCP server installation configuration. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users).'
      }
    },
    async (request, reply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;
      const { args } = request.body;
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
        operation: 'update_mcp_user_config_args',
        teamId,
        installationId,
        configId,
        userId,
        authType,
        argsCount: Object.keys(args).length
      }, 'Updating MCP user configuration arguments');

      try {
        const db = getDb();
        const userConfigService = new McpUserConfigurationService(db, request.log);
        
        const updatedConfig = await userConfigService.updateUserArgs(
          configId,
          userId,
          teamId,
          args
        );

        if (!updatedConfig) {
          request.log.warn({
            operation: 'update_mcp_user_config_args',
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
          operation: 'update_mcp_user_config_args',
          teamId,
          installationId,
          configId,
          userId,
          authType
        }, 'Successfully updated MCP user configuration arguments');

        const successResponse: UserConfigUpdateSuccessResponse = {
          success: true,
          data: formatUserConfigResponse(updatedConfig),
          message: 'User configuration arguments updated successfully'
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'update_mcp_user_config_args',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Failed to update MCP user configuration arguments');
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Handle validation errors
        if (error instanceof Error && (
          error.message.includes('required') || 
          error.message.includes('arguments')
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
