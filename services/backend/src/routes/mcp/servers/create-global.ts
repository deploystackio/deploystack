import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';

// Request schema for creating global MCP servers
const createGlobalServerRequestSchema = z.object({
  // Required fields
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  description: z.string().min(1, 'Description is required'),
  language: z.string().min(1, 'Language is required'),
  runtime: z.string().min(1, 'Runtime is required'),
  installation_methods: z.array(z.object({
    type: z.string().min(1, 'Installation method type is required'),
    command: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional()
  })).min(1, 'At least one installation method is required'),
  tools: z.array(z.object({
    name: z.string().min(1, 'Tool name is required'),
    description: z.string().min(1, 'Tool description is required')
  })).min(1, 'At least one tool is required'),
  
  // Optional fields
  long_description: z.string().optional(),
  github_url: z.string().url('Invalid GitHub URL').optional(),
  git_branch: z.string().default('main'),
  homepage_url: z.string().url('Invalid homepage URL').optional(),
  runtime_min_version: z.string().optional(),
  resources: z.array(z.object({
    type: z.string().min(1, 'Resource type is required'),
    description: z.string().min(1, 'Resource description is required')
  })).optional(),
  prompts: z.array(z.object({
    name: z.string().min(1, 'Prompt name is required'),
    description: z.string().min(1, 'Prompt description is required')
  })).optional(),
  author_name: z.string().optional(),
  author_contact: z.string().optional(),
  organization: z.string().optional(),
  license: z.string().optional(),
  default_config: z.record(z.any()).optional(),
  environment_variables: z.array(z.object({
    name: z.string().min(1, 'Environment variable name is required'),
    description: z.string().min(1, 'Environment variable description is required'),
    required: z.boolean().default(false),
    default_value: z.string().optional()
  })).optional(),
  dependencies: z.record(z.any()).optional(),
  category_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().default(false)
});

// Response schema for successful creation
const createGlobalServerResponseSchema = z.object({
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
    default_config: z.record(z.any()).nullable(),
    environment_variables: z.array(z.any()).nullable(),
    dependencies: z.record(z.any()).nullable(),
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

export default async function createGlobalServer(server: FastifyInstance) {
  server.post('/mcp/servers/global', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Create global MCP server (Global Admin only)',
      description: 'Create a new global MCP server - requires global admin permissions. Global servers are visible to all users. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: zodToJsonSchema(createGlobalServerRequestSchema, {
              $refStrategy: 'none',
              target: 'openApi3'
            })
          }
        }
      },
      response: {
        201: zodToJsonSchema(createGlobalServerResponseSchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Invalid input or missing Content-Type header'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Global admin permissions required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Server name already exists'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    const requestData = request.body as z.infer<typeof createGlobalServerRequestSchema>;
    
    request.log.info({
      operation: 'create_global_mcp_server',
      userId: request.user?.id,
      serverName: requestData.name,
      language: requestData.language,
      runtime: requestData.runtime,
      featured: requestData.featured
    }, 'Creating global MCP server');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);
      
      // Force global visibility and no team ownership for global servers
      const serverData = {
        ...requestData,
        visibility: 'global' as const
      };

      const newServer = await mcpService.createServer(
        request.user!.id,
        'global_admin', // We know user is global admin due to middleware
        null, // No team for global servers
        serverData
      );

      request.log.info({
        operation: 'create_global_mcp_server',
        userId: request.user?.id,
        serverId: newServer.id,
        serverSlug: newServer.slug,
        serverName: newServer.name,
        featured: newServer.featured
      }, 'Global MCP server created successfully');

      // Parse JSON fields for response with proper null checks and error handling
      try {
        request.log.debug({
          operation: 'create_global_mcp_server',
          userId: request.user?.id,
          serverId: newServer.id,
          rawServerData: {
            installation_methods: newServer.installation_methods,
            tools: newServer.tools,
            resources: newServer.resources,
            prompts: newServer.prompts,
            default_config: newServer.default_config,
            environment_variables: newServer.environment_variables,
            dependencies: newServer.dependencies,
            tags: newServer.tags
          }
        }, 'About to parse JSON fields for response');

        const responseData = {
          id: newServer.id,
          name: newServer.name,
          slug: newServer.slug,
          description: newServer.description,
          long_description: newServer.long_description || null,
          github_url: newServer.github_url || null,
          git_branch: newServer.git_branch || null,
          homepage_url: newServer.homepage_url || null,
          language: newServer.language,
          runtime: newServer.runtime,
          runtime_min_version: newServer.runtime_min_version || null,
          installation_methods: newServer.installation_methods ? JSON.parse(newServer.installation_methods) : [],
          tools: newServer.tools ? JSON.parse(newServer.tools) : [],
          resources: newServer.resources ? JSON.parse(newServer.resources) : null,
          prompts: newServer.prompts ? JSON.parse(newServer.prompts) : null,
          visibility: newServer.visibility,
          owner_team_id: newServer.owner_team_id || null,
          created_by: newServer.created_by,
          author_name: newServer.author_name || null,
          author_contact: newServer.author_contact || null,
          organization: newServer.organization || null,
          license: newServer.license || null,
          default_config: newServer.default_config ? JSON.parse(newServer.default_config) : null,
          environment_variables: newServer.environment_variables ? JSON.parse(newServer.environment_variables) : null,
          dependencies: newServer.dependencies ? JSON.parse(newServer.dependencies) : null,
          category_id: newServer.category_id || null,
          tags: newServer.tags ? JSON.parse(newServer.tags) : null,
          status: newServer.status,
          featured: newServer.featured,
          created_at: newServer.created_at.toISOString(),
          updated_at: newServer.updated_at.toISOString(),
          last_sync_at: newServer.last_sync_at?.toISOString() || null
        };

        request.log.debug({
          operation: 'create_global_mcp_server',
          userId: request.user?.id,
          serverId: newServer.id
        }, 'JSON parsing completed, about to send response');

        const response = {
          success: true,
          data: responseData
        };

        request.log.debug({
          operation: 'create_global_mcp_server',
          userId: request.user?.id,
          serverId: newServer.id
        }, 'Sending 201 response');

        return reply.status(201).send(response);
      } catch (jsonError) {
        request.log.error({
          operation: 'create_global_mcp_server',
          userId: request.user?.id,
          serverId: newServer.id,
          jsonError,
          serverData: {
            installation_methods: newServer.installation_methods,
            tools: newServer.tools,
            resources: newServer.resources,
            prompts: newServer.prompts,
            default_config: newServer.default_config,
            environment_variables: newServer.environment_variables,
            dependencies: newServer.dependencies,
            tags: newServer.tags
          }
        }, 'Failed to parse JSON fields in response');

        return reply.status(500).send({
          success: false,
          error: 'Failed to format server response'
        });
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'create_global_mcp_server',
        userId: request.user?.id,
        serverName: requestData.name,
        error
      }, 'Failed to create global MCP server');

      // Handle specific error cases
      if (error.message?.includes('UNIQUE constraint failed') || 
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate')) {
        return reply.status(409).send({
          success: false,
          error: 'Server name already exists'
        });
      }

      if (error.message?.includes('Only global administrators')) {
        return reply.status(403).send({
          success: false,
          error: 'Global admin permissions required'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to create global MCP server'
      });
    }
  });
}
