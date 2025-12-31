import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { McpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  CREATE_USER_CONFIG_REQUEST_SCHEMA,
  USER_CONFIG_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatUserConfigResponse,
  type TeamAndInstallationParams,
  type CreateUserConfigRequest,
  type UserConfigSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function createUserConfigRoute(server: FastifyInstance) {
  server.post<{
    Params: TeamAndInstallationParams;
    Body: CreateUserConfigRequest;
  }>('/teams/:teamId/mcp/installations/:installationId/user-configs', {
    preValidation: [
      requireAuthenticationAny()
    ],
    schema: {
      tags: ['MCP User Configurations'],
      summary: 'Create user configuration for MCP installation',
      description: 'Creates a new user-specific configuration for an MCP server installation. This allows individual users to customize arguments and environment variables for their personal use. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users).',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: CREATE_USER_CONFIG_REQUEST_SCHEMA,
      
      response: {
        201: {
          ...USER_CONFIG_SUCCESS_RESPONSE_SCHEMA,
          description: 'User configuration created successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
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
    
    const configData = request.body as CreateUserConfigRequest;

    request.log.info({
      operation: 'create_mcp_user_config',
      teamId,
      installationId,
      userId,
      authType,
      deviceId: configData.device_id,
      hasArgs: !!configData.user_args,
      hasEnv: !!configData.user_env
    }, 'Creating MCP user configuration');

    try {
      const db = getDb();
      const userConfigService = new McpUserConfigurationService(db, request.log);
      
      const userConfig = await userConfigService.createUserConfiguration(
        installationId,
        userId,
        teamId,
        configData
      );

      request.log.info({
        operation: 'create_mcp_user_config',
        configId: userConfig.id,
        teamId,
        installationId,
        userId,
        authType
      }, 'Successfully created MCP user configuration');

      // Set status for user's instance to provide feedback
      const { mcpServerInstances } = getSchema();

      // First, check current instance status
      const [currentInstance] = await db.select()
        .from(mcpServerInstances)
        .where(
          and(
            eq(mcpServerInstances.installation_id, installationId),
            eq(mcpServerInstances.user_id, userId)
          )
        )
        .limit(1);

      // Determine appropriate status based on current state
      let newStatus: string;
      let statusMessage: string;

      if (currentInstance?.status === 'awaiting_user_config') {
        // User just configured required fields - trigger initial spawn
        newStatus = 'provisioning';
        statusMessage = 'User configuration completed';
      } else {
        // Configuration updated on running instance - trigger restart
        newStatus = 'restarting';
        statusMessage = 'Configuration updated, server restarting...';
      }

      await db.update(mcpServerInstances)
        .set({
          status: newStatus,
          status_message: statusMessage,
          status_updated_at: new Date()
        })
        .where(
          and(
            eq(mcpServerInstances.installation_id, installationId),
            eq(mcpServerInstances.user_id, userId)
          )
        );

      // Create satellite commands for immediate notification (spawn MCP server with new config)
      try {
        const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');
        const satelliteCommandService = new SatelliteCommandService(db, request.log);
        const commands = await satelliteCommandService.notifyMcpInstallation(
          installationId,
          teamId,
          userId
        );

        request.log.info({
          operation: 'create_mcp_user_config',
          installationId,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for user configuration creation');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for user config creation ${userConfig.id}:`);
        // Don't fail creation if command creation fails
      }

      const successResponse: UserConfigSuccessResponse = {
        success: true,
        data: formatUserConfigResponse(userConfig),
        message: 'User configuration created successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'create_mcp_user_config',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to create MCP user configuration');

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
