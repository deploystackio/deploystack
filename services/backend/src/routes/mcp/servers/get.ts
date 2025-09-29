import { type FastifyInstance } from 'fastify';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requireAuthentication } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import {
  SERVER_ID_PARAM_SCHEMA,
  GET_SERVER_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ServerIdParams,
  type GetServerSuccessResponse,
  type GetServerEntity,
  type ErrorResponse,
  formatServerResponse
} from './schemas';

export default async function getServer(server: FastifyInstance) {
  server.get('/mcp/servers/:id', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Get MCP server by ID',
      description: 'Retrieve a specific MCP server by its ID. Access is controlled based on user role and team membership - users can access global servers and their team servers, while global admins can access all servers.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: SERVER_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...GET_SERVER_SUCCESS_RESPONSE_SCHEMA,
          description: 'Server retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Server not found or access denied'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { id: serverId } = request.params as ServerIdParams;
    
    request.log.info({
      operation: 'get_mcp_server',
      userId: request.user?.id,
      serverId
    }, 'Getting MCP server by ID');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);
      
      // Get user role and team memberships
      const roleInfo = await getUserRole(request.user!.id);
      const userRole = roleInfo?.id || 'global_user';
      
      // Get user's team memberships
      let teamIds: string[] = [];
      try {
        const userTeams = await TeamService.getUserTeams(request.user!.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        teamIds = userTeams.map((team: any) => team.id);
      } catch (teamError) {
        request.log.warn({
          operation: 'get_mcp_server',
          userId: request.user!.id,
          serverId,
          teamError
        }, 'Failed to get user teams, continuing with empty team list');
        teamIds = [];
      }

      // Get the server by ID
      const server = await mcpService.getServerById(serverId);
      
      if (!server) {
        request.log.info({
          operation: 'get_mcp_server',
          userId: request.user!.id,
          serverId,
          userRole
        }, 'MCP server not found');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check access permissions
      let hasAccess = false;

      if (userRole === 'global_admin') {
        // Global admin can access all servers
        hasAccess = true;
      } else if (server.visibility === 'global') {
        // All authenticated users can access global servers
        hasAccess = true;
      } else if (server.visibility === 'team' && server.owner_team_id) {
        // Team servers: check if user is a member of the owning team
        hasAccess = teamIds.includes(server.owner_team_id);
      }

      if (!hasAccess) {
        request.log.info({
          operation: 'get_mcp_server',
          userId: request.user!.id,
          serverId,
          userRole,
          serverVisibility: server.visibility,
          serverOwnerTeamId: server.owner_team_id,
          userTeamIds: teamIds
        }, 'Access denied to MCP server');

        // Return 404 instead of 403 to avoid information disclosure
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'get_mcp_server',
        userId: request.user!.id,
        serverId,
        userRole,
        serverVisibility: server.visibility,
        teamCount: teamIds.length
      }, 'MCP server access granted');

      // Format the server response using the shared utility function
      const responseServer = formatServerResponse(server);

      // Extend with GET-specific fields
      const getServerEntity: GetServerEntity = {
        ...responseServer,
        github_readme_base64: server.github_readme_base64 || null
      };

      const response: GetServerSuccessResponse = {
        success: true,
        data: getServerEntity
      };

      // Manual JSON serialization to ensure consistent JSON output
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      request.log.error({
        operation: 'get_mcp_server',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to get MCP server');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to get MCP server'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
