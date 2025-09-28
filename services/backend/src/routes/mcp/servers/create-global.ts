/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';
import { extractMcpConfigData } from '../../../utils/mcpConfigExtractor';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';
import {
  CREATE_GLOBAL_SERVER_REQUEST_SCHEMA,
  CREATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  type CreateGlobalServerRequest,
  type CreateGlobalServerSuccessResponse,
  type ErrorResponse,
  formatServerResponse
} from './schemas';

export default async function createGlobalServer(server: FastifyInstance) {
  server.post('/mcp/servers/global', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Create global MCP server (Global Admin only)',
      description: 'Create a new global MCP server - requires global admin permissions. Global servers are visible to all users. If transport_type is not provided, it will be automatically extracted from claude_desktop_config (CLI commands like npx, node, python = stdio). Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: CREATE_GLOBAL_SERVER_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: CREATE_GLOBAL_SERVER_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...CREATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA,
          description: 'Global MCP server created successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    const requestData = request.body as CreateGlobalServerRequest;
    
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
      let finalTemplateArgs: any[] | undefined;
      let finalTemplateEnv: any[] | undefined;
      let finalTemplateHeaders: any[] | undefined;
      let finalTeamArgsSchema: any[] | undefined;
      let finalTeamEnvSchema: any[] | undefined;
      let finalTeamHeadersSchema: any[] | undefined;
      let finalUserArgsSchema: any[] | undefined;
      let finalUserEnvSchema: any[] | undefined;
      let finalUserHeadersSchema: any[] | undefined;

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
            const { installation_methods, environment_variables, headers, transport_type: extractedTransportType } = extractMcpConfigData(requestData.claude_desktop_config);
            finalInstallationMethods = installation_methods;
            finalTransportType = requestData.transport_type || extractedTransportType;
            
            // Also extract environment variables for template_env
            finalTemplateEnv = environment_variables?.map(env => ({
              name: env.name,
              value: env.placeholder || null,
              locked: true,
              description: env.description
            }));
            
            // Extract headers for template_headers
            finalTemplateHeaders = headers?.map(header => ({
              name: header.name,
              value: header.placeholder || null,
              locked: true,
              description: header.description
            }));
          } else {
            finalInstallationMethods = requestData.installation_methods || [];
            finalTransportType = requestData.transport_type || 'stdio';
            finalTemplateEnv = requestData.configuration_schema.template_env;
            finalTemplateHeaders = requestData.configuration_schema.template_headers;
          }
        } else {
          finalInstallationMethods = requestData.installation_methods || [];
          finalTransportType = requestData.transport_type || 'stdio';
          finalTemplateEnv = requestData.configuration_schema.template_env;
          finalTemplateHeaders = requestData.configuration_schema.template_headers;
        }
        
        finalTemplateArgs = requestData.configuration_schema.template_args;
        finalTeamArgsSchema = requestData.configuration_schema.team_args_schema;
        finalTeamEnvSchema = requestData.configuration_schema.team_env_schema;
        finalTeamHeadersSchema = requestData.configuration_schema.team_headers_schema;
        finalUserArgsSchema = requestData.configuration_schema.user_args_schema;
        finalUserEnvSchema = requestData.configuration_schema.user_env_schema;
        finalUserHeadersSchema = requestData.configuration_schema.user_headers_schema;
      } else if (requestData.claude_desktop_config) {
        // Old format - extract and convert data
        request.log.debug('Using old claude_desktop_config format, extracting data');
        
        const { installation_methods, environment_variables, args, headers, transport_type: extractedTransportType } = extractMcpConfigData(requestData.claude_desktop_config);
        
        finalInstallationMethods = installation_methods;
        finalTransportType = requestData.transport_type || extractedTransportType;
        
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
        
        // Convert headers to template_headers array format
        finalTemplateHeaders = headers?.map(header => ({
          name: header.name,
          value: header.placeholder || null,
          locked: true,
          description: header.description
        }));
        
        // Leave team/user schemas empty for old format
        finalTeamArgsSchema = undefined;
        finalTeamEnvSchema = undefined;
        finalTeamHeadersSchema = undefined;
        finalUserArgsSchema = undefined;
        finalUserEnvSchema = undefined;
        finalUserHeadersSchema = undefined;
      } else {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Either configuration_schema or claude_desktop_config must be provided'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Convert template_env and template_headers - keep as arrays for consistency
      // All template fields should be stored as arrays: template_args, template_env, template_headers
      
      // Prepare server data with the processed configuration
      // Ensure all schema arrays default to empty arrays instead of undefined/null
      const serverData = {
        name: requestData.name,
        description: requestData.description,
        long_description: requestData.long_description,
        github_url: requestData.github_url,
        git_branch: requestData.git_branch,
        homepage_url: requestData.homepage_url,
        language: requestData.language,
        runtime: requestData.runtime,
        installation_methods: finalInstallationMethods,
        resources: requestData.resources,
        prompts: requestData.prompts,
        visibility: 'global' as const,
        author_name: requestData.author_name,
        author_contact: requestData.author_contact,
        organization: requestData.organization,
        license: requestData.license,
        transport_type: finalTransportType,
        // Three-tier configuration schema - all stored as arrays for consistency
        template_args: finalTemplateArgs || [],
        template_env: finalTemplateEnv || [], // Store as array format (not converted to object)
        template_headers: finalTemplateHeaders || [], // Store as array format (not converted to object)
        team_args_schema: finalTeamArgsSchema || [],
        team_env_schema: finalTeamEnvSchema || [],
        team_headers_schema: finalTeamHeadersSchema || [],
        user_args_schema: finalUserArgsSchema || [],
        user_env_schema: finalUserEnvSchema || [],
        user_headers_schema: finalUserHeadersSchema || [],
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

      // Format the server response using the shared utility function
      let responseData;
      try {
        responseData = formatServerResponse(newServer);
      } catch (jsonError: any) {
        request.log.error({
          operation: 'create_global_mcp_server',
          userId: request.user?.id,
          serverId: newServer.id,
          jsonError
        }, 'Failed to parse JSON fields in response');
        
        const formatErrorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to format server response'
        };
        const jsonString = JSON.stringify(formatErrorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      const response: CreateGlobalServerSuccessResponse = {
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
        const conflictResponse: ErrorResponse = {
          success: false,
          error: 'Server name already exists'
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      if (error.message?.includes('Only global administrators')) {
        const forbiddenResponse: ErrorResponse = {
          success: false,
          error: 'Global admin permissions required'
        };
        const jsonString = JSON.stringify(forbiddenResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to create global MCP server'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
