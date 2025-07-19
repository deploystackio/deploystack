import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole, requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';

// Query parameters schema
const querySchema = z.object({
  category_id: z.string().optional(),
  language: z.string().optional(),
  runtime: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'maintenance']).optional(),
  featured: z.boolean().optional(),
  search: z.string().optional(),
  // Pagination parameters
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional().default(20),
  offset: z.string().regex(/^\d+$/, 'Offset must be a number').transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional().default(0)
});

// Response schema
const serverSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  long_description: z.string().nullable(),
  github_url: z.string().nullable(),
  homepage_url: z.string().nullable(),
  language: z.string(),
  runtime: z.string(),
  runtime_min_version: z.string().nullable(),
  installation_methods: z.string(), // JSON string
  tools: z.string(), // JSON string
  resources: z.string().nullable(), // JSON string
  prompts: z.string().nullable(), // JSON string
  visibility: z.enum(['global', 'team']),
  owner_team_id: z.string().nullable(),
  author_name: z.string().nullable(),
  author_contact: z.string().nullable(),
  organization: z.string().nullable(),
  license: z.string().nullable(),
  category_id: z.string().nullable(),
  tags: z.string().nullable(), // JSON string
  status: z.enum(['active', 'deprecated', 'maintenance']),
  featured: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_sync_at: z.string().nullable()
});

const listServersResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    servers: z.array(serverSchema),
    pagination: z.object({
      total: z.number(),
      limit: z.number(),
      offset: z.number(),
      has_more: z.boolean()
    })
  })
});

const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string()
});

export default async function listServers(server: FastifyInstance) {
  server.get('/mcp/servers', {
    preValidation: requirePermission('mcp.servers.read'),
    schema: {
      tags: ['MCP Servers'],
      summary: 'List MCP servers',
      description: 'Retrieve MCP servers visible to the current user based on their permissions with pagination support. Authentication is required. Supports filtering by category, language, runtime, status, featured flag, and search query. Results are paginated with configurable limit (1-100, default: 20) and offset (default: 0).',
      security: [{ cookieAuth: [] }],
      querystring: zodToJsonSchema(querySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(listServersResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    validatorCompiler: () => () => true, // Disable validation but keep schema for docs
    serializerCompiler: () => (data) => JSON.stringify(data) // Disable response validation
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

      // Get servers using the service (which handles permission filtering)
      const allServers = await catalogService.getServersForUser(
        request.user!.id,
        userRole,
        teamIds,
        {} // No filters for now
      );

      // Parse query parameters for pagination
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const query = request.query as any;
      const limit = parseInt(query.limit) || 20;
      const offset = parseInt(query.offset) || 0;
      
      // Apply pagination
      const total = allServers.length;
      const paginatedServers = allServers.slice(offset, offset + limit);

      request.log.info({
        operation: 'list_mcp_servers',
        userId: request.user!.id,
        totalResults: total,
        returnedResults: paginatedServers.length,
        userRole,
        teamCount: teamIds.length
      }, 'MCP server list completed');

      // Format dates for response (same as search endpoint)
      const responseServers = paginatedServers.map(server => {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
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
              operation: 'list_mcp_servers',
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

      // Return the format your frontend expects
      return reply.send({
        data: {
          servers: responseServers,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          }
        }
      });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } catch (error: any) {
      request.log.error({
        operation: 'list_servers',
        userId: request.user?.id,
        error: error.message || error,
        stack: error.stack
      }, 'Failed to list MCP servers');
      
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve servers'
      });
    }
  });
}
