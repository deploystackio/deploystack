import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';

// Query parameters schema
const searchServersQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(255, 'Search query must be 255 characters or less'),
  category: z.string().optional(),
  language: z.string().optional(),
  runtime: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'maintenance']).optional(),
  featured: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional().default(20),
  offset: z.string().regex(/^\d+$/, 'Offset must be a number').transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional().default(0)
});

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
      querystring: zodToJsonSchema(searchServersQuerySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(searchServersResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid query parameters'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preValidation: requirePermission('mcp.servers.read')
  }, async (request, reply) => {
    const queryParams = request.query as z.infer<typeof searchServersQuerySchema>;
    
    request.log.info({
      operation: 'search_mcp_servers',
      userId: request.user?.id,
      query: queryParams.q,
      filters: {
        category: queryParams.category,
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

      // Build filters object
      const filters = {
        search: queryParams.q,
        category_id: queryParams.category,
        language: queryParams.language,
        runtime: queryParams.runtime,
        status: queryParams.status,
        featured: queryParams.featured
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
      const paginatedServers = allServers.slice(queryParams.offset, queryParams.offset + queryParams.limit);

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

      return reply.status(200).send({
        success: true,
        data: {
          servers: responseServers,
          pagination: {
            total,
            limit: queryParams.limit,
            offset: queryParams.offset,
            has_more: queryParams.offset + queryParams.limit < total
          },
          filters: {
            query: queryParams.q,
            category: queryParams.category || null,
            language: queryParams.language || null,
            runtime: queryParams.runtime || null,
            status: queryParams.status || null,
            featured: queryParams.featured || null
          }
        }
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'search_mcp_servers',
        userId: request.user!.id,
        query: queryParams.q,
        error
      }, 'Failed to search MCP servers');

      return reply.status(500).send({
        success: false,
        error: 'Failed to search MCP servers'
      });
    }
  });
}
