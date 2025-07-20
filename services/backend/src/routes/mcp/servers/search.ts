import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';



// Response schema for search results
const searchServersResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    servers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      description: z.string(),
      long_description: z.string().nullable(),
      github_url: z.string().nullable(),
      git_branch: z.string().nullable(),
      homepage_url: z.string().nullable(),
      language: z.string(),
      runtime: z.string(),
      runtime_min_version: z.string().nullable(),
      installation_methods: z.array(z.any()),
      tools: z.array(z.any()),
      resources: z.array(z.any()).nullable(),
      prompts: z.array(z.any()).nullable(),
      visibility: z.enum(['global', 'team']),
      owner_team_id: z.string().nullable(),
      created_by: z.string(),
      author_name: z.string().nullable(),
      author_contact: z.string().nullable(),
      organization: z.string().nullable(),
      license: z.string().nullable(),
      default_config: z.record(z.string(), z.any()).nullable(),
      environment_variables: z.array(z.any()).nullable(),
      dependencies: z.record(z.string(), z.any()).nullable(),
      category_id: z.string().nullable(),
      tags: z.array(z.string()).nullable(),
      status: z.enum(['active', 'deprecated', 'maintenance']),
      featured: z.boolean(),
      created_at: z.string(),
      updated_at: z.string(),
      last_sync_at: z.string().nullable()
    })),
    pagination: z.object({
      total: z.number(),
      limit: z.number(),
      offset: z.number(),
      has_more: z.boolean()
    }),
    filters: z.object({
      query: z.string(),
      category: z.string().nullable(),
      language: z.string().nullable(),
      runtime: z.string().nullable(),
      status: z.string().nullable(),
      featured: z.boolean().nullable()
    })
  })
});

// Error response schema
const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string(),
  details: z.any().optional()
});

export default async function searchServers(server: FastifyInstance) {
  server.get('/mcp/servers/search', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Search MCP servers',
      description: 'Search MCP servers by query string with optional filters. Authentication is required. Results are filtered based on user permissions - users see global servers plus their team servers, while global admins see all servers.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      querystring: {
      type: 'object',
      properties: {
      q: { type: 'string', minLength: 1, maxLength: 255 },
      category_id: { type: 'string' },
      language: { type: 'string' },
      runtime: { type: 'string' },
      status: { type: 'string', enum: ['active', 'deprecated', 'maintenance'] },
      featured: { type: 'string', enum: ['true', 'false'] },
      limit: { type: 'string', pattern: '^\\d+$' },
      offset: { type: 'string', pattern: '^\\d+$' }
      },
      required: ['q'],
      additionalProperties: false
      },
      response: {
        200: createSchema(searchServersResponseSchema),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid query parameters')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('mcp.servers.read')
  }, async (request, reply) => {
    const queryParams = request.query as {
      q?: string;
      category_id?: string;
      language?: string;
      runtime?: string;
      status?: string;
      featured?: string;
      limit?: string;
      offset?: string;
    };
    
    request.log.info({
      operation: 'search_mcp_servers',
      userId: request.user?.id,
      query: queryParams.q,
      filters: {
        category_id: queryParams.category_id,
        language: queryParams.language,
        runtime: queryParams.runtime,
        status: queryParams.status,
        featured: queryParams.featured
      },
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset
      }
    }, 'Searching MCP servers');

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
      const status = queryParams.status as 'active' | 'deprecated' | 'maintenance' | undefined;

      // Build filters object
      const filters = {
        search: queryParams.q,
        category_id: queryParams.category_id,
        language: queryParams.language,
        runtime: queryParams.runtime,
        status: status,
        featured: featured
      };

      // Get servers using the service (which handles permission filtering)
      const allServers = await mcpService.getServersForUser(
        request.user!.id,
        userRole,
        teamIds,
        filters
      );

      // Apply pagination
      const total = allServers.length;
      const paginatedServers = allServers.slice(offset, offset + limit);

      request.log.info({
        operation: 'search_mcp_servers',
        userId: request.user!.id,
        query: queryParams.q,
        totalResults: total,
        returnedResults: paginatedServers.length,
        userRole,
        teamCount: teamIds.length
      }, 'MCP server search completed');

      // Format dates for response (JSON fields are already parsed by the service)
      const responseServers = paginatedServers.map(server => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatDate = (date: any) => {
          if (!date) return null;
          try {
            // Handle both Date objects and timestamp numbers
            if (typeof date === 'number') {
              return new Date(date).toISOString();
            }
            if (date instanceof Date) {
              return date.toISOString();
            }
            return new Date(date).toISOString();
          } catch (error) {
            request.log.warn({
              operation: 'search_mcp_servers',
              serverId: server.id,
              field: 'date_format_error',
              dateValue: date,
              error
            }, 'Failed to format date field, using null');
            return null;
          }
        };

        return {
          ...server,
          created_at: formatDate(server.created_at),
          updated_at: formatDate(server.updated_at),
          last_sync_at: formatDate(server.last_sync_at)
        };
      });

      // Manual JSON serialization to avoid serialization issues
      const successResponse = {
        success: true,
        data: {
          servers: responseServers,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          },
          filters: {
            query: queryParams.q,
            category: queryParams.category_id || null,
            language: queryParams.language || null,
            runtime: queryParams.runtime || null,
            status: queryParams.status || null,
            featured: featured || null
          }
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'search_mcp_servers',
        userId: request.user!.id,
        query: queryParams.q,
        error
      }, 'Failed to search MCP servers');

      const errorResponse = {
        success: false,
        error: 'Failed to search MCP servers'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
