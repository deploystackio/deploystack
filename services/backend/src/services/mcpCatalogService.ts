/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, or, ilike, desc, asc } from 'drizzle-orm';
import { getSchema } from '../db/index';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { GitHubService } from './githubService';
import { nanoid } from 'nanoid';

// Types
export interface McpServer {
  id: string;
  name: string;
  slug: string;
  description: string;
  long_description?: string;
  repository_url?: string;
  repository_source?: string;
  repository_id?: string;
  repository_subfolder?: string;
  git_branch?: string;
  website_url?: string;
  icon_url?: string;
  language: string;
  runtime: string;
  packages: string; // JSON
  remotes?: string; // JSON
  resources?: string; // JSON
  prompts?: string; // JSON
  visibility: 'global' | 'team';
  owner_team_id?: string;
  created_by: string;
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  transport_type: 'stdio' | 'http' | 'sse';
  github_account_id?: string;
  github_readme_base64?: string;
  github_stars?: number;
  // Three-tier configuration schema
  template_args?: string; // JSON: Fixed args that never change
  template_env?: string; // JSON: Fixed env vars that never change
  template_headers?: string; // JSON: Fixed headers that never change
  template_url_query_params?: string; // JSON: Fixed URL query params that never change
  team_args_schema?: string; // JSON: Schema for team-level args
  team_env_schema?: string; // JSON: Schema for team-level env vars
  team_headers_schema?: string; // JSON: Schema for team-level headers
  team_url_query_params_schema?: string; // JSON: Schema for team-level URL query params
  user_args_schema?: string; // JSON: Schema for user-level args
  user_env_schema?: string; // JSON: Schema for user-level env vars
  user_headers_schema?: string; // JSON: Schema for user-level headers
  user_url_query_params_schema?: string; // JSON: Schema for user-level URL query params
  dependencies?: string; // JSON
  category_id?: string;
  tags?: string; // JSON
  status: 'active' | 'deprecated' | 'maintenance' | 'disabled';
  featured: boolean;
  auto_install_new_default_team: boolean;
  requires_oauth: boolean;

  // Official Registry Sync Tracking
  official_name?: string | null;
  synced_from_official_registry?: boolean;
  official_registry_server_id?: string | null;
  official_registry_version_id?: string | null;
  official_registry_published_at?: Date | null;
  official_registry_updated_at?: Date | null;
  
  created_at: Date;
  updated_at: Date;
  last_sync_at?: Date;
}

export interface CreateMcpServerRequest {
  name: string;
  description: string;
  long_description?: string;
  repository_url?: string;
  repository_source?: string;
  repository_id?: string;
  repository_subfolder?: string;
  git_branch?: string;
  website_url?: string;
  icon_url?: string;

  // Version information
  version?: string;
  
  language: string;
  runtime: string;
  packages: any[]; // Will be JSON stringified - MCP Registry packages array
  remotes?: any[]; // Will be JSON stringified - MCP Registry remotes array
  resources?: any[]; // Will be JSON stringified
  prompts?: any[]; // Will be JSON stringified
  visibility: 'global' | 'team';
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  transport_type?: 'stdio' | 'http' | 'sse'; // MCP transport type
  github_account_id?: string | null;
  github_readme_base64?: string | null;
  github_stars?: number | null;
  // Three-tier configuration schema
  template_args?: any[]; // Fixed args that never change (e.g., ["-y", "@modelcontextprotocol/server-filesystem"])
  template_env?: any; // Fixed env vars that never change (e.g., {"FIXED_VAR": "fixed_value"})
  template_headers?: any; // Fixed headers that never change (e.g., {"Authorization": "Bearer fixed_token"})
  template_url_query_params?: any; // Fixed URL query params that never change (e.g., {"token": "fixed_token_value"})
  team_args_schema?: any[]; // Schema for team-level args (e.g., [{name: "api_key", type: "string", required: true}])
  team_env_schema?: any[]; // Schema for team-level env vars
  team_headers_schema?: any[]; // Schema for team-level headers
  team_url_query_params_schema?: any[]; // Schema for team-level URL query params
  user_args_schema?: any[]; // Schema for user-level args (e.g., [{name: "local_path", type: "string", required: true}])
  user_env_schema?: any[]; // Schema for user-level env vars
  user_headers_schema?: any[]; // Schema for user-level headers
  user_url_query_params_schema?: any[]; // Schema for user-level URL query params
  dependencies?: any; // Will be JSON stringified
  category_id?: string;
  tags?: string[];
  featured?: boolean;
  auto_install_new_default_team?: boolean;
  requires_oauth?: boolean;
  skip_oauth_flow?: boolean;
  source?: 'official_registry' | 'manual' | 'github';

