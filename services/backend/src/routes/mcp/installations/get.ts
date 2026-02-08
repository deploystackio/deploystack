import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { McpInstanceService } from '../../../services/mcpInstanceService';
import { getDb } from '../../../db';
import { decryptInstanceToken } from '../../../utils/instancePathGenerator';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  INSTALLATION_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  formatInstancesResponse,
  type TeamAndInstallationParams,
  type InstallationData,
  type InstallationSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getInstallationRoute(server: FastifyInstance) {
  server.get('/teams/:teamId/mcp/installations/:installationId', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Get MCP installation by ID',
      description: 'Retrieves a specific MCP server installation by ID for the specified team. No Content-Type header required for this GET request.',
      security: DUAL_AUTH_SECURITY,
      
      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...INSTALLATION_SUCCESS_RESPONSE_SCHEMA,
          description: 'Installation details'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId, installationId } = request.params as TeamAndInstallationParams;
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
      operation: 'get_mcp_installation',
      teamId,
      installationId,
      userId,
      authType
    }, 'Getting MCP installation by ID');

    try {
      const db = getDb();
      const installationService = new McpInstallationService(db, request.log);
      const instanceService = new McpInstanceService(db, request.log);

      const installation = await installationService.getInstallationById(installationId, teamId) as InstallationData | null;

      if (!installation) {
        request.log.warn({
          operation: 'get_mcp_installation',
          teamId,
          installationId,
          userId
        }, 'MCP installation not found');

        const notFoundResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Fetch per-user instances with user information
      const instances = await instanceService.getInstancesWithUsersByInstallation(installationId, teamId);

      // Resolve satellite URL from satellite_id
      let satelliteUrl: string | null = null;
      const installationAny = installation as InstallationData & { satellite_id?: string };
      if (installationAny.satellite_id) {
        try {
          const schema = await import('../../../db/schema');
          const { satellites } = schema;
          const sat = await db
            .select({ satellite_url: satellites.satellite_url })
            .from(satellites)
            .where(eq(satellites.id, installationAny.satellite_id))
            .limit(1);
          satelliteUrl = sat[0]?.satellite_url || null;
        } catch (error) {
          request.log.warn({
            satelliteId: installationAny.satellite_id,
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to resolve satellite URL');
        }
      }

      // Format instances and enrich current user's instance with decrypted token
      const formattedInstances = formatInstancesResponse(instances);
      for (const inst of formattedInstances) {
        if (inst.user_id === userId) {
          const rawInstance = instances.find(i => i.id === inst.id);
          if (rawInstance?.instance_token) {
            const plaintext = decryptInstanceToken(rawInstance.instance_token, request.log);
            inst.instance_token = plaintext;
          }
        }
        // Other users' tokens are never exposed
      }

      request.log.info({
        operation: 'get_mcp_installation',
        teamId,
        installationId,
        userId,
        authType,
        instanceCount: instances.length
      }, 'Retrieved MCP installation with instances');

      const response: InstallationSuccessResponse = {
        success: true,
        data: {
          ...formatInstallationResponse(installation),
          satellite_id: installationAny.satellite_id || null,
          satellite_url: satelliteUrl,
          instances: formattedInstances
        }
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_mcp_installation',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to get MCP installation');

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
