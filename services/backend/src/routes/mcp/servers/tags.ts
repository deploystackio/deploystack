import { type FastifyInstance } from 'fastify';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import {
  GET_TAGS_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type GetTagsSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getTags(server: FastifyInstance) {
  server.get('/mcp/servers/tags', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Get all unique tags',
      description: 'Retrieve all unique tags from MCP servers. Authentication is required. Results are filtered based on user permissions - users see tags from global servers plus their team servers, while global admins see tags from all servers.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...GET_TAGS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Tags retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    request.log.info({
      operation: 'get_mcp_server_tags',
      userId: request.user?.id
    }, 'Getting unique MCP server tags');

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
          operation: 'get_mcp_server_tags',
          userId: request.user!.id,
          teamError
        }, 'Failed to get user teams, continuing with empty team list');
        teamIds = [];
      }

      // Get unique tags using the service
      const tags = await mcpService.getTagsForUser(
        request.user!.id,
        userRole,
        teamIds
      );

      request.log.info({
        operation: 'get_mcp_server_tags',
        userId: request.user!.id,
        userRole,
        teamCount: teamIds.length,
        uniqueTagsCount: tags.length
      }, 'MCP server tags retrieval completed');

      const response: GetTagsSuccessResponse = {
        success: true,
        data: {
          tags,
          total: tags.length
        }
      };
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'get_mcp_server_tags',
        userId: request.user!.id,
        error
      }, 'Failed to get MCP server tags');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to get MCP server tags'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