  // Official Registry Sync Tracking
  official_name?: string;
  synced_from_official_registry?: boolean;
  official_registry_server_id?: string | null;
  official_registry_version_id?: string | null;
  official_registry_published_at?: Date | null;
  official_registry_updated_at?: Date | null;
}

export interface UpdateMcpServerRequest {
  name?: string;
  slug?: string;
  description?: string;
  long_description?: string;
  repository_url?: string;
  repository_source?: string;
  repository_id?: string;
  repository_subfolder?: string;
  git_branch?: string;
  website_url?: string;
  icon_url?: string;
  language?: string;
  runtime?: string;
  packages?: any[];
  remotes?: any[];
  resources?: any[];
  prompts?: any[];
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  transport_type?: 'stdio' | 'http' | 'sse';
  github_account_id?: string;
  github_readme_base64?: string;
  github_stars?: number;
  // Three-tier configuration schema
  template_args?: any[];
  template_env?: any;
  template_headers?: any;
  template_url_query_params?: any;
  team_args_schema?: any[];
  team_env_schema?: any[];
  team_headers_schema?: any[];
  team_url_query_params_schema?: any[];
  user_args_schema?: any[];
  user_env_schema?: any[];
  user_headers_schema?: any[];
  user_url_query_params_schema?: any[];
  dependencies?: any;
  category_id?: string;
  tags?: string[];
  status?: 'active' | 'deprecated' | 'maintenance' | 'disabled';
  featured?: boolean;
  auto_install_new_default_team?: boolean;
  requires_oauth?: boolean;
  skip_oauth_flow?: boolean;
}

export interface McpServerFilters {
  visibility?: 'global' | 'team';
  category_id?: string;
  language?: string;
  runtime?: string;
  status?: 'active' | 'deprecated' | 'maintenance' | 'disabled';
  featured?: boolean;
  source?: 'official_registry' | 'manual' | 'github';
  search?: string;
  tags?: string;
}

export class McpSlugService {
  static async generateSlug(
    name: string, 
    visibility: 'global' | 'team', 
    teamId: string | undefined,
    db: AnyDatabase
  ): Promise<string> {
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    if (visibility === 'global') {
      // Global servers: simple slug (e.g., "playwright-mcp")
      return await this.ensureUniqueSlug(baseSlug, db);
    } else {
      // Team servers: prefix with first 8 chars of team UUID (e.g., "f7d46d33-playwright-mcp")
      if (!teamId) {
        throw new Error('Team ID is required for team servers');
      }
      const teamPrefix = teamId.substring(0, 8);
      const teamSlug = `${teamPrefix}-${baseSlug}`;
      return await this.ensureUniqueSlug(teamSlug, db);
    }
  }
  
  private static async ensureUniqueSlug(baseSlug: string, db: AnyDatabase): Promise<string> {
    const mcpServers = getSchema().mcpServers;
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.select().from(mcpServers).where(eq(mcpServers.slug, slug)).limit(1);
      if (existing.length === 0) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
}

export class McpCatalogService {
  private readonly mcpServers: ReturnType<typeof getSchema>['mcpServers'];

  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {
    const schema = getSchema();
    this.mcpServers = schema.mcpServers;
  }
  
