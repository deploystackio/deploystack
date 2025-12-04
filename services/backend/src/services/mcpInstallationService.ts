/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, desc } from 'drizzle-orm';
import { getSchema } from '../db/index';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { nanoid } from 'nanoid';
import { McpArgsStorage } from '../utils/mcpArgsStorage';
import { McpEnvStorage } from '../utils/mcpEnvStorage';
import { OAuthDiscoveryService } from './OAuthDiscoveryService';

// Types
export interface McpInstallation {
  id: string;
  team_id: string;
  server_id: string;
  created_by: string;
  installation_name: string;
  installation_type: 'global' | 'team';
  team_args?: string[] | null; // Team-level shared arguments
  team_env?: Record<string, string> | null; // Team-level shared environment variables (decrypted for response)
  team_headers?: Record<string, string> | null; // Team-level shared headers (decrypted for response)
  team_url_query_params?: Record<string, string> | null; // Team-level shared URL query parameters
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
  // Joined server information
  server?: {
    id: string;
    name: string;
    description: string;
    language: string; // Required in DB
    runtime: string;
    status: string; // Required in DB with default 'active'
    author_name: string | null; // Optional in DB
    website_url: string | null; // Optional in DB
    icon_url: string | null; // Optional in DB
    repository_url: string | null; // Optional in DB
    repository_source: string | null; // Optional in DB
    repository_id: string | null; // Optional in DB
    repository_subfolder: string | null; // Optional in DB
    tags: string[] | null; // Optional in DB
    packages: any[];
    remotes: any[] | null;
    requires_oauth: boolean; // OAuth requirement flag
    // Three-tier schema fields
    template_args: any[] | null;
    template_env: Record<string, string> | null;
    template_headers: any[] | null;
    template_url_query_params: any[] | null;
    team_args_schema: any[] | null;
    team_env_schema: any[] | null;
    team_headers_schema: any[] | null;
    team_url_query_params_schema: any[] | null;
    user_args_schema: any[] | null;
    user_env_schema: any[] | null;
    user_headers_schema: any[] | null;
    user_url_query_params_schema: any[] | null;
    transport_type: 'stdio' | 'http' | 'sse';
  };
}

export interface CreateMcpInstallationRequest {
  server_id: string;
  installation_name: string;
  installation_type?: 'global' | 'team';
  team_args?: string[];
  team_env?: Record<string, string>;
  team_headers?: Record<string, string>;
  team_url_query_params?: Record<string, string>;
}

export interface UpdateMcpInstallationRequest {
  installation_name?: string;
  team_args?: string[];
  team_env?: Record<string, string>;
  team_headers?: Record<string, string>;
  team_url_query_params?: Record<string, string>;
}

export interface ClientConfig {
  claude_desktop: any;
  vscode: any;
  cursor: any;
}

export class McpInstallationService {
  private readonly mcpServerInstallations: ReturnType<typeof getSchema>['mcpServerInstallations'];
  private readonly mcpServers: ReturnType<typeof getSchema>['mcpServers'];
  private readonly teams: ReturnType<typeof getSchema>['teams'];

  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {
    const schema = getSchema();
    this.mcpServerInstallations = schema.mcpServerInstallations;
    this.mcpServers = schema.mcpServers;
    this.teams = schema.teams;
  }

