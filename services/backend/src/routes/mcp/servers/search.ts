import { type FastifyInstance } from 'fastify';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requirePermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import {
  SEARCH_SERVERS_QUERY_SCHEMA,
  LIST_SERVERS_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ListServersQueryParams,
  type ListServersSuccessResponse,
  type ErrorResponse,
  type CategoryEmbed,
  formatServerListResponse
} from './schemas';

// TypeScript interface for search query params
interface SearchServersQueryParams extends Omit<ListServersQueryParams, 'search'> {
  q: string; // Search query is required for search endpoint
  tags?: string; // Optional comma-separated tags filter
  sort_by?: 'name' | 'github_stars'; // Optional sort parameter
  source?: 'official_registry' | 'manual'; // Optional source filter
}

export default async function searchServers(server: FastifyInstance) {
  server.get('/mcp/servers/search', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Search MCP servers',
      description: 'Search MCP servers by query string with optional filters. Authentication is required. Results are filtered based on user permissions - users see global servers plus their team servers, while global admins see all servers.',
      security: [{ cookieAuth: [] }],
      
      querystring: SEARCH_SERVERS_QUERY_SCHEMA,
      
      response: {
        200: {
          ...LIST_SERVERS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Search results retrieved successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid query parameters'
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
    const queryParams = request.query as SearchServersQueryParams;
    
    request.log.info({
      operation: 'search_mcp_servers',
      userId: request.user?.id,
      query: queryParams.q,
      filters: {
        category_id: queryParams.category_id,
        language: queryParams.language,
        runtime: queryParams.runtime,
        status: queryParams.status,
        source: queryParams.source,
        featured: queryParams.featured,
        tags: queryParams.tags
      },
      sortBy: queryParams.sort_by,
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset
      }
    }, 'Searching MCP servers');

    try {
      const db = getDb();
      const schema = getSchema();
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
          operation: 'search_mcp_servers',
          userId: request.user!.id,
          teamError
        }, 'Failed to get user teams, continuing with empty team list');
        teamIds = [];
      }

      // Parse and validate parameters
      const limit = parseInt(queryParams.limit || '20') || 20;
      const offset = parseInt(queryParams.offset || '0') || 0;
      const featured = queryParams.featured === 'true' ? true : queryParams.featured === 'false' ? false : undefined;
      const status = queryParams.status as 'active' | 'deprecated' | 'maintenance' | 'disabled' | undefined;
      const sortBy = (queryParams.sort_by as 'name' | 'github_stars') || 'name';

      // Build filters object - use 'search' internally (service expects 'search', not 'q')
      const filters = {
        search: queryParams.q, // Map 'q' parameter to 'search' for service
        category_id: queryParams.category_id,
        language: queryParams.language,
        runtime: queryParams.runtime,
        status: status,
        featured: featured,
        tags: queryParams.tags,
        source: queryParams.source
      };

      // Get servers using the service (which handles permission filtering)
      const allServers = await mcpService.getServersForUser(
        request.user!.id,
        userRole,
        teamIds,
        filters,
        sortBy
      );

      // Fetch all categories and build a lookup map
      const categories = await db.select().from(schema.mcpCategories);
      const categoriesMap = new Map<string, CategoryEmbed>();
      for (const cat of categories) {
        categoriesMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          icon: cat.icon || null
        });
      }

      // Apply pagination
      const total = allServers.length;
      const paginatedServers = allServers.slice(offset, offset + limit);

      request.log.info({
        operation: 'search_mcp_servers',
        userId: request.user!.id,
        query: queryParams.q,
        tags: queryParams.tags,
        sortBy: sortBy,
        totalResults: total,
        returnedResults: paginatedServers.length,
        userRole,
        teamCount: teamIds.length
      }, 'MCP server search completed');

      // Format response using minimal list formatter (excludes config schemas, packages, etc.)
      const responseServers = paginatedServers.map(server => formatServerListResponse(server, categoriesMap));

      // Use the same response structure as list endpoint
      const response: ListServersSuccessResponse = {
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
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'search_mcp_servers',
        userId: request.user!.id,
        query: queryParams.q,
        error
      }, 'Failed to search MCP servers');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to search MCP servers'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
