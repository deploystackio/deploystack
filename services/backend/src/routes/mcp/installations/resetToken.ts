import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { McpInstanceService } from '../../../services/mcpInstanceService';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  RESET_TOKEN_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  type TeamAndInstallationParams,
  type ResetTokenSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function resetTokenRoute(server: FastifyInstance) {
  server.post('/teams/:teamId/mcp/installations/:installationId/reset-token', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Reset instance connection token',
      description: 'Regenerates the connection token for the current user\'s instance. The old token is immediately invalidated.',
      security: DUAL_AUTH_SECURITY,
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      response: {
        200: {
          ...RESET_TOKEN_SUCCESS_RESPONSE_SCHEMA,
          description: 'Token reset successfully'
        },
        ...COMMON_ERROR_RESPONSES,
        404: {
          ...COMMON_ERROR_RESPONSES[404],
          description: 'No instance found for this user and installation'
        }
      }
    }
  }, async (request, reply) => {
    const { installationId } = request.params as TeamAndInstallationParams;
    const userId = request.user!.id;

    request.log.info({
      operation: 'reset_instance_token',
      installationId,
      userId
    }, 'Resetting instance connection token');

    try {
      const db = getDb();
      const instanceService = new McpInstanceService(db, request.log);

      const result = await instanceService.resetInstanceToken(installationId, userId);

      if (!result) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'No instance found for this user and installation'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: ResetTokenSuccessResponse = {
        success: true,
        data: {
          instance_token: result.instanceToken
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'reset_instance_token',
        installationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to reset instance token');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset instance token'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
