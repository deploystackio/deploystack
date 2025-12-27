import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb } from '../../../db';
import { mcpServerInstallations } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  UPDATE_ARGS_REQUEST_SCHEMA,
  INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type UpdateArgsRequest,
  type InstallationData,
  type InstallationUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateArgsRoute(server: FastifyInstance) {
  server.patch<{
    Params: TeamAndInstallationParams;
    Body: UpdateArgsRequest;
  }>('/teams/:teamId/mcp/installations/:installationId/args', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.edit')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation command line arguments',
      description: 'Updates the command line arguments for an existing MCP server installation. This endpoint specifically handles args updates only. Requires Content-Type: application/json header when sending request body.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: UPDATE_ARGS_REQUEST_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Command line arguments updated successfully'
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
    
    const { args } = request.body as UpdateArgsRequest;

    request.log.info({
      operation: 'update_mcp_installation_args',
      teamId,
      installationId,
      userId,
      authType,
      argsCount: args.length
    }, 'Updating MCP installation command line arguments');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      // Update only the command line arguments
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        { team_args: args }
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation_args',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for args update');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation_args',
        teamId,
        installationId,
        userId,
        authType
      }, 'Successfully updated MCP installation command line arguments');

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
          operation: 'update_mcp_installation_args',
          installationId,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for MCP installation args update');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for installation args update ${installationId}:`);
        // Don't fail update if command creation fails
      }

      const successResponse: InstallationUpdateSuccessResponse = {
        success: true,
        data: formatInstallationResponse(updatedInstallation as InstallationData),
        message: 'Command line arguments updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation_args',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation command line arguments');

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
