/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';
import { claudeDesktopConfigSchema, extractMcpConfigData } from '../../../utils/mcpConfigExtractor';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';

// Schemas for the three-tier configuration
const templateArgSchema = z.object({
  value: z.string(),
  locked: z.boolean(),
  description: z.string().optional()
});

const templateEnvSchema = z.object({
  name: z.string(),
  value: z.string().nullable(),
  locked: z.boolean(),
  description: z.string().optional()
});

const teamArgSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  required: z.boolean(),
  locked: z.boolean(),
  default_team_locked: z.boolean(),
  min_items: z.number().optional(),
  max_items: z.number().optional()
});

const teamEnvSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  required: z.boolean(),
  locked: z.boolean(),
  default_team_locked: z.boolean(),
  visible_to_users: z.boolean()
});

const userArgSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  required: z.boolean(),
  locked: z.boolean(),
  min_items: z.number().optional(),
  max_items: z.number().optional()
});

const userEnvSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  required: z.boolean(),
  locked: z.boolean()
});

const configurationSchema = z.object({
  template_args: z.array(templateArgSchema).optional(),
  template_env: z.array(templateEnvSchema).optional(),
  team_args_schema: z.array(teamArgSchema).optional(),
  team_env_schema: z.array(teamEnvSchema).optional(),
  user_args_schema: z.array(userArgSchema).optional(),
  user_env_schema: z.array(userEnvSchema).optional()
});