  async getTeamInstallations(teamId: string, userId: string): Promise<McpInstallation[]> {
    this.logger.debug({
      operation: 'get_team_installations',
      teamId,
      userId
    }, 'Getting MCP installations for team');

    const installations = await this.db
      .select({
        installation: this.mcpServerInstallations,
        server: this.mcpServers
      })
      .from(this.mcpServerInstallations)
      .leftJoin(this.mcpServers, eq(this.mcpServerInstallations.server_id, this.mcpServers.id))
      .where(eq(this.mcpServerInstallations.team_id, teamId))
      .orderBy(desc(this.mcpServerInstallations.created_at));

    this.logger.info({
      operation: 'get_team_installations',
      teamId,
      installationsFound: installations.length
    }, 'Retrieved MCP installations for team');

    const processedInstallations = [];
    
    for (const row of installations) {
      const teamEnv = row.installation.team_env 
        ? await this.maskEnvironmentVariables(
            row.installation.team_env, 
            this.parseJsonField(row.server?.team_env_schema, [])
          )
        : null;

      const teamArgs = row.installation.team_args 
        ? await McpArgsStorage.retrieveTeamArgs(
            row.installation.team_args,
            this.parseJsonField(row.server?.team_args_schema, []),
            { maskSecrets: true, decryptSecrets: false },
            this.logger
          )
        : null;

      processedInstallations.push({
        ...row.installation,
        installation_type: row.installation.installation_type as 'global' | 'team',
        last_used_at: row.installation.last_used_at ?? undefined,
        team_args: teamArgs,
        team_env: teamEnv,
        team_headers: row.installation.team_headers
          ? this.parseJsonField(row.installation.team_headers, {})
          : null,
        team_url_query_params: row.installation.team_url_query_params
          ? this.parseJsonField(row.installation.team_url_query_params, {})
          : null,
        server: row.server ? {
          id: row.server.id,
          name: row.server.name,
          description: row.server.description,
          language: row.server.language,
          runtime: row.server.runtime,
          status: row.server.status,
          author_name: row.server.author_name,
          website_url: row.server.website_url,
          icon_url: row.server.icon_url,
          repository_url: row.server.repository_url,
        repository_source: row.server.repository_source,
        repository_id: row.server.repository_id,
        repository_subfolder: row.server.repository_subfolder,
          tags: this.parseJsonField(row.server.tags, []),
          packages: this.parseJsonField(row.server.packages, []),
          remotes: this.parseJsonField(row.server.remotes, null),
          template_args: this.parseJsonField(row.server.template_args, []),
          template_env: this.parseJsonField(row.server.template_env, {}),
          template_headers: this.parseJsonField(row.server.template_headers, []),
          template_url_query_params: this.parseJsonField(row.server.template_url_query_params, []),
          team_args_schema: this.parseJsonField(row.server.team_args_schema, []),
          team_env_schema: this.parseJsonField(row.server.team_env_schema, []),
          team_headers_schema: this.parseJsonField(row.server.team_headers_schema, []),
          team_url_query_params_schema: this.parseJsonField(row.server.team_url_query_params_schema, []),
          user_args_schema: this.parseJsonField(row.server.user_args_schema, []),
          user_env_schema: this.parseJsonField(row.server.user_env_schema, []),
          user_headers_schema: this.parseJsonField(row.server.user_headers_schema, []),
          user_url_query_params_schema: this.parseJsonField(row.server.user_url_query_params_schema, []),
          transport_type: row.server.transport_type,
          requires_oauth: row.server.requires_oauth || false
        } : undefined
      });
    }

    return processedInstallations;
  }

