import { type FastifyInstance } from 'fastify';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import {
  LIST_SERVERS_QUERY_SCHEMA,
  LIST_SERVERS_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ListServersQueryParams,
  type ListServersSuccessResponse,
  type ErrorResponse,
  formatServerListResponse
} from './schemas';

export default async function listServers(server: FastifyInstance) {
  server.get('/mcp/servers', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Servers'],
      summary: 'List MCP servers',
      description: 'Retrieve MCP servers visible to the current user based on their permissions with pagination support. Authentication is required. Supports filtering by category, language, runtime, status, featured flag, and search query. Results are paginated with configurable limit (1-100, default: 20) and offset (default: 0).',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      querystring: LIST_SERVERS_QUERY_SCHEMA,
      
      response: {
        200: {
          ...LIST_SERVERS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Successful server list retrieval'
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
    try {
      const db = getDb();
      const catalogService = new McpCatalogService(db, request.log);
      
      // Get user role and team memberships (same as search endpoint)
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
          operation: 'list_mcp_servers',
          userId: request.user!.id,
          teamError
        }, 'Failed to get user teams, continuing with empty team list');
        teamIds = [];
      }

      // Parse query parameters for filtering (Fastify has already validated)
      const query = request.query as ListServersQueryParams;
      
      // Build filters object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: any = {};
      
      if (query.category_id) {
        filters.category_id = query.category_id;
      }
      
      if (query.language) {
        filters.language = query.language;
      }
      
      if (query.runtime) {
        filters.runtime = query.runtime;
      }
      
      if (query.status) {
        filters.status = query.status;
      }
      
      if (query.featured) {
        filters.featured = query.featured === 'true';
      }
      
      if (query.search) {
        filters.search = query.search;
      }

      // Get servers using the service (which handles permission filtering)
      const allServers = await catalogService.getServersForUser(
        request.user!.id,
        userRole,
        teamIds,
        filters
      );

      // Parse pagination parameters (already validated by Fastify)
      const limit = parseInt(query.limit || '20');
      const offset = parseInt(query.offset || '0');
      
      // Apply pagination
      const total = allServers.length;
      const paginatedServers = allServers.slice(offset, offset + limit);

      request.log.info({
        operation: 'list_mcp_servers',
        userId: request.user!.id,
        totalResults: total,
        returnedResults: paginatedServers.length,
        userRole,
        teamCount: teamIds.length,
        appliedFilters: filters
      }, 'MCP server list completed');

      // Format response using minimal list formatter (excludes config schemas, packages, etc.)
      const responseServers = paginatedServers.map(server => formatServerListResponse(server));

      // Manual JSON serialization to ensure consistent JSON output
      const successResponse: ListServersSuccessResponse = {
        success: true,
        data: {
          servers: responseServers,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          }
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } catch (error: any) {
      request.log.error({
        operation: 'list_servers',
        userId: request.user?.id,
        error: error.message || error,
        stack: error.stack
      }, 'Failed to list MCP servers');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: error.message || 'Failed to retrieve servers'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}