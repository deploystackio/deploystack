import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb } from '../../../db';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  UPDATE_INSTALLATION_REQUEST_SCHEMA,
  INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type UpdateInstallationRequest,
  type InstallationData,
  type InstallationUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';

export default async function updateInstallationRoute(server: FastifyInstance) {
  server.put<{
    Params: TeamAndInstallationParams;
    Body: UpdateInstallationRequest;
  }>('/teams/:teamId/mcp/installations/:installationId', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.edit')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update MCP installation',
      description: 'Updates an existing MCP server installation. Can update installation name and environment variables. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: UPDATE_INSTALLATION_REQUEST_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Installation updated successfully'
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
    const updateData = request.body as UpdateInstallationRequest;

    request.log.info({
      operation: 'update_mcp_installation',
      teamId,
      installationId,
      userId,
      authType,
      updateFields: Object.keys(updateData)
    }, 'Updating MCP installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const updatedInstallation = await installationService.updateInstallation(
        installationId,
        teamId,
        userId,
        updateData
      );

      if (!updatedInstallation) {
        request.log.warn({
          operation: 'update_mcp_installation',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found for update');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_mcp_installation',
        teamId,
        installationId,
        userId,
        authType
      }, 'Successfully updated MCP installation');

      // Create satellite commands for immediate notification (3-second response goal)
      try {
        const satelliteCommandService = new SatelliteCommandService(db, request.log);
        const commands = await satelliteCommandService.notifyMcpUpdate(
          installationId,
          teamId,
          userId
        );
        
        request.log.info({
          operation: 'update_mcp_installation',
          installationId,
          commandsCreated: commands.length,
          satelliteIds: commands.map(c => c.satellite_id)
        }, 'Satellite commands created for MCP installation update');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for installation update ${installationId}:`);
        // Don't fail update if command creation fails
      }

      // Emit MCP_INSTALLATION_UPDATED event
      try {
        const eventContext: EventContext = {
          db,
          logger: request.log,
          user: {
            id: userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        const installation = updatedInstallation as InstallationData;
        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_INSTALLATION_UPDATED,
          {
            installation: {
              id: installation.id,
              serverId: installation.server_id,
              teamId: teamId
            },
            updatedBy: {
              id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            changes: updateData,
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_INSTALLATION_UPDATED event emitted for installation: ${installationId}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_INSTALLATION_UPDATED event for installation ${installationId}:`);
        // Don't fail update if event emission fails
      }

      const successResponse: InstallationUpdateSuccessResponse = {
        success: true,
        data: formatInstallationResponse(updatedInstallation as InstallationData),
        message: 'Installation updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update MCP installation');

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
