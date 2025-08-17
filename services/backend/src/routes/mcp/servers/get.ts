import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { TeamService } from '../../../services/teamService';
import { getUserRole } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';

// Path parameters schema
const getServerParamsSchema = z.object({
  id: z.string().min(1, 'Server ID is required')
});

// Response schema for single server
const getServerResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
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
    transport_type: z.enum(['stdio', 'http', 'sse']),
    environment_variables: z.array(z.any()).nullable(),
    dependencies: z.record(z.string(), z.any()).nullable(),
    category_id: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    status: z.enum(['active', 'deprecated', 'maintenance']),
    featured: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    last_sync_at: z.string().nullable()
  })
});

// Error response schema
const errorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.string(),
  details: z.any().optional()
});

export default async function getServer(server: FastifyInstance) {
  server.get('/mcp/servers/:id', {
    schema: {
      tags: ['MCP Servers'],
      summary: 'Get MCP server by ID',
      description: 'Retrieve a specific MCP server by its ID. Access is controlled based on user role and team membership - users can access global servers and their team servers, while global admins can access all servers.',
      security: [{ cookieAuth: [] }],
      params: createSchema(getServerParamsSchema),
      response: {
        200: createSchema(getServerResponseSchema),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        404: createSchema(errorResponseSchema.describe('Not Found - Server not found or access denied')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
    const { id: serverId } = request.params as z.infer<typeof getServerParamsSchema>;
    
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

        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
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
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      request.log.info({
        operation: 'get_mcp_server',
        userId: request.user!.id,
        serverId,
        userRole,
        serverVisibility: server.visibility,
        teamCount: teamIds.length
      }, 'MCP server access granted');

      // Format dates for response - JSON fields are already parsed by the service
      const responseServer = {
        ...server,
        created_at: server.created_at.toISOString(),
        updated_at: server.updated_at.toISOString(),
        last_sync_at: server.last_sync_at?.toISOString() || null
      };

      return reply.status(200).send({
        success: true,
        data: responseServer
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'get_mcp_server',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to get MCP server');

      return reply.status(500).send({
        success: false,
        error: 'Failed to get MCP server'
      });
    }
  });
}
