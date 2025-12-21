import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb } from '../../../db';
import { mcpServerInstallations } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  UPDATE_ENVIRONMENT_VARS_REQUEST_SCHEMA,
  INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type UpdateEnvironmentVariablesRequest,
  type InstallationData,
  type InstallationUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateEnvironmentVariablesRoute(server: FastifyInstance) {
  server.patch<{
    Params: TeamAndInstallationParams;
    Body: UpdateEnvironmentVariablesRequest;
  }>('/teams/:teamId/mcp/installations/:installationId/environment-variables', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.edit')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation environment variables',
      description: 'Updates the environment variables for an existing MCP server installation. This endpoint specifically handles environment variable updates only. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: UPDATE_ENVIRONMENT_VARS_REQUEST_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Environment variables updated successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
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
    
    const { team_env } = request.body as UpdateEnvironmentVariablesRequest;

    request.log.info({
      operation: 'update_mcp_installation_environment_variables',
      teamId,
      installationId,
      userId,
      authType,
      environmentVariableCount: Object.keys(team_env).length
    }, 'Updating MCP installation environment variables');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      // Update only the environment variables
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        { team_env }
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation_environment_variables',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for environment variables update');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation_environment_variables',
        teamId,
        installationId,
        userId,
        authType
      }, 'Successfully updated MCP installation environment variables');

      // Set status to 'restarting' immediately to provide user feedback
      await db.update(mcpServerInstallations)
        .set({
          status: 'restarting',
          status_message: 'Configuration updated, server restarting...',
          status_updated_at: new Date()
        })
        .where(
          and(
            eq(mcpServerInstallations.id, installationId),
            eq(mcpServerInstallations.team_id, teamId)
          )
        );

      // Create satellite commands for immediate notification (3-second response goal)
      try {
        const satelliteCommandService = new SatelliteCommandService(db, request.log);
        const commands = await satelliteCommandService.notifyMcpUpdate(
          installationId,
          teamId,
          userId
        );
        
        request.log.info({
          operation: 'update_mcp_installation_environment_variables',
          installationId,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for MCP installation environment variables update');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for installation environment variables update ${installationId}:`);
        // Don't fail update if command creation fails
      }

      const successResponse: InstallationUpdateSuccessResponse = {
        success: true,
        data: formatInstallationResponse(updatedInstallation as InstallationData),
        message: 'Environment variables updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation_environment_variables',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation environment variables');

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
