import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb, getSchema } from '../../../db';
import { eq, and, sql } from 'drizzle-orm';
import { validateQueryParams } from '../../../lib/security';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  UPDATE_QUERY_PARAMS_REQUEST_SCHEMA,
  INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type UpdateQueryParamsRequest,
  type InstallationData,
  type InstallationUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateQueryParamsRoute(server: FastifyInstance) {
  server.patch<{
    Params: TeamAndInstallationParams;
    Body: UpdateQueryParamsRequest;
  }>('/teams/:teamId/mcp/installations/:installationId/query-params', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.edit')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation query parameters',
      description: 'Updates the URL query parameters for an existing MCP server installation. This endpoint specifically handles query parameters updates only. Requires Content-Type: application/json header when sending request body.',
      security: DUAL_AUTH_SECURITY,

      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: UPDATE_QUERY_PARAMS_REQUEST_SCHEMA,

      response: {
        200: {
          ...INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Query parameters updated successfully'
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

    const { team_url_query_params } = request.body as UpdateQueryParamsRequest;

    request.log.info({
      operation: 'update_mcp_installation_query_params',
      teamId,
      installationId,
      userId,
      authType,
      queryParamCount: Object.keys(team_url_query_params).length
    }, 'Updating MCP installation query parameters');

    try {
      // Security validation: Validate query parameters
      if (Object.keys(team_url_query_params).length > 0) {
        const queryParamsValidation = validateQueryParams(team_url_query_params);
        if (!queryParamsValidation.valid) {
          request.log.warn({
            operation: 'update_mcp_installation_query_params_security_validation',
            teamId,
            installationId,
            userId,
            error: queryParamsValidation.error,
            details: queryParamsValidation.details
          }, 'Security validation failed for team_url_query_params');

          const errorResponse: ErrorResponse = {
            success: false,
            error: queryParamsValidation.error!
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);

      // Update only the query parameters
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        { team_url_query_params }
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation_query_params',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for query parameters update');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation_query_params',
        teamId,
        installationId,
        userId,
        authType
      }, 'Successfully updated MCP installation query parameters');

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
          operation: 'update_mcp_installation_query_params',
          installationId,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for MCP installation query parameters update');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for installation query parameters update ${installationId}:`);
        // Don't fail update if command creation fails
      }

      const successResponse: InstallationUpdateSuccessResponse = {
        success: true,
        data: formatInstallationResponse(updatedInstallation as InstallationData),
        message: 'Query parameters updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation_query_params',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation query parameters');

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
