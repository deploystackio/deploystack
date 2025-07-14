import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';

// Path parameters schema
const updateGlobalServerParamsSchema = z.object({
  id: z.string().min(1, 'Server ID is required')
});

// Request schema for updating global MCP servers (all fields optional)
const updateGlobalServerRequestSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(255, 'Name must be 255 characters or less').optional(),
  description: z.string().min(1, 'Description cannot be empty').optional(),
  long_description: z.string().optional(),
  github_url: z.string().url('Invalid GitHub URL').optional(),
  git_branch: z.string().optional(),
  homepage_url: z.string().url('Invalid homepage URL').optional(),
  language: z.string().min(1, 'Language cannot be empty').optional(),
  runtime: z.string().min(1, 'Runtime cannot be empty').optional(),
  runtime_min_version: z.string().optional(),
  installation_methods: z.array(z.object({
    type: z.string().min(1, 'Installation method type is required'),
    command: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional()
  })).min(1, 'At least one installation method is required').optional(),
  tools: z.array(z.object({
    name: z.string().min(1, 'Tool name is required'),
    description: z.string().min(1, 'Tool description is required')
  })).min(1, 'At least one tool is required').optional(),
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
  status: z.enum(['active', 'deprecated', 'maintenance']).optional(),
  featured: z.boolean().optional()
});

// Response schema for successful update
const updateGlobalServerResponseSchema = z.object({
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

export default async function updateGlobalServer(server: FastifyInstance) {
  server.put('/mcp/servers/global/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Update global MCP server (Global Admin only)',
      description: 'Update an existing global MCP server - requires global admin permissions. Only global servers can be updated through this endpoint. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(updateGlobalServerParamsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: zodToJsonSchema(updateGlobalServerRequestSchema, {
              $refStrategy: 'none',
              target: 'openApi3'
            })
          }
        }
      },
      response: {
        200: zodToJsonSchema(updateGlobalServerResponseSchema, {
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
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Server not found or not a global server'), {
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
    const { id: serverId } = request.params as z.infer<typeof updateGlobalServerParamsSchema>;
    const updateData = request.body as z.infer<typeof updateGlobalServerRequestSchema>;
    
    request.log.info({
      operation: 'update_global_mcp_server',
      userId: request.user?.id,
      serverId,
      updateFields: Object.keys(updateData)
    }, 'Updating global MCP server');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);
      
      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'start',
        serverId,
        updateData
      }, 'Starting update process');
      
      // First check if server exists and is global
      const existingServer = await mcpService.getServerById(serverId);
      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'get_server',
        serverId,
        found: !!existingServer,
        visibility: existingServer?.visibility
      }, 'Retrieved existing server');
      
      if (!existingServer) {
        request.log.warn({
          operation: 'update_global_mcp_server',
          userId: request.user?.id,
          serverId
        }, 'Server not found');
        
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      if (existingServer.visibility !== 'global') {
        request.log.warn({
          operation: 'update_global_mcp_server',
          userId: request.user?.id,
          serverId,
          serverVisibility: existingServer.visibility
        }, 'Attempted to update non-global server through global endpoint');
        
        return reply.status(404).send({
          success: false,
          error: 'Server not found or not a global server'
        });
      }

      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'calling_service',
        serverId,
        userId: request.user!.id
      }, 'Calling updateServer service method');

      const updatedServer = await mcpService.updateServer(
        serverId,
        request.user!.id,
        'global_admin', // We know user is global admin due to middleware
        updateData
      );
      
      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'service_complete',
        serverId,
        success: !!updatedServer
      }, 'Service method completed');

      if (!updatedServer) {
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      request.log.info({
        operation: 'update_global_mcp_server',
        userId: request.user?.id,
        serverId,
        serverName: updatedServer.name,
        updatedFields: Object.keys(updateData)
      }, 'Global MCP server updated successfully');

      // Safe JSON parsing helper function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeJsonParse = (fieldValue: any, defaultValue: any) => {
        if (!fieldValue || fieldValue === '' || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
          return defaultValue;
        }
        if (typeof fieldValue !== 'string') {
          return fieldValue; // Already parsed or not a string
        }
        try {
          return JSON.parse(fieldValue);
        } catch (e) {
          request.log.warn({ 
            fieldValue, 
            error: e,
            serverId: updatedServer.id 
          }, 'Failed to parse JSON field in response, using default value');
          return defaultValue;
        }
      };

      // Format dates safely
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatDate = (date: any) => {
        if (!date) return null;
        try {
          if (typeof date === 'number') {
            return new Date(date).toISOString();
          }
          if (date instanceof Date) {
            return date.toISOString();
          }
          return new Date(date).toISOString();
        } catch (error) {
          request.log.warn({
            dateValue: date,
            error
          }, 'Failed to format date field, using null');
          return null;
        }
      };

      // Parse JSON fields for response with safe parsing
      const responseData = {
        id: updatedServer.id,
        name: updatedServer.name,
        slug: updatedServer.slug,
        description: updatedServer.description,
        long_description: updatedServer.long_description || null,
        github_url: updatedServer.github_url || null,
        git_branch: updatedServer.git_branch || null,
        homepage_url: updatedServer.homepage_url || null,
        language: updatedServer.language,
        runtime: updatedServer.runtime,
        runtime_min_version: updatedServer.runtime_min_version || null,
        installation_methods: safeJsonParse(updatedServer.installation_methods, []),
        tools: safeJsonParse(updatedServer.tools, []),
        resources: safeJsonParse(updatedServer.resources, null),
        prompts: safeJsonParse(updatedServer.prompts, null),
        visibility: updatedServer.visibility,
        owner_team_id: updatedServer.owner_team_id || null,
        created_by: updatedServer.created_by,
        author_name: updatedServer.author_name || null,
        author_contact: updatedServer.author_contact || null,
        organization: updatedServer.organization || null,
        license: updatedServer.license || null,
        default_config: safeJsonParse(updatedServer.default_config, null),
        environment_variables: safeJsonParse(updatedServer.environment_variables, null),
        dependencies: safeJsonParse(updatedServer.dependencies, null),
        category_id: updatedServer.category_id || null,
        tags: safeJsonParse(updatedServer.tags, null),
        status: updatedServer.status,
        featured: updatedServer.featured,
        created_at: formatDate(updatedServer.created_at),
        updated_at: formatDate(updatedServer.updated_at),
        last_sync_at: formatDate(updatedServer.last_sync_at)
      };

      return reply.status(200).send({
        success: true,
        data: responseData
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'update_global_mcp_server',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to update global MCP server');

      // Handle specific error cases
      if (error.message?.includes('UNIQUE constraint failed') || 
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate')) {
        return reply.status(409).send({
          success: false,
          error: 'Server name already exists'
        });
      }

      if (error.message?.includes('Server not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Server not found'
        });
      }

      if (error.message?.includes('Insufficient permissions')) {
        return reply.status(403).send({
          success: false,
          error: 'Global admin permissions required'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to update global MCP server'
      });
    }
  });
}
