import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';

// Query parameters schema
const querySchema = z.object({
  category_id: z.string().optional(),
  language: z.string().optional(),
  runtime: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'maintenance']).optional(),
  featured: z.boolean().optional(),
  search: z.string().optional()
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
  data: z.array(serverSchema)
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
      description: 'Retrieve MCP servers visible to the current user based on their permissions',
      querystring: zodToJsonSchema(querySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(listServersResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb();
      const catalogService = new McpCatalogService(db, server.log);
      
      // Parse query parameters
      const filters = querySchema.parse(request.query);
      
      // Get user info (would come from auth middleware in real implementation)
      // For now, using placeholder values - this will be replaced with proper auth
       
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (request.user as any)?.id || 'anonymous';
      const userRole = 'user'; // Default role for now
      const teamIds: string[] = []; // Empty team list for now
      
      const servers = await catalogService.getServersForUser(userId, userRole, teamIds, filters);

      return reply.send({
        success: true,
        data: servers.map(server => ({
          ...server,
          created_at: server.created_at.toISOString(),
          updated_at: server.updated_at.toISOString(),
          last_sync_at: server.last_sync_at?.toISOString() || null
        }))
      });
    } catch (error) {
      server.log.error({
        operation: 'list_servers',
        error
      }, 'Failed to list MCP servers');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve servers'
      });
    }
  });
}
