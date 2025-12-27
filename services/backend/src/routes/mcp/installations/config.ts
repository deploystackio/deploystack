import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { getDb } from '../../../db';
import {
  CLIENT_CONFIG_PARAMS_SCHEMA,
  CLIENT_CONFIG_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  type ClientConfigParams,
  type ClientConfigSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getClientConfigRoute(server: FastifyInstance) {
  server.get('/teams/:teamId/mcp/installations/:installationId/config/:clientType', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Get client configuration for installation',
      description: 'Generates client-specific configuration for an MCP server installation. Supports claude-desktop, vscode, and cursor clients. No Content-Type header required for this GET request.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: CLIENT_CONFIG_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...CLIENT_CONFIG_SUCCESS_RESPONSE_SCHEMA,
          description: 'Client configuration generated successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId, installationId, clientType } = request.params as ClientConfigParams;
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

    request.log.info({
      operation: 'get_client_config',
      teamId,
      installationId,
      clientType,
      userId,
      authType
    }, 'Generating client configuration for MCP installation');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      
      const config = await installationService.generateClientConfig(
        installationId,
        teamId,
        clientType as 'claude-desktop' | 'vscode' | 'cursor'
      );

      request.log.info({
        operation: 'get_client_config',
        teamId,
        installationId,
        clientType,
        userId,
      authType
      }, 'Client configuration generated successfully');

      const response: ClientConfigSuccessResponse = {
        success: true,
        data: config
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_client_config',
        error,
        teamId,
        installationId,
        clientType,
        userId
      }, 'Failed to generate client configuration');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('not found')) {
        const notFoundResponse: ErrorResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (errorMessage.includes('Unsupported client type') || 
          errorMessage.includes('does not support')) {
        const badRequestResponse: ErrorResponse = {
          success: false,
          error: errorMessage
        };
        const jsonString = JSON.stringify(badRequestResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