  async getInstallationById(installationId: string, teamId: string): Promise<McpInstallation | null> {
    this.logger.debug({
      operation: 'get_installation_by_id',
      installationId,
      teamId
    }, 'Getting MCP installation by ID');

    const result = await this.db
      .select({
        installation: this.mcpServerInstallations,
        server: this.mcpServers
      })
      .from(this.mcpServerInstallations)
      .leftJoin(this.mcpServers, eq(this.mcpServerInstallations.server_id, this.mcpServers.id))
      .where(
        and(
          eq(this.mcpServerInstallations.id, installationId),
          eq(this.mcpServerInstallations.team_id, teamId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      this.logger.debug({
        operation: 'get_installation_by_id',
        installationId,
        teamId
      }, 'MCP installation not found');
      return null;
    }

    const { installation, server } = result[0];

    const teamArgs = installation.team_args 
      ? await McpArgsStorage.retrieveTeamArgs(
          installation.team_args,
          this.parseJsonField(server?.team_args_schema, []),
          { maskSecrets: true, decryptSecrets: false },
          this.logger
        )
      : null;

    return {
      ...installation,
      installation_type: installation.installation_type as 'global' | 'team',
      last_used_at: installation.last_used_at ?? undefined,
      team_args: teamArgs,
      team_env: installation.team_env
        ? await this.maskEnvironmentVariables(
            installation.team_env,
            this.parseJsonField(server?.team_env_schema, [])
          )
        : null,
      team_headers: installation.team_headers
        ? this.parseJsonField(installation.team_headers, {})
        : null,
      team_url_query_params: installation.team_url_query_params
        ? this.parseJsonField(installation.team_url_query_params, {})
        : null,
      server: server ? {
        id: server.id,
        name: server.name,
        description: server.description,
        language: server.language,
        runtime: server.runtime,
        status: server.status,
        author_name: server.author_name,
        website_url: server.website_url,
        icon_url: server.icon_url,
        repository_url: server.repository_url,
        repository_source: server.repository_source,
        repository_id: server.repository_id,
        repository_subfolder: server.repository_subfolder,
        tags: this.parseJsonField(server.tags, []),
        packages: this.parseJsonField(server.packages, []),
        remotes: this.parseJsonField(server.remotes, null),
        template_args: this.parseJsonField(server.template_args, []),
        template_env: this.parseJsonField(server.template_env, {}),
        template_headers: this.parseJsonField(server.template_headers, []),
        template_url_query_params: this.parseJsonField(server.template_url_query_params, []),
        team_args_schema: this.parseJsonField(server.team_args_schema, []),
        team_env_schema: this.parseJsonField(server.team_env_schema, []),
        team_headers_schema: this.parseJsonField(server.team_headers_schema, []),
        team_url_query_params_schema: this.parseJsonField(server.team_url_query_params_schema, []),
        user_args_schema: this.parseJsonField(server.user_args_schema, []),
        user_env_schema: this.parseJsonField(server.user_env_schema, []),
        user_headers_schema: this.parseJsonField(server.user_headers_schema, []),
        user_url_query_params_schema: this.parseJsonField(server.user_url_query_params_schema, []),
        transport_type: server.transport_type,
        requires_oauth: server.requires_oauth || false
      } : undefined
    };
  }

  async createInstallation(
    teamId: string,
    userId: string,
    data: CreateMcpInstallationRequest
  ): Promise<McpInstallation> {
    this.logger.debug({
      operation: 'create_installation',
      teamId,
      userId,
      serverId: data.server_id,
      installationName: data.installation_name
    }, 'Creating MCP installation');

    // Check if installation name already exists in team
    const existingInstallation = await this.db
      .select()
      .from(this.mcpServerInstallations)
      .where(
        and(
          eq(this.mcpServerInstallations.team_id, teamId),
          eq(this.mcpServerInstallations.installation_name, data.installation_name)
        )
      )
      .limit(1);

    if (existingInstallation.length > 0) {
      throw new Error('An installation with this name already exists in the team');
    }

    // Verify server exists
    const server = await this.db
      .select()
      .from(this.mcpServers)
      .where(eq(this.mcpServers.id, data.server_id))
      .limit(1);

    if (server.length === 0) {
      throw new Error('Server not found');
    }

    // Check total MCP server installation limit (applies to all transport types)
    this.logger.debug({
      operation: 'create_installation',
      step: 'check_mcp_server_limit',
      teamId,
      serverId: data.server_id
    }, 'Checking total MCP server installation limit');

    // Get team data to access the limit
    const teamResult = await this.db
      .select()
      .from(this.teams)
      .where(eq(this.teams.id, teamId))
      .limit(1);

    if (teamResult.length === 0) {
      throw new Error('Team not found');
    }

    const team = teamResult[0];
    const totalLimit = team.mcp_server_limit;

    // Count current total installations for this team
    const currentTotalInstallations = await this.db
      .select()
      .from(this.mcpServerInstallations)
      .where(eq(this.mcpServerInstallations.team_id, teamId));

    const totalCount = currentTotalInstallations.length;

    this.logger.debug({
      operation: 'create_installation',
      step: 'check_mcp_server_limit',
      teamId,
      totalCount,
      totalLimit
    }, `Current total installations: ${totalCount}/${totalLimit}`);

    // Check if total limit would be exceeded
    if (totalCount >= totalLimit) {
      const errorMessage = `Team has reached the maximum limit of ${totalLimit} MCP server installation${totalLimit === 1 ? '' : 's'}. Contact your administrator to increase the limit.`;

      this.logger.warn({
        operation: 'create_installation',
        step: 'check_mcp_server_limit',
        teamId,
        totalCount,
        totalLimit,
        serverId: data.server_id
      }, 'Total MCP server installation limit exceeded');

      throw new Error(errorMessage);
    }

    this.logger.info({
      operation: 'create_installation',
      step: 'check_mcp_server_limit',
      teamId,
      totalCount,
      totalLimit
    }, 'Total MCP server installation limit check passed');

    // OAuth detection for remote MCP servers (HTTP/SSE)
    if (server[0].transport_type === 'http' || server[0].transport_type === 'sse') {
      this.logger.debug({
        operation: 'create_installation',
        step: 'oauth_detection',
        serverId: data.server_id,
        transportType: server[0].transport_type
      }, 'Checking OAuth requirement for remote MCP server');

      try {
        const remotes = this.parseJsonField(server[0].remotes, []);

        if (remotes.length > 0 && remotes[0].url) {
          const mcpServerUrl = remotes[0].url;

          this.logger.info({
            operation: 'create_installation',
            step: 'oauth_detection',
            mcpServerUrl
          }, 'Performing OAuth detection');

          const oauthService = new OAuthDiscoveryService(this.logger);
          const oauthResult = await oauthService.detectAndDiscoverOAuth(mcpServerUrl);

          if (oauthResult.requiresOauth) {
            this.logger.info({
              operation: 'create_installation',
              step: 'oauth_detection',
              serverId: data.server_id,
              authEndpoint: oauthResult.metadata?.authorization_endpoint,
              tokenEndpoint: oauthResult.metadata?.token_endpoint
            }, 'OAuth requirement detected, updating server record');

            // Update server record with requires_oauth flag
            await this.db
              .update(this.mcpServers)
              .set({ requires_oauth: true })
              .where(eq(this.mcpServers.id, data.server_id));

            // Throw error with OAuth metadata for frontend to handle
            // Phase 5 will implement the OAuth flow redirect
            throw new Error(
              JSON.stringify({
                error: 'oauth_required',
                server_id: data.server_id,
                server_name: server[0].name,
                metadata: oauthResult.metadata
              })
            );
          }

          this.logger.info({
            operation: 'create_installation',
            step: 'oauth_detection',
            serverId: data.server_id
          }, 'OAuth not required, continuing with installation');
        }
      } catch (error) {
        // If error is already our OAuth required error, re-throw it
        if (error instanceof Error && error.message.includes('oauth_required')) {
          throw error;
        }

        // For other errors, log but don't block installation
        this.logger.warn({
          operation: 'create_installation',
          step: 'oauth_detection',
          serverId: data.server_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'OAuth detection failed, continuing with installation');
      }
    }

    // Check non-HTTP MCP installation limit (stdio servers only)
    if (server[0].transport_type === 'stdio') {
      this.logger.debug({
        operation: 'create_installation',
        step: 'check_non_http_limit',
        teamId,
        serverId: data.server_id,
        transportType: server[0].transport_type
      }, 'Checking non-HTTP MCP installation limit');

      // Reuse team data from earlier query
      const limit = team.non_http_mcp_limit;

      this.logger.debug({
        operation: 'create_installation',
        step: 'check_non_http_limit',
        teamId,
        limit
      }, `Team non-HTTP MCP limit: ${limit}`);

      // Count current non-HTTP (stdio) installations for this team
      const currentInstallations = await this.db
        .select({
          installation: this.mcpServerInstallations,
          server: this.mcpServers
        })
        .from(this.mcpServerInstallations)
        .leftJoin(this.mcpServers, eq(this.mcpServerInstallations.server_id, this.mcpServers.id))
        .where(eq(this.mcpServerInstallations.team_id, teamId));

      // Count only stdio servers
      const nonHttpCount = currentInstallations.filter(
        (row: any) => row.server?.transport_type === 'stdio'
      ).length;

      this.logger.debug({
        operation: 'create_installation',
        step: 'check_non_http_limit',
        teamId,
        nonHttpCount,
        limit
      }, `Current non-HTTP installations: ${nonHttpCount}/${limit}`);

      // Check if limit would be exceeded
      if (nonHttpCount >= limit) {
        const errorMessage = `Team has reached the maximum limit of ${limit} non-HTTP (stdio) MCP server${limit === 1 ? '' : 's'}. HTTP and SSE servers are not affected by this limit. Contact your administrator to increase the limit.`;

        this.logger.warn({
          operation: 'create_installation',
          step: 'check_non_http_limit',
          teamId,
          nonHttpCount,
          limit,
          serverId: data.server_id
        }, 'Non-HTTP MCP installation limit exceeded');

        throw new Error(errorMessage);
      }

      this.logger.info({
        operation: 'create_installation',
        step: 'check_non_http_limit',
        teamId,
        nonHttpCount,
        limit
      }, 'Non-HTTP MCP installation limit check passed');
    }

    // Validate team environment variables against server schema
    if (data.team_env) {
      this.validateEnvironmentVariables(
        data.team_env,
        this.parseJsonField(server[0].team_env_schema, [])
      );
    }

    const installationId = nanoid();
    const now = new Date();

    const installationData = {
      id: installationId,
      team_id: teamId,
      server_id: data.server_id,
      created_by: userId,
      installation_name: data.installation_name,
      installation_type: data.installation_type || 'global',
      team_args: data.team_args 
        ? await this.encryptArguments(
            data.team_args, 
            this.parseJsonField(server[0].team_args_schema, [])
          )
        : null,
      team_env: data.team_env
        ? await this.encryptEnvironmentVariables(
            data.team_env,
            this.parseJsonField(server[0].team_env_schema, [])
          )
        : null,
      team_headers: data.team_headers
        ? JSON.stringify(data.team_headers)
        : null,
      team_url_query_params: data.team_url_query_params
        ? JSON.stringify(data.team_url_query_params)
        : null,
      created_at: now,
      updated_at: now,
      last_used_at: null
    };

    await this.db.insert(this.mcpServerInstallations).values(installationData);

    this.logger.info({
      operation: 'create_installation',
      installationId,
      teamId,
      serverId: data.server_id
    }, 'Successfully created MCP installation');

    // Return the created installation with server info
    const created = await this.getInstallationById(installationId, teamId);
    if (!created) {
      throw new Error('Failed to retrieve created installation');
    }

    return created;
  }

  async updateInstallation(
    installationId: string,
    teamId: string,
    userId: string,
    data: UpdateMcpInstallationRequest
  ): Promise<McpInstallation | null> {
    this.logger.debug({
      operation: 'update_installation',
      installationId,
      teamId,
      userId
    }, 'Updating MCP installation');

    // Get existing installation
    const existing = await this.getInstallationById(installationId, teamId);
    if (!existing) {
      return null;
    }

    const updateData: any = {
      updated_at: new Date()
    };

    if (data.installation_name !== undefined) {
      // Check if new name conflicts with existing installations
      const conflictingInstallation = await this.db
        .select()
        .from(this.mcpServerInstallations)
        .where(
          and(
            eq(this.mcpServerInstallations.team_id, teamId),
            eq(this.mcpServerInstallations.installation_name, data.installation_name),
            eq(this.mcpServerInstallations.id, installationId) // Exclude current installation
          )
        )
        .limit(1);

      if (conflictingInstallation.length > 0) {
        throw new Error('An installation with this name already exists in the team');
      }

      updateData.installation_name = data.installation_name;
    }

    if (data.team_env !== undefined) {
      // Validate against server schema
      if (existing.server?.team_env_schema) {
        this.validateEnvironmentVariables(
          data.team_env,
          existing.server.team_env_schema
        );
      }

      updateData.team_env = data.team_env
        ? await this.encryptEnvironmentVariables(
            data.team_env, 
            existing.server?.team_env_schema || []
          )
        : null;
    }

    if (data.team_args !== undefined) {
      updateData.team_args = data.team_args
        ? await this.encryptArguments(
            data.team_args, 
            existing.server?.team_args_schema || []
          )
        : null;
    }

    if (data.team_headers !== undefined) {
      updateData.team_headers = data.team_headers
        ? JSON.stringify(data.team_headers)
        : null;
    }

    if (data.team_url_query_params !== undefined) {
      updateData.team_url_query_params = data.team_url_query_params
        ? JSON.stringify(data.team_url_query_params)
        : null;
    }

    await this.db
      .update(this.mcpServerInstallations)
      .set(updateData)
      .where(eq(this.mcpServerInstallations.id, installationId));

    this.logger.info({
      operation: 'update_installation',
      installationId,
      updatedFields: Object.keys(updateData)
    }, 'Successfully updated MCP installation');

    return await this.getInstallationById(installationId, teamId);
  }

  async deleteInstallation(installationId: string, teamId: string): Promise<boolean> {
    this.logger.debug({
      operation: 'delete_installation',
      installationId,
      teamId
    }, 'Deleting MCP installation');

    const result = await this.db
      .delete(this.mcpServerInstallations)
      .where(
        and(
          eq(this.mcpServerInstallations.id, installationId),
          eq(this.mcpServerInstallations.team_id, teamId)
        )
      );

    // PostgreSQL returns rowCount for deleted rows
    const deleted = (result.rowCount || 0) > 0;

    return deleted;
  }

  /**
   * Get all installations for a specific MCP server
   * Used for cascade deletion when a global server is removed
   */
  async getInstallationsByServerId(serverId: string): Promise<Array<{
    id: string;
    team_id: string;
    installation_name: string;
    server_id: string;
    created_by: string;
  }>> {
    this.logger.debug({
      operation: 'get_installations_by_server_id',
      serverId
    }, 'Getting all installations for MCP server');

    const installations = await this.db
      .select({
        id: this.mcpServerInstallations.id,
        team_id: this.mcpServerInstallations.team_id,
        installation_name: this.mcpServerInstallations.installation_name,
        server_id: this.mcpServerInstallations.server_id,
        created_by: this.mcpServerInstallations.created_by
      })
      .from(this.mcpServerInstallations)
      .where(eq(this.mcpServerInstallations.server_id, serverId));

    this.logger.info({
      operation: 'get_installations_by_server_id',
      serverId,
      installationsFound: installations.length
    }, 'Retrieved installations for MCP server');

    return installations;
  }

  async generateClientConfig(
    installationId: string,
    teamId: string,
    clientType: 'claude-desktop' | 'vscode' | 'cursor'
  ): Promise<any> {
    this.logger.debug({
      operation: 'generate_client_config',
      installationId,
      teamId,
      clientType
    }, 'Generating client configuration');

    // Get installation data directly from database to access encrypted values
    const result = await this.db
      .select({
        installation: this.mcpServerInstallations,
        server: this.mcpServers
      })
      .from(this.mcpServerInstallations)
      .leftJoin(this.mcpServers, eq(this.mcpServerInstallations.server_id, this.mcpServers.id))
      .where(
        and(
          eq(this.mcpServerInstallations.id, installationId),
          eq(this.mcpServerInstallations.team_id, teamId)
        )
      )
      .limit(1);

    if (result.length === 0 || !result[0].server) {
      throw new Error('Installation not found');
    }

    const { installation, server } = result[0];

    // Update last_used_at
    await this.db
      .update(this.mcpServerInstallations)
      .set({ last_used_at: new Date() })
      .where(eq(this.mcpServerInstallations.id, installationId));

    // Get command configuration from server's packages
    const packages = this.parseJsonField(server.packages, []);
    
    if (!packages || packages.length === 0) {
      throw new Error('Server has no package configuration');
    }

    // Use the first package's transport configuration
    const packageConfig = packages[0];
    if (!packageConfig.transport) {
      throw new Error('Server package has no transport configuration');
    }

    // For gateway config generation, we need to decrypt secrets (authorized use case)
    const decryptedTeamEnv = installation.team_env 
      ? await this.decryptEnvironmentVariables(
          installation.team_env, 
          this.parseJsonField(server.team_env_schema, [])
        )
      : null;

    // Merge environment variables from package config with team environment variables (with decrypted secrets)
    const mergedEnv = {};
    if (decryptedTeamEnv) {
      Object.assign(mergedEnv, decryptedTeamEnv);
    }

    const baseConfig = {
      command: packageConfig.transport.command,
      args: packageConfig.transport.args,
      env: mergedEnv
    };

    // Generate client-specific configuration
    switch (clientType) {
      case 'claude-desktop':
        return {
          mcpServers: {
            [installation.installation_name]: baseConfig
          }
        };

      case 'vscode':
        return this.generateVSCodeConfig({
          ...installation,
          installation_type: installation.installation_type as 'global' | 'team',
          team_args: null,
          team_env: null
        } as any, baseConfig);

      case 'cursor':
        return {
          mcpServers: {
            [installation.installation_name]: baseConfig
          }
        };

      default:
        throw new Error(`Unsupported client type: ${clientType}`);
    }
  }

  private generateVSCodeConfig(installation: McpInstallation, baseConfig: any): any {
    const inputs: any[] = [];
    const serverConfig: any = {
      type: 'stdio',
      command: baseConfig.command,
      args: baseConfig.args,
      env: {}
    };

    // Generate inputs for environment variables
    if (baseConfig.env) {
      Object.entries(baseConfig.env).forEach(([key]) => {
        const inputId = `${installation.installation_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${key.toLowerCase()}`;
        
        inputs.push({
          type: 'promptString',
          id: inputId,
          description: `${key} for ${installation.installation_name}`,
          password: true
        });

        serverConfig.env[key] = `\${input:${inputId}}`;
      });
    }

    return {
      inputs,
      servers: {
        [installation.installation_name.toLowerCase().replace(/[^a-z0-9]/g, '_')]: serverConfig
      }
    };
  }

  private validateEnvironmentVariables(
    userVars: Record<string, string>,
    serverSchema: any[]
  ): void {
    const requiredVars = serverSchema.filter((envVar: any) => envVar.required);
    
    for (const requiredVar of requiredVars) {
      if (!userVars[requiredVar.name] || userVars[requiredVar.name].trim() === '') {
        throw new Error(`Required environment variable '${requiredVar.name}' is missing or empty`);
      }
    }
  }

  private async encryptArguments(
    args: string[],
    schema?: any[]
  ): Promise<string> {
    return await McpArgsStorage.storeTeamArgs(args, schema || [], this.logger);
  }

  private async encryptEnvironmentVariables(
    vars: Record<string, string>,
    schema?: any[]
  ): Promise<string> {
    return await McpEnvStorage.storeTeamEnv(vars, schema || [], this.logger);
  }

  private async decryptEnvironmentVariables(
    encryptedVars: string,
    schema?: any[]
  ): Promise<Record<string, string>> {
    return await McpEnvStorage.retrieveTeamEnv(
      encryptedVars,
      schema || [],
      { maskSecrets: false, decryptSecrets: true },
      this.logger
    );
  }

  private async maskEnvironmentVariables(
    encryptedVars: string,
    schema?: any[]
  ): Promise<Record<string, string>> {
    return await McpEnvStorage.retrieveTeamEnv(
      encryptedVars,
      schema || [],
      { maskSecrets: true, decryptSecrets: false },
      this.logger
    );
  }

  private parseJsonField(fieldValue: any, defaultValue: any): any {
    if (!fieldValue || fieldValue === '' || fieldValue.trim() === '') {
      return defaultValue;
    }
    if (typeof fieldValue !== 'string') {
      return fieldValue;
    }
    try {
      return JSON.parse(fieldValue);
    } catch (e) {
      this.logger.warn({
        field: 'json_field',
        fieldValue,
        error: e
      }, 'Failed to parse JSON field, using default value');
      return defaultValue;
    }
  }
}