// Request schema for creating global MCP servers (supports both old and new formats)
const createGlobalServerRequestSchema = z.object({
  // Required fields
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  description: z.string().min(1, 'Description is required'),
  language: z.string().min(1, 'Language is required'),
  runtime: z.string().min(1, 'Runtime is required'),
  
  // New format (ADR-007) - optional for backward compatibility
  configuration_schema: configurationSchema.optional(),
  transport_type: z.enum(['stdio', 'http', 'sse']).optional(),
  installation_methods: z.array(z.any()).optional(),
  tools: z.array(z.object({
    name: z.string().min(1, 'Tool name is required'),
    description: z.string().min(1, 'Tool description is required')
  })).optional(),
  
  // Old format (backward compatibility) - optional
  claude_desktop_config: claudeDesktopConfigSchema.optional(),
  
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
  dependencies: z.record(z.string(), z.any()).optional(),
  category_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().default(false),
  auto_install_new_default_team: z.boolean().default(false)
}).refine(
  (data) => data.configuration_schema || data.claude_desktop_config,
  { message: "Either configuration_schema (new format) or claude_desktop_config (old format) must be provided" }
);

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
    transport_type: z.enum(['stdio', 'http', 'sse']),
    // Three-tier configuration schema
    template_args: z.array(z.any()).nullable(),
    template_env: z.record(z.string(), z.any()).nullable(),
    team_args_schema: z.array(z.any()).nullable(),
    team_env_schema: z.array(z.any()).nullable(),
    user_args_schema: z.array(z.any()).nullable(),
    user_env_schema: z.array(z.any()).nullable(),
    dependencies: z.record(z.string(), z.any()).nullable(),
    category_id: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    status: z.enum(['active', 'deprecated', 'maintenance']),
    featured: z.boolean(),
    auto_install_new_default_team: z.boolean(),
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
      description: 'Create a new global MCP server - requires global admin permissions. Global servers are visible to all users. If transport_type is not provided, it will be automatically extracted from claude_desktop_config (CLI commands like npx, node, python = stdio). Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      // Plain JSON Schema for Fastify validation
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', minLength: 1 },
          language: { type: 'string', minLength: 1 },
          runtime: { type: 'string', minLength: 1 },
          transport_type: { type: 'string', enum: ['stdio', 'http', 'sse'] },
          configuration_schema: { type: 'object' }, // New format
          installation_methods: { type: 'array' },
          tools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 },
                description: { type: 'string', minLength: 1 }
              },
              required: ['name', 'description'],
              additionalProperties: false
            }
          },
          claude_desktop_config: {
            type: 'object',
            properties: {
              mcpServers: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    command: { type: 'string', minLength: 1 },
                    args: { type: 'array', items: { type: 'string' } },
                    env: { type: 'object', additionalProperties: { type: 'string' } }
                  },
                  required: ['command', 'args'],
                  additionalProperties: false
                }
              }
            },
            required: ['mcpServers'],
            additionalProperties: false
          },
          long_description: { type: 'string' },
          github_url: { type: 'string', format: 'uri' },
          git_branch: { type: 'string' },
          homepage_url: { type: 'string', format: 'uri' },
          runtime_min_version: { type: 'string' },
          resources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', minLength: 1 },
                description: { type: 'string', minLength: 1 }
              },
              required: ['type', 'description'],
              additionalProperties: false
            }
          },
          prompts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 },
                description: { type: 'string', minLength: 1 }
              },
              required: ['name', 'description'],
              additionalProperties: false
            }
          },
          author_name: { type: 'string' },
          author_contact: { type: 'string' },
          organization: { type: 'string' },
          license: { type: 'string' },
          dependencies: { type: 'object' },
          category_id: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          featured: { type: 'boolean' },
          auto_install_new_default_team: { type: 'boolean' }
        },
        required: ['name', 'description', 'language', 'runtime'],
        additionalProperties: false
      },
      // createSchema() for OpenAPI documentation
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: createSchema(createGlobalServerRequestSchema)
          }
        }
      },
      response: {
        201: createSchema(createGlobalServerResponseSchema),
        400: createSchema(errorResponseSchema.describe('Bad Request - Invalid input or missing Content-Type header')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Global admin permissions required')),
        409: createSchema(errorResponseSchema.describe('Conflict - Server name already exists')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      featured: requestData.featured,
        auto_install_new_default_team: requestData.auto_install_new_default_team
    }, 'Creating global MCP server');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);
      
      // Determine which format is being used and extract/convert data accordingly
      let finalInstallationMethods: any[];
      let finalTransportType: 'stdio' | 'http' | 'sse';
      let finalTools: any[];
      let finalTemplateArgs: any[] | undefined;
      let finalTemplateEnv: any[] | undefined;
      let finalTeamArgsSchema: any[] | undefined;
      let finalTeamEnvSchema: any[] | undefined;
      let finalUserArgsSchema: any[] | undefined;
      let finalUserEnvSchema: any[] | undefined;

      if (requestData.configuration_schema) {
        // New format (ADR-007) - but check if installation_methods is incomplete
        request.log.debug('Using new configuration_schema format');
        
        // Check if installation_methods looks incomplete (frontend TODO issue)
        const hasIncompleteInstallationMethods = requestData.installation_methods && 
          requestData.installation_methods.length > 0 && 
          requestData.installation_methods[0].command === 'npx ...';
        
        if (hasIncompleteInstallationMethods) {
          request.log.debug('Detected incomplete installation_methods, falling back to claude_desktop_config extraction');
          // Fall back to extracting from claude_desktop_config if available
          if (requestData.claude_desktop_config) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { installation_methods, environment_variables, args, transport_type: extractedTransportType } = extractMcpConfigData(requestData.claude_desktop_config);
            finalInstallationMethods = installation_methods;
            finalTransportType = requestData.transport_type || extractedTransportType;
            
            // Also extract environment variables for template_env
            finalTemplateEnv = environment_variables?.map(env => ({
              name: env.name,
              value: env.placeholder || null,
              locked: true,
              description: env.description
            }));
          } else {
            finalInstallationMethods = requestData.installation_methods || [];
            finalTransportType = requestData.transport_type || 'stdio';
            finalTemplateEnv = requestData.configuration_schema.template_env;
          }
        } else {
          finalInstallationMethods = requestData.installation_methods || [];
          finalTransportType = requestData.transport_type || 'stdio';
          finalTemplateEnv = requestData.configuration_schema.template_env;
        }
        
        finalTools = requestData.tools || [];
        finalTemplateArgs = requestData.configuration_schema.template_args;
        finalTeamArgsSchema = requestData.configuration_schema.team_args_schema;
        finalTeamEnvSchema = requestData.configuration_schema.team_env_schema;
        finalUserArgsSchema = requestData.configuration_schema.user_args_schema;
        finalUserEnvSchema = requestData.configuration_schema.user_env_schema;
      } else if (requestData.claude_desktop_config) {
        // Old format - extract and convert data
        request.log.debug('Using old claude_desktop_config format, extracting data');
        
        const { installation_methods, environment_variables, args, transport_type: extractedTransportType } = extractMcpConfigData(requestData.claude_desktop_config);
        
        finalInstallationMethods = installation_methods;
        finalTransportType = requestData.transport_type || extractedTransportType;
        finalTools = requestData.tools || [];
        
        // Convert old format to new three-tier schema
        // For now, put everything in template level (locked)
        finalTemplateArgs = args?.map(arg => ({
          value: arg.default_value,
          locked: true,
          description: arg.description
        }));
        
        // Convert environment variables to template_env array format
        finalTemplateEnv = environment_variables?.map(env => ({
          name: env.name,
          value: env.placeholder || null,
          locked: true,
          description: env.description
        }));
        
        // Leave team/user schemas empty for old format
        finalTeamArgsSchema = undefined;
        finalTeamEnvSchema = undefined;
        finalUserArgsSchema = undefined;
        finalUserEnvSchema = undefined;
      } else {
        throw new Error('Either configuration_schema or claude_desktop_config must be provided');
      }

      // Convert template_env array format to object format for database storage
      let templateEnvForDb: Record<string, any> | undefined;
      if (finalTemplateEnv && finalTemplateEnv.length > 0) {
        templateEnvForDb = {};
        finalTemplateEnv.forEach(env => {
          if (env.name) {
            templateEnvForDb![env.name] = {
              value: env.value,
              locked: env.locked,
              description: env.description
            };
          }
        });
      }

      // Prepare server data with the processed configuration
      const serverData = {
        name: requestData.name,
        description: requestData.description,
        long_description: requestData.long_description,
        github_url: requestData.github_url,
        git_branch: requestData.git_branch,
        homepage_url: requestData.homepage_url,
        language: requestData.language,
        runtime: requestData.runtime,
        runtime_min_version: requestData.runtime_min_version,
        installation_methods: finalInstallationMethods,
        tools: finalTools,
        resources: requestData.resources,
        prompts: requestData.prompts,
        visibility: 'global' as const,
        author_name: requestData.author_name,
        author_contact: requestData.author_contact,
        organization: requestData.organization,
        license: requestData.license,
        transport_type: finalTransportType,
        // Three-tier configuration schema
        template_args: finalTemplateArgs,
        template_env: templateEnvForDb, // Use converted object format
        team_args_schema: finalTeamArgsSchema,
        team_env_schema: finalTeamEnvSchema,
        user_args_schema: finalUserArgsSchema,
        user_env_schema: finalUserEnvSchema,
        dependencies: requestData.dependencies,
        category_id: requestData.category_id,
        tags: requestData.tags,
        featured: requestData.featured,
        auto_install_new_default_team: requestData.auto_install_new_default_team
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
        featured: newServer.featured,
        auto_install_new_default_team: newServer.auto_install_new_default_team
      }, 'Global MCP server created successfully');

      // Emit MCP_SERVER_CREATED event
      try {
        const eventContext: EventContext = {
          db,
          logger: request.log,
          user: {
            id: request.user!.id,
             
            email: (request.user as any).email,
            roleId: 'global_admin'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_SERVER_CREATED,
          {
            server: {
              id: newServer.id,
              name: newServer.name,
              description: newServer.description,
              language: newServer.language,
              runtime: newServer.runtime
            },
            createdBy: {
              id: request.user!.id,
               
              email: (request.user as any).email
            },
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_SERVER_CREATED event emitted for server: ${newServer.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_SERVER_CREATED event for server ${newServer.id}:`);
        // Don't fail server creation if event emission fails
      }

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
            transport_type: newServer.transport_type,
            template_args: newServer.template_args,
            template_env: newServer.template_env,
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
          transport_type: newServer.transport_type,
          // Three-tier configuration schema
          template_args: newServer.template_args ? JSON.parse(newServer.template_args) : null,
          template_env: newServer.template_env ? JSON.parse(newServer.template_env) : null,
          team_args_schema: newServer.team_args_schema ? JSON.parse(newServer.team_args_schema) : null,
          team_env_schema: newServer.team_env_schema ? JSON.parse(newServer.team_env_schema) : null,
          user_args_schema: newServer.user_args_schema ? JSON.parse(newServer.user_args_schema) : null,
          user_env_schema: newServer.user_env_schema ? JSON.parse(newServer.user_env_schema) : null,
          dependencies: newServer.dependencies ? JSON.parse(newServer.dependencies) : null,
          category_id: newServer.category_id || null,
          tags: newServer.tags ? JSON.parse(newServer.tags) : null,
          status: newServer.status,
          featured: newServer.featured,
          auto_install_new_default_team: newServer.auto_install_new_default_team,
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

        // Manual JSON serialization to avoid serialization issues
        const jsonString = JSON.stringify(response);
        return reply.status(201).type('application/json').send(jsonString);
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
            transport_type: newServer.transport_type,
            template_args: newServer.template_args,
            template_env: newServer.template_env,
            dependencies: newServer.dependencies,
            tags: newServer.tags
          }
        }, 'Failed to parse JSON fields in response');

        const errorResponse = {
          success: false,
          error: 'Failed to format server response'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
     
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
        const conflictResponse = {
          success: false,
          error: 'Server name already exists'
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      if (error.message?.includes('Only global administrators')) {
        const forbiddenResponse = {
          success: false,
          error: 'Global admin permissions required'
        };
        const jsonString = JSON.stringify(forbiddenResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const errorResponse = {
        success: false,
        error: 'Failed to create global MCP server'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