  // Get servers visible to a user based on their role and team memberships
  async getServersForUser(
    userId: string, 
    userRole: string, 
    teamIds: string[],
    filters?: McpServerFilters,
    sortBy: 'name' | 'github_stars' = 'name'
  ): Promise<McpServer[]> {
    this.logger.debug({
      operation: 'get_servers_for_user',
      userId,
      userRole,
      teamIds: teamIds.length,
      filters
    }, 'Getting MCP servers for user');
    
    // Build all WHERE conditions in an array
    const whereConditions: any[] = [];
    
    // Apply visibility filters based on user role
    if (userRole === 'global_admin') {
      // Global admin sees ALL servers - no visibility restrictions
      this.logger.debug('Global admin - showing all servers');
    } else {
      // Regular users see global servers + their team servers
      whereConditions.push(
        or(
          eq(this.mcpServers.visibility, 'global'),
          and(
            eq(this.mcpServers.visibility, 'team'),
            teamIds.length > 0 ? or(...teamIds.map(teamId => eq(this.mcpServers.owner_team_id, teamId))) : eq(this.mcpServers.id, 'never-match')
          )
        )
      );

      // Regular users only see active servers (not disabled/deprecated/maintenance)
      // unless they explicitly filter by a specific status
      if (!filters?.status) {
        whereConditions.push(eq(this.mcpServers.status, 'active'));
      }
    }

    // Apply additional filters
    if (filters) {
      if (filters.category_id) {
        whereConditions.push(eq(this.mcpServers.category_id, filters.category_id));
      }
      if (filters.language) {
        whereConditions.push(eq(this.mcpServers.language, filters.language));
      }
      if (filters.runtime) {
        whereConditions.push(eq(this.mcpServers.runtime, filters.runtime));
      }
      if (filters.status) {
        whereConditions.push(eq(this.mcpServers.status, filters.status));
      }
      if (filters.featured !== undefined) {
        whereConditions.push(eq(this.mcpServers.featured, filters.featured));
      }
      if (filters.source) {
        whereConditions.push(eq(this.mcpServers.source, filters.source));
      }
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        whereConditions.push(
          or(
            ilike(this.mcpServers.name, searchTerm),
            ilike(this.mcpServers.description, searchTerm),
            ilike(this.mcpServers.tags, searchTerm)
          )
        );
      }
      if (filters.tags) {
        const tagList = filters.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (tagList.length > 0) {
          const tagConditions = tagList.map(tag => ilike(this.mcpServers.tags, `%${tag}%`));
          whereConditions.push(or(...tagConditions));
        }
      }
    }
    
    // Build the query with all conditions combined
    // Always join with teams table to get team info for servers that have owner_team_id
    const schema = getSchema();
    const { teams } = schema;

    const baseQuery = this.db
      .select()
      .from(this.mcpServers)
      .leftJoin(teams, eq(this.mcpServers.owner_team_id, teams.id));

    const queryWithConditions = whereConditions.length > 0
      ? baseQuery.where(and(...whereConditions))
      : baseQuery;

    // Apply sorting based on sortBy parameter
    const results = await (sortBy === 'github_stars'
      ? queryWithConditions.orderBy(desc(this.mcpServers.github_stars), asc(this.mcpServers.name))
      : queryWithConditions.orderBy(desc(this.mcpServers.featured), asc(this.mcpServers.name)));

    // Map the joined results to include team information
    const servers = results.map((row: any) => ({
      ...row.mcpServers,
      team_name: row.teams?.name || null,
      team_slug: row.teams?.slug || null,
      team_id: row.teams?.id || null
    }));
    
    this.logger.info({
      operation: 'get_servers_for_user',
      userId,
      userRole,
      serversFound: servers.length,
      appliedFilters: filters,
      whereConditionsCount: whereConditions.length
    }, 'Retrieved MCP servers for user');
    
