/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { GitHubService } from '../../../services/githubService';
import { GitHubReadmeService } from '../../../services/githubReadmeService';
import { OAuthDiscoveryService } from '../../../services/OAuthDiscoveryService';
import { getDb } from '../../../db';
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
      
      // Frontend sends packages/remotes and configuration schema
      // No extraction needed - use data as provided
      const finalPackages = requestData.packages || [];
      const finalRemotes = requestData.remotes || undefined;
      const finalTransportType = requestData.transport_type || 'stdio';
      
      // Configuration schema from request (frontend handles extraction)
      const finalTemplateArgs = requestData.configuration_schema?.template_args || [];
      const finalTemplateEnv = requestData.configuration_schema?.template_env || [];
      const finalTemplateHeaders = requestData.configuration_schema?.template_headers || [];
      const finalTemplateUrlQueryParams = requestData.configuration_schema?.template_url_query_params || [];
      const finalTeamArgsSchema = requestData.configuration_schema?.team_args_schema || [];
      const finalTeamEnvSchema = requestData.configuration_schema?.team_env_schema || [];
      const finalTeamHeadersSchema = requestData.configuration_schema?.team_headers_schema || [];
      const finalTeamUrlQueryParamsSchema = requestData.configuration_schema?.team_url_query_params_schema || [];
      const finalUserArgsSchema = requestData.configuration_schema?.user_args_schema || [];
      const finalUserEnvSchema = requestData.configuration_schema?.user_env_schema || [];
      const finalUserHeadersSchema = requestData.configuration_schema?.user_headers_schema || [];
      const finalUserUrlQueryParamsSchema = requestData.configuration_schema?.user_url_query_params_schema || [];
      
      // Fetch GitHub data if repository_url points to GitHub (non-blocking)
      let githubReadmeBase64: string | null = null;
      let githubStars: number | null = null;
      let githubAccountId: string | null = requestData.github_account_id || null;

      if (requestData.repository_url) {
        request.log.debug({
          operation: 'create_global_mcp_server',
          step: 'fetch_github_data',
          repository_url: requestData.repository_url
        }, 'Attempting to fetch repository data');

        // Check if it's a GitHub repository
        if (requestData.repository_url.includes('github.com')) {
          // Fetch repository info (stars and account ID)
          try {
            const repoInfo = await GitHubService.getRepositoryInfo(
              requestData.repository_url,
              request.log
            );
            
            githubStars = repoInfo.stars;
            if (repoInfo.github_account_id) {
              githubAccountId = repoInfo.github_account_id;
            }
            
            request.log.info({
              operation: 'create_global_mcp_server',
              step: 'fetch_github_data',
              repository_url: requestData.repository_url,
              stars: githubStars,
              account_id: githubAccountId
            }, 'Successfully fetched GitHub repository info');
          } catch (error) {
            request.log.warn({
              operation: 'create_global_mcp_server',
              step: 'fetch_github_data',
              error,
              repository_url: requestData.repository_url
            }, 'Failed to fetch GitHub repository info, continuing without it');
          }

          // Fetch README content
          try {
            const branch = requestData.git_branch || 'main';
            const readmeResult = await GitHubReadmeService.getReadmeContent(
              requestData.repository_url,
              branch,
              request.log
            );
            
            if (readmeResult) {
              githubReadmeBase64 = Buffer.from(readmeResult.content, 'utf8').toString('base64');
              
              request.log.info({
                operation: 'create_global_mcp_server',
                step: 'fetch_github_data',
                repository_url: requestData.repository_url,
                readme_length: readmeResult.content.length,
                readme_encoded_length: githubReadmeBase64.length
              }, 'Successfully fetched and encoded GitHub README');
            } else {
              request.log.debug({
                operation: 'create_global_mcp_server',
                step: 'fetch_github_data',
                repository_url: requestData.repository_url
              }, 'No README found in repository');
            }
          } catch (error) {
            request.log.warn({
              operation: 'create_global_mcp_server',
              step: 'fetch_github_data',
              error,
              repository_url: requestData.repository_url
            }, 'Failed to fetch GitHub README, continuing without it');
          }
        } else {
          request.log.debug({
            operation: 'create_global_mcp_server',
            step: 'skip_github_data',
            repository_url: requestData.repository_url
          }, 'Repository is not on GitHub, skipping GitHub-specific data fetch');
        }
      }

      // Auto-fill icon_url from GitHub avatar if not explicitly provided
      let iconUrl = requestData.icon_url;
      if (!iconUrl && githubAccountId) {
        iconUrl = `https://avatars.githubusercontent.com/u/${githubAccountId}?v=4&s=64`;
        request.log.debug({
          operation: 'create_global_mcp_server',
          step: 'auto_fill_icon_url',
          github_account_id: githubAccountId,
          icon_url: iconUrl
        }, 'Auto-filled icon_url from GitHub account ID');
      }

      // OAuth detection for remote MCP servers (HTTP/SSE)
      let requiresOauth = false;
      if (finalTransportType === 'http' || finalTransportType === 'sse') {
        if (finalRemotes && finalRemotes.length > 0 && finalRemotes[0].url) {
          try {
            request.log.info({
              operation: 'create_global_mcp_server',
              step: 'oauth_detection',
              mcpServerUrl: finalRemotes[0].url,
              transportType: finalTransportType
            }, 'Starting OAuth detection for remote MCP server');

            const oauthService = new OAuthDiscoveryService(request.log);
            const oauthResult = await oauthService.detectAndDiscoverOAuth(finalRemotes[0].url);

            requiresOauth = oauthResult.requiresOauth;

            request.log.info({
              operation: 'create_global_mcp_server',
              step: 'oauth_detection',
              mcpServerUrl: finalRemotes[0].url,
              requiresOauth,
              hasMetadata: !!oauthResult.metadata
            }, 'OAuth detection completed for new server');
          } catch (error) {
            request.log.warn({
              operation: 'create_global_mcp_server',
              step: 'oauth_detection',
              mcpServerUrl: finalRemotes[0].url,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'OAuth detection failed, defaulting to requires_oauth=false');
            requiresOauth = false;
          }
        }
      }

      // Prepare server data with the processed configuration
      // Ensure all schema arrays default to empty arrays instead of undefined/null
      const serverData = {
        name: requestData.name,
        description: requestData.description,
        long_description: requestData.long_description,
        repository_url: requestData.repository_url,
        repository_source: requestData.repository_url?.includes('github.com') ? 'github' :
                          requestData.repository_url?.includes('gitlab.com') ? 'gitlab' :
                          requestData.repository_url?.includes('bitbucket.org') ? 'bitbucket' : undefined,
        repository_id: requestData.repository_url ? (
          requestData.repository_url.includes('github.com') ?
            requestData.repository_url.split('github.com/')[1]?.replace('.git', '') :
          requestData.repository_url.includes('gitlab.com') ?
            requestData.repository_url.split('gitlab.com/')[1]?.replace('.git', '') :
          requestData.repository_url.includes('bitbucket.org') ?
            requestData.repository_url.split('bitbucket.org/')[1]?.replace('.git', '') :
            undefined
        ) : undefined,
        repository_subfolder: requestData.repository_subfolder || undefined,
        git_branch: requestData.repository_url ? requestData.git_branch : undefined,
        website_url: requestData.website_url,
        icon_url: iconUrl,
        language: requestData.language,
        runtime: requestData.runtime,
        packages: finalPackages,
        remotes: finalRemotes,
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
        template_url_query_params: finalTemplateUrlQueryParams || [],
        team_args_schema: finalTeamArgsSchema || [],
        team_env_schema: finalTeamEnvSchema || [],
        team_headers_schema: finalTeamHeadersSchema || [],
        team_url_query_params_schema: finalTeamUrlQueryParamsSchema || [],
        user_args_schema: finalUserArgsSchema || [],
        user_env_schema: finalUserEnvSchema || [],
        user_headers_schema: finalUserHeadersSchema || [],
        user_url_query_params_schema: finalUserUrlQueryParamsSchema || [],
        dependencies: requestData.dependencies,
        category_id: requestData.category_id,
        tags: requestData.tags,
        featured: requestData.featured,
        auto_install_new_default_team: requestData.auto_install_new_default_team,
        requires_oauth: requiresOauth || false,
        source: 'manual' as const, // Always 'manual' for admin-created servers
        github_account_id: githubAccountId,
        github_readme_base64: githubReadmeBase64,
        github_stars: githubStars
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
