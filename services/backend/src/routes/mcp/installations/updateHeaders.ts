import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb, getSchema } from '../../../db';
import { eq, and, sql } from 'drizzle-orm';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  UPDATE_HEADERS_REQUEST_SCHEMA,
  INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type UpdateHeadersRequest,
  type InstallationData,
  type InstallationUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateHeadersRoute(server: FastifyInstance) {
  server.patch<{
    Params: TeamAndInstallationParams;
    Body: UpdateHeadersRequest;
  }>('/teams/:teamId/mcp/installations/:installationId/headers', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.edit')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation headers',
      description: 'Updates the headers for an existing MCP server installation. This endpoint specifically handles headers updates only. Requires Content-Type: application/json header when sending request body.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: UPDATE_HEADERS_REQUEST_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Headers updated successfully'
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
    
    const { team_headers } = request.body as UpdateHeadersRequest;

    request.log.info({
      operation: 'update_mcp_installation_headers',
      teamId,
      installationId,
      userId,
      authType,
      headerCount: Object.keys(team_headers).length
    }, 'Updating MCP installation headers');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      // Update only the headers
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        { team_headers }
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation_headers',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for headers update');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation_headers',
        teamId,
        installationId,
        userId,
        authType
      }, 'Successfully updated MCP installation headers');

      // Set status to 'restarting' for instances that are ready to spawn
      // Exclude instances awaiting user configuration
      const { mcpServerInstances } = getSchema();
      await db.update(mcpServerInstances)
        .set({
          status: 'restarting',
          status_message: 'Configuration updated, server restarting...',
          status_updated_at: new Date()
        })
        .where(
          and(
            eq(mcpServerInstances.installation_id, installationId),
            // Only update instances that have user config (exclude awaiting_user_config)
            // These instances will update when user completes their config
            sql`${mcpServerInstances.status} != 'awaiting_user_config'`
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
          operation: 'update_mcp_installation_headers',
          installationId,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for MCP installation headers update');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for installation headers update ${installationId}:`);
        // Don't fail update if command creation fails
      }

      const successResponse: InstallationUpdateSuccessResponse = {
        success: true,
        data: formatInstallationResponse(updatedInstallation as InstallationData),
        message: 'Headers updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation_headers',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation headers');

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