    // Parse JSON fields for all servers
    return servers.map((server: any) => this.parseServerJsonFields(server)) as McpServer[];
  }
  
  async getServerById(serverId: string): Promise<McpServer | null> {
    this.logger.debug({
      operation: 'get_server_by_id',
      serverId
    }, 'Getting MCP server by ID');
    
    const servers = await this.db.select().from(this.mcpServers).where(eq(this.mcpServers.id, serverId)).limit(1);
    
    if (servers.length === 0) {
      this.logger.debug({
        operation: 'get_server_by_id',
        serverId
      }, 'MCP server not found');
      return null;
    }
    
    return this.parseServerJsonFields(servers[0]) as McpServer;
  }
  
  async createServer(
    userId: string, 
    userRole: string, 
    teamId: string | null, 
    data: CreateMcpServerRequest
  ): Promise<McpServer> {
    this.logger.debug({
      operation: 'create_mcp_server',
      userId,
      userRole,
      teamId,
      visibility: data.visibility,
      name: data.name
    }, 'Creating MCP server');
    
    // Validate permissions
    if (data.visibility === 'global' && userRole !== 'global_admin') {
      throw new Error('Only global administrators can create global servers');
    }
    
    if (data.visibility === 'team' && !teamId) {
      throw new Error('Team ID is required for team servers');
    }
    
    // Generate unique slug
    const slug = await McpSlugService.generateSlug(data.name, data.visibility, teamId || undefined, this.db);
    
    // Sync from GitHub if repository URL points to GitHub
    let githubInfo: any = {};
    if (data.repository_url && data.repository_url.includes('github.com')) {
      try {
        const repoInfo = await GitHubService.getRepositoryInfo(data.repository_url, this.logger);
        githubInfo = {
          description: data.description ?? repoInfo.description,
          long_description: data.long_description ?? repoInfo.description,
          language: data.language ?? repoInfo.language,
          website_url: data.website_url ?? repoInfo.homepage,
          license: data.license ?? repoInfo.license,
          tags: data.tags ?? repoInfo.topics,
          github_account_id: data.github_account_id ?? repoInfo.github_account_id
        };
        
        this.logger.info({
          operation: 'create_mcp_server',
          repositoryUrl: data.repository_url,
          syncedFields: Object.keys(githubInfo)
        }, 'Synced server info from GitHub');
      } catch (error) {
        this.logger.warn({
          operation: 'create_mcp_server',
          repositoryUrl: data.repository_url,
          error
        }, 'Failed to sync from GitHub, continuing with provided data');
      }
    }
    
    const serverId = nanoid();
    const now = new Date();
    
    const serverData = {
      id: serverId,
      name: data.name,
      slug,
      description: githubInfo.description ?? data.description,
      long_description: githubInfo.long_description ?? data.long_description,
      
      // Version information
      version: data.version || null,
      
      repository_url: data.repository_url,
      repository_source: data.repository_url ? (
        data.repository_url.includes('github.com') ? 'github' :
        data.repository_url.includes('gitlab.com') ? 'gitlab' :
        data.repository_url.includes('bitbucket.org') ? 'bitbucket' : null
      ) : null,
      repository_id: data.repository_url ? (
        data.repository_url.includes('github.com') ? 
          data.repository_url.split('github.com/')[1]?.replace('.git', '') :
        data.repository_url.includes('gitlab.com') ? 
          data.repository_url.split('gitlab.com/')[1]?.replace('.git', '') :
        data.repository_url.includes('bitbucket.org') ? 
          data.repository_url.split('bitbucket.org/')[1]?.replace('.git', '') :
          null
      ) : null,
      repository_subfolder: data.repository_subfolder || null,
      git_branch: data.repository_url ? (data.git_branch || 'main') : null,
      website_url: githubInfo.website_url || data.website_url,
      icon_url: data.icon_url || null,
      language: githubInfo.language || data.language,
      runtime: data.runtime,
      packages: JSON.stringify(data.packages),
      remotes: data.remotes ? JSON.stringify(data.remotes) : null,
      resources: data.resources ? JSON.stringify(data.resources) : null,
      prompts: data.prompts ? JSON.stringify(data.prompts) : null,
      visibility: data.visibility,
      owner_team_id: data.visibility === 'team' ? teamId : null,
      created_by: userId,
      author_name: data.author_name,
      author_contact: data.author_contact,
      organization: data.organization,
      license: githubInfo.license || data.license,
      transport_type: data.transport_type || 'stdio',
      github_account_id: githubInfo.github_account_id || data.github_account_id,
      github_readme_base64: data.github_readme_base64 || null,
      github_stars: githubInfo.stars || data.github_stars || null,
      // Three-tier configuration schema
      template_args: data.template_args ? JSON.stringify(data.template_args) : null,
      template_env: data.template_env ? JSON.stringify(data.template_env) : null,
      template_headers: data.template_headers ? JSON.stringify(data.template_headers) : null,
      template_url_query_params: data.template_url_query_params ? JSON.stringify(data.template_url_query_params) : null,
      team_args_schema: data.team_args_schema ? JSON.stringify(data.team_args_schema) : null,
      team_env_schema: data.team_env_schema ? JSON.stringify(data.team_env_schema) : null,
      team_headers_schema: data.team_headers_schema ? JSON.stringify(data.team_headers_schema) : null,
      team_url_query_params_schema: data.team_url_query_params_schema ? JSON.stringify(data.team_url_query_params_schema) : null,
      user_args_schema: data.user_args_schema ? JSON.stringify(data.user_args_schema) : null,
      user_env_schema: data.user_env_schema ? JSON.stringify(data.user_env_schema) : null,
      user_headers_schema: data.user_headers_schema ? JSON.stringify(data.user_headers_schema) : null,
      user_url_query_params_schema: data.user_url_query_params_schema ? JSON.stringify(data.user_url_query_params_schema) : null,
      dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
      category_id: data.category_id || null, // Ensure empty string becomes null
      tags: githubInfo.tags ? JSON.stringify(githubInfo.tags) : (data.tags ? JSON.stringify(data.tags) : null),
      status: 'active',
      featured: userRole === 'global_admin' ? (data.featured || false) : false,
      auto_install_new_default_team: userRole === 'global_admin' ? (data.auto_install_new_default_team || false) : false,
      requires_oauth: data.requires_oauth ?? false,
      skip_oauth_flow: data.skip_oauth_flow ?? false,
      source: (data as any).source || 'manual',

      // Official Registry Sync Tracking
      official_name: (data as any).official_name || null,
      synced_from_official_registry: (data as any).synced_from_official_registry || false,
      official_registry_server_id: (data as any).official_registry_server_id || null,
      official_registry_version_id: (data as any).official_registry_version_id || null,
      official_registry_published_at: (data as any).official_registry_published_at || null,
      official_registry_updated_at: (data as any).official_registry_updated_at || null,
      
      created_at: now,
      updated_at: now,
      last_sync_at: data.repository_url && data.repository_url.includes('github.com') ? now : null
    };
    
    await this.db.insert(this.mcpServers).values(serverData);
    
    this.logger.info({
      operation: 'create_mcp_server',
      serverId,
      slug,
      visibility: data.visibility,
      teamId
    }, 'Successfully created MCP server');
    
    return serverData as McpServer;
  }
  
