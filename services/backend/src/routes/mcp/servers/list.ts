import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getDb } from '../../../db';
import { getUserRole } from '../../../middleware/roleMiddleware';

// Query parameters schema
const querySchema = z.object({
  category_id: z.string().optional(),
  language: z.string().optional(),
  runtime: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'maintenance']).optional(),
  featured: z.boolean().optional(),
  search: z.string().optional(),
  // Pagination parameters
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional().default('20'),
  offset: z.string().regex(/^\d+$/, 'Offset must be a number').transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional().default('0')
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
    preValidation: async (request, reply) => {
      // Require authentication for all MCP server access
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb();
      const catalogService = new McpCatalogService(db, server.log);
      
      // Parse query parameters
      const filters = querySchema.parse(request.query);
      
      // Get user info from authenticated request
      const userId = request.user!.id;
      const userRoleData = await getUserRole(userId);
      const userRole = userRoleData?.id || 'global_user';
      
      // Get user's team memberships
      let teamIds: string[] = [];
      try {
        const userTeams = await TeamService.getUserTeams(userId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        teamIds = userTeams.map((team: any) => team.id);
      } catch (teamError) {
        server.log.warn({
          operation: 'list_mcp_servers',
          userId,
          teamError
        }, 'Failed to get user teams, continuing with empty team list');
        teamIds = [];
      }
      
      // Extract pagination parameters from filters
      const { limit, offset, ...serverFilters } = filters;
      
      const allServers = await catalogService.getServersForUser(userId, userRole, teamIds, serverFilters);

      // Apply pagination
      const total = allServers.length;
      const paginatedServers = allServers.slice(offset, offset + limit);

      server.log.info({
        operation: 'list_mcp_servers',
        userId,
        totalResults: total,
        returnedResults: paginatedServers.length,
        userRole,
        teamCount: teamIds.length,
        pagination: { limit, offset }
      }, 'MCP server list completed');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeJsonParse = (value: any, fallback: any = null) => {
        if (!value || value === 'null' || value === 'undefined') {
          return fallback;
        }
        
        if (typeof value === 'object') {
          return value;
        }
        
        if (typeof value === 'string') {
          // Handle the case where objects were stringified incorrectly as "[object Object],[object Object]"
          if (value.includes('[object Object]')) {
            server.log.warn({ value }, 'Detected malformed object string, returning fallback');
            return fallback;
          }

          // First try JSON parsing
          try {
            return JSON.parse(value);
          } catch (error) {
            // If JSON parsing fails, check if it's a comma-separated string (for tags)
            if (value.includes(',') && !value.startsWith('[') && !value.startsWith('{')) {
              // Split by comma and trim whitespace, filter out empty and malformed entries
              const items = value.split(',')
                .map((item: string) => item.trim())
                .filter((item: string) => item.length > 0 && !item.includes('[object Object]'));
              
              return items.length > 0 ? items : fallback;
            }
            server.log.warn({ value, error }, 'Failed to parse JSON field');
            return fallback;
          }
        }
        
        return fallback;
      };

      return reply.send({
        success: true,
        data: {
          servers: paginatedServers.map(server => ({
            ...server,
            // Parse JSON fields for proper typing with error handling
            tags: safeJsonParse(server.tags, null),
            installation_methods: safeJsonParse(server.installation_methods, []),
            tools: safeJsonParse(server.tools, []),
            resources: safeJsonParse(server.resources, null),
            prompts: safeJsonParse(server.prompts, null),
            environment_variables: safeJsonParse(server.environment_variables, null),
            default_config: safeJsonParse(server.default_config, null),
            dependencies: safeJsonParse(server.dependencies, null),
            // Convert dates to ISO strings
            created_at: server.created_at.toISOString(),
            updated_at: server.updated_at.toISOString(),
            last_sync_at: server.last_sync_at?.toISOString() || null
          })),
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          }
        }
      });
    } catch (error) {
      server.log.error({
        operation: 'list_servers',
        userId: request.user?.id,
        error
      }, 'Failed to list MCP servers');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve servers'
      });
    }
  });
}