  async updateServer(
    serverId: string, 
    userId: string, 
    userRole: string, 
    data: UpdateMcpServerRequest
  ): Promise<McpServer | null> {
    this.logger.debug({
      operation: 'update_mcp_server',
      serverId,
      userId,
      userRole
    }, 'Updating MCP server');
    
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error('Server not found');
    }
    
    // Check permissions
    if (!this.canUserManageServer(server, userId, userRole)) {
      throw new Error('Insufficient permissions to update this server');
    }
    
    const updateData: any = {
      updated_at: new Date()
    };
    
    // Only allow certain fields to be updated
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.long_description !== undefined) updateData.long_description = data.long_description;
    if (data.repository_url !== undefined) updateData.repository_url = data.repository_url;
    if (data.repository_source !== undefined) updateData.repository_source = data.repository_source;
    if (data.repository_id !== undefined) updateData.repository_id = data.repository_id;
    if (data.repository_subfolder !== undefined) updateData.repository_subfolder = data.repository_subfolder;
    // Clear git_branch if repository_url is being cleared or set git_branch if provided with repository_url
    if (data.git_branch !== undefined) {
      // If repository_url is being explicitly set to null/empty, clear git_branch
      if (data.repository_url !== undefined && !data.repository_url) {
        updateData.git_branch = null;
      } else {
        updateData.git_branch = data.git_branch;
      }
    } else if (data.repository_url !== undefined && !data.repository_url) {
      // If only repository_url is being cleared (git_branch not in request), also clear git_branch
      updateData.git_branch = null;
    }
    if (data.website_url !== undefined) updateData.website_url = data.website_url;
    if (data.icon_url !== undefined) updateData.icon_url = data.icon_url;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.runtime !== undefined) updateData.runtime = data.runtime;
    if (data.packages !== undefined) updateData.packages = JSON.stringify(data.packages);
    if (data.remotes !== undefined) updateData.remotes = data.remotes ? JSON.stringify(data.remotes) : null;
    if (data.resources !== undefined) updateData.resources = data.resources ? JSON.stringify(data.resources) : null;
    if (data.prompts !== undefined) updateData.prompts = data.prompts ? JSON.stringify(data.prompts) : null;
    if (data.author_name !== undefined) updateData.author_name = data.author_name;
    if (data.author_contact !== undefined) updateData.author_contact = data.author_contact;
    if (data.organization !== undefined) updateData.organization = data.organization;
    if (data.license !== undefined) updateData.license = data.license;
    if (data.transport_type !== undefined) updateData.transport_type = data.transport_type;
    if (data.github_account_id !== undefined) updateData.github_account_id = data.github_account_id;
    if (data.github_readme_base64 !== undefined) updateData.github_readme_base64 = data.github_readme_base64;
    if (data.github_stars !== undefined) updateData.github_stars = data.github_stars;
    // Three-tier configuration schema
    if (data.template_args !== undefined) updateData.template_args = data.template_args ? JSON.stringify(data.template_args) : null;
    if (data.template_env !== undefined) updateData.template_env = data.template_env ? JSON.stringify(data.template_env) : null;
    if (data.template_headers !== undefined) updateData.template_headers = data.template_headers ? JSON.stringify(data.template_headers) : null;
    if (data.template_url_query_params !== undefined) updateData.template_url_query_params = data.template_url_query_params ? JSON.stringify(data.template_url_query_params) : null;
    if (data.team_args_schema !== undefined) updateData.team_args_schema = data.team_args_schema ? JSON.stringify(data.team_args_schema) : null;
    if (data.team_env_schema !== undefined) updateData.team_env_schema = data.team_env_schema ? JSON.stringify(data.team_env_schema) : null;
    if (data.team_headers_schema !== undefined) updateData.team_headers_schema = data.team_headers_schema ? JSON.stringify(data.team_headers_schema) : null;
    if (data.team_url_query_params_schema !== undefined) updateData.team_url_query_params_schema = data.team_url_query_params_schema ? JSON.stringify(data.team_url_query_params_schema) : null;
    if (data.user_args_schema !== undefined) updateData.user_args_schema = data.user_args_schema ? JSON.stringify(data.user_args_schema) : null;
    if (data.user_env_schema !== undefined) updateData.user_env_schema = data.user_env_schema ? JSON.stringify(data.user_env_schema) : null;
    if (data.user_headers_schema !== undefined) updateData.user_headers_schema = data.user_headers_schema ? JSON.stringify(data.user_headers_schema) : null;
    if (data.user_url_query_params_schema !== undefined) updateData.user_url_query_params_schema = data.user_url_query_params_schema ? JSON.stringify(data.user_url_query_params_schema) : null;
    if (data.dependencies !== undefined) updateData.dependencies = data.dependencies ? JSON.stringify(data.dependencies) : null;
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.tags !== undefined) updateData.tags = data.tags ? JSON.stringify(data.tags) : null;
    if (data.status !== undefined) updateData.status = data.status;
    
    // Only global_admin can set featured flag
    if (data.featured !== undefined && userRole === 'global_admin') {
      updateData.featured = data.featured;
    }
    
    // Only global_admin can set auto_install_new_default_team flag
    if (data.auto_install_new_default_team !== undefined && userRole === 'global_admin') {
      updateData.auto_install_new_default_team = data.auto_install_new_default_team;
    }

    if (data.requires_oauth !== undefined) updateData.requires_oauth = data.requires_oauth;
    if (data.skip_oauth_flow !== undefined) updateData.skip_oauth_flow = data.skip_oauth_flow;

    await this.db.update(this.mcpServers).set(updateData).where(eq(this.mcpServers.id, serverId));
    
    this.logger.info({
      operation: 'update_mcp_server',
      serverId,
      updatedFields: Object.keys(updateData)
    }, 'Successfully updated MCP server');
    
    return await this.getServerById(serverId);
  }
  
  async deleteServer(serverId: string, userId: string, userRole: string): Promise<boolean> {
    this.logger.debug({
      operation: 'delete_mcp_server',
      serverId,
      userId,
      userRole
    }, 'Deleting MCP server');
    
    const server = await this.getServerById(serverId);
    if (!server) {
      return false;
    }
    
    // Check permissions
    if (!this.canUserManageServer(server, userId, userRole)) {
      throw new Error('Insufficient permissions to delete this server');
    }
    
    await this.db.delete(this.mcpServers).where(eq(this.mcpServers.id, serverId));
    
    this.logger.info({
      operation: 'delete_mcp_server',
      serverId
    }, 'Successfully deleted MCP server');
    
    return true;
  }
  
  private parseServerJsonFields(server: any): any {
    // Parse JSON string fields back to objects/arrays with proper error handling
    const parsed = { ...server };
    
    const parseJsonField = (fieldName: string, fieldValue: any, defaultValue: any) => {
      if (!fieldValue || fieldValue === '' || fieldValue.trim() === '') {
        return defaultValue;
      }
      if (typeof fieldValue !== 'string') {
        return fieldValue; // Already parsed or not a string
      }
      try {
        return JSON.parse(fieldValue);
      } catch (e) {
        this.logger.warn({ 
          field: fieldName, 
          fieldValue, 
          error: e,
          serverId: server.id 
        }, 'Failed to parse JSON field, using default value');
        return defaultValue;
      }
    };
    
    // Parse JSON fields that should be arrays/objects
    parsed.packages = parseJsonField('packages', parsed.packages, []);
    parsed.remotes = parseJsonField('remotes', parsed.remotes, null);
    parsed.resources = parseJsonField('resources', parsed.resources, null);
    parsed.prompts = parseJsonField('prompts', parsed.prompts, null);
    // Three-tier configuration schema
    parsed.template_args = parseJsonField('template_args', parsed.template_args, null);
    parsed.template_env = parseJsonField('template_env', parsed.template_env, null);
    parsed.template_headers = parseJsonField('template_headers', parsed.template_headers, null);
    parsed.template_url_query_params = parseJsonField('template_url_query_params', parsed.template_url_query_params, null);
    parsed.team_args_schema = parseJsonField('team_args_schema', parsed.team_args_schema, null);
    parsed.team_env_schema = parseJsonField('team_env_schema', parsed.team_env_schema, null);
    parsed.team_headers_schema = parseJsonField('team_headers_schema', parsed.team_headers_schema, null);
    parsed.team_url_query_params_schema = parseJsonField('team_url_query_params_schema', parsed.team_url_query_params_schema, null);
    parsed.user_args_schema = parseJsonField('user_args_schema', parsed.user_args_schema, null);
    parsed.user_env_schema = parseJsonField('user_env_schema', parsed.user_env_schema, null);
    parsed.user_headers_schema = parseJsonField('user_headers_schema', parsed.user_headers_schema, null);
    parsed.user_url_query_params_schema = parseJsonField('user_url_query_params_schema', parsed.user_url_query_params_schema, null);
    // transport_type is a simple string field, no parsing needed
    parsed.dependencies = parseJsonField('dependencies', parsed.dependencies, null);
    parsed.tags = parseJsonField('tags', parsed.tags, null);
    
    return parsed;
  }
  
  private canUserManageServer(server: McpServer, userId: string, userRole: string): boolean {
    // Global admin can manage any server
    if (userRole === 'global_admin') {
      return true;
    }
    
    // For team servers, check if user created it (simplified - in real app would check team membership)
    if (server.visibility === 'team') {
      return server.created_by === userId;
    }
    
    return false;
  }
  
  async searchServers(
    query: string, 
    userId: string, 
    userRole: string, 
    teamIds: string[]
  ): Promise<McpServer[]> {
    return await this.getServersForUser(userId, userRole, teamIds, { search: query });
  }
  
  async getTagsForUser(
    userId: string,
    userRole: string,
    teamIds: string[]
  ): Promise<string[]> {
    this.logger.debug({
      operation: 'get_tags_for_user',
      userId,
      userRole,
      teamIds: teamIds.length
    }, 'Getting unique tags for user');
    
    const whereConditions: any[] = [];
    
    // Apply visibility filters based on user role
    if (userRole === 'global_admin') {
      // Global admin sees ALL tags from all servers
      this.logger.debug('Global admin - including tags from all servers');
    } else {
      // Regular users see tags from global servers + their team servers
      whereConditions.push(
        or(
          eq(this.mcpServers.visibility, 'global'),
          and(
            eq(this.mcpServers.visibility, 'team'),
            teamIds.length > 0 ? or(...teamIds.map(teamId => eq(this.mcpServers.owner_team_id, teamId))) : eq(this.mcpServers.id, 'never-match')
          )
        )
      );
    }
    
    // Use DISTINCT to get only unique tag combinations at database level
    // This is much more efficient when many servers share the same tags
    const queryBuilder = this.db.selectDistinct({ tags: this.mcpServers.tags }).from(this.mcpServers);

    const results = await (whereConditions.length > 0
      ? queryBuilder.where(and(...whereConditions))
      : queryBuilder);
    
    this.logger.debug({
      operation: 'get_tags_for_user',
      uniqueTagCombinations: results.length
    }, 'Retrieved unique tag combinations from database');
    
    // Collect all unique tags from the distinct JSON combinations
    const uniqueTags = new Set<string>();
    
    for (const row of results) {
      if (row.tags) {
        try {
          const parsedTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
          if (Array.isArray(parsedTags)) {
            parsedTags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                uniqueTags.add(tag.trim());
              }
            });
          }
        } catch (e) {
          this.logger.warn({ tags: row.tags, error: e }, 'Failed to parse tags JSON');
        }
      }
    }
    
    // Convert Set to sorted array
    const sortedTags = Array.from(uniqueTags).sort();
    
    this.logger.info({
      operation: 'get_tags_for_user',
      userId,
      userRole,
      uniqueTagCombinations: results.length,
      uniqueIndividualTags: sortedTags.length
    }, 'Unique tags retrieved successfully');
    
    return sortedTags;
  }
}
