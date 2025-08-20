/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, or, like, desc, asc } from 'drizzle-orm';
import { mcpServers } from '../db/schema.sqlite';
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
  github_url?: string;
  git_branch?: string;
  homepage_url?: string;
  language: string;
  runtime: string;
  runtime_min_version?: string;
  installation_methods: string; // JSON
  tools: string; // JSON
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
  // Three-tier configuration schema
  template_args?: string; // JSON: Fixed args that never change
  template_env?: string; // JSON: Fixed env vars that never change
  team_args_schema?: string; // JSON: Schema for team-level args
  team_env_schema?: string; // JSON: Schema for team-level env vars
  user_args_schema?: string; // JSON: Schema for user-level args
  user_env_schema?: string; // JSON: Schema for user-level env vars
  dependencies?: string; // JSON
  category_id?: string;
  tags?: string; // JSON
  status: 'active' | 'deprecated' | 'maintenance';
  featured: boolean;
  auto_install_new_default_team: boolean;
  created_at: Date;
  updated_at: Date;
  last_sync_at?: Date;
}

export interface CreateMcpServerRequest {
  name: string;
  description: string;
  long_description?: string;
  github_url?: string;
  git_branch?: string;
  homepage_url?: string;
  language: string;
  runtime: string;
  runtime_min_version?: string;
  installation_methods: any[]; // Will be JSON stringified - auto-extracted from Claude Desktop config
  tools: any[]; // Will be JSON stringified
  resources?: any[]; // Will be JSON stringified
  prompts?: any[]; // Will be JSON stringified
  visibility: 'global' | 'team';
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  transport_type?: 'stdio' | 'http' | 'sse'; // MCP transport type
  // Three-tier configuration schema
  template_args?: any[]; // Fixed args that never change (e.g., ["-y", "@modelcontextprotocol/server-filesystem"])
  template_env?: any; // Fixed env vars that never change (e.g., {"FIXED_VAR": "fixed_value"})
  team_args_schema?: any[]; // Schema for team-level args (e.g., [{name: "api_key", type: "string", required: true}])
  team_env_schema?: any[]; // Schema for team-level env vars
  user_args_schema?: any[]; // Schema for user-level args (e.g., [{name: "local_path", type: "string", required: true}])
  user_env_schema?: any[]; // Schema for user-level env vars
  dependencies?: any; // Will be JSON stringified
  category_id?: string;
  tags?: string[];
  featured?: boolean;
  auto_install_new_default_team?: boolean;
}

export interface UpdateMcpServerRequest {
  name?: string;
  description?: string;
  long_description?: string;
  github_url?: string;
  git_branch?: string;
  homepage_url?: string;
  language?: string;
  runtime?: string;
  runtime_min_version?: string;
  installation_methods?: any[];
  tools?: any[];
  resources?: any[];
  prompts?: any[];
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  transport_type?: 'stdio' | 'http' | 'sse';
  // Three-tier configuration schema
  template_args?: any[];
  template_env?: any;
  team_args_schema?: any[];
  team_env_schema?: any[];
  user_args_schema?: any[];
  user_env_schema?: any[];
  dependencies?: any;
  category_id?: string;
  tags?: string[];
  status?: 'active' | 'deprecated' | 'maintenance';
  featured?: boolean;
  auto_install_new_default_team?: boolean;
}

export interface McpServerFilters {
  visibility?: 'global' | 'team';
  category_id?: string;
  language?: string;
  runtime?: string;
  status?: 'active' | 'deprecated' | 'maintenance';
  featured?: boolean;
  search?: string;
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
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {}
  
  // Get servers visible to a user based on their role and team memberships
  async getServersForUser(
    userId: string, 
    userRole: string, 
    teamIds: string[],
    filters?: McpServerFilters
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
          eq(mcpServers.visibility, 'global'),
          and(
            eq(mcpServers.visibility, 'team'),
            teamIds.length > 0 ? or(...teamIds.map(teamId => eq(mcpServers.owner_team_id, teamId))) : eq(mcpServers.id, 'never-match')
          )
        )
      );
    }
    
    // Apply additional filters
    if (filters) {
      if (filters.category_id) {
        whereConditions.push(eq(mcpServers.category_id, filters.category_id));
      }
      if (filters.language) {
        whereConditions.push(eq(mcpServers.language, filters.language));
      }
      if (filters.runtime) {
        whereConditions.push(eq(mcpServers.runtime, filters.runtime));
      }
      if (filters.status) {
        whereConditions.push(eq(mcpServers.status, filters.status));
      }
      if (filters.featured !== undefined) {
        whereConditions.push(eq(mcpServers.featured, filters.featured));
      }
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        whereConditions.push(
          or(
            like(mcpServers.name, searchTerm),
            like(mcpServers.description, searchTerm),
            like(mcpServers.tags, searchTerm)
          )
        );
      }
    }
    
    // Build the query with all conditions combined
    let query = this.db.select().from(mcpServers);
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    // Order by featured first, then by name
    query = query.orderBy(desc(mcpServers.featured), asc(mcpServers.name));
    
    const servers = await query;
    
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
    
    const servers = await this.db.select().from(mcpServers).where(eq(mcpServers.id, serverId)).limit(1);
    
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
    
    // Sync from GitHub if URL provided
    let githubInfo: any = {};
    if (data.github_url) {
      try {
        const repoInfo = await GitHubService.getRepositoryInfo(data.github_url, this.logger);
        githubInfo = {
          description: data.description || repoInfo.description,
          long_description: data.long_description || repoInfo.description,
          language: data.language || repoInfo.language,
          homepage_url: data.homepage_url || repoInfo.homepage,
          license: data.license || repoInfo.license,
          tags: data.tags || repoInfo.topics
        };
        
        this.logger.info({
          operation: 'create_mcp_server',
          githubUrl: data.github_url,
          syncedFields: Object.keys(githubInfo)
        }, 'Synced server info from GitHub');
      } catch (error) {
        this.logger.warn({
          operation: 'create_mcp_server',
          githubUrl: data.github_url,
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
      description: githubInfo.description || data.description,
      long_description: githubInfo.long_description || data.long_description,
      github_url: data.github_url,
      git_branch: data.git_branch || 'main',
      homepage_url: githubInfo.homepage_url || data.homepage_url,
      language: githubInfo.language || data.language,
      runtime: data.runtime,
      runtime_min_version: data.runtime_min_version,
      installation_methods: JSON.stringify(data.installation_methods),
      tools: JSON.stringify(data.tools),
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
      // Three-tier configuration schema
      template_args: data.template_args ? JSON.stringify(data.template_args) : null,
      template_env: data.template_env ? JSON.stringify(data.template_env) : null,
      team_args_schema: data.team_args_schema ? JSON.stringify(data.team_args_schema) : null,
      team_env_schema: data.team_env_schema ? JSON.stringify(data.team_env_schema) : null,
      user_args_schema: data.user_args_schema ? JSON.stringify(data.user_args_schema) : null,
      user_env_schema: data.user_env_schema ? JSON.stringify(data.user_env_schema) : null,
      dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
      category_id: data.category_id,
      tags: githubInfo.tags ? JSON.stringify(githubInfo.tags) : (data.tags ? JSON.stringify(data.tags) : null),
      status: 'active',
      featured: userRole === 'global_admin' ? (data.featured || false) : false,
      auto_install_new_default_team: userRole === 'global_admin' ? (data.auto_install_new_default_team || false) : false,
      created_at: now,
      updated_at: now,
      last_sync_at: data.github_url ? now : null
    };
    
    await this.db.insert(mcpServers).values(serverData);
    
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
    if (data.description !== undefined) updateData.description = data.description;
    if (data.long_description !== undefined) updateData.long_description = data.long_description;
    if (data.github_url !== undefined) updateData.github_url = data.github_url;
    if (data.git_branch !== undefined) updateData.git_branch = data.git_branch;
    if (data.homepage_url !== undefined) updateData.homepage_url = data.homepage_url;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.runtime !== undefined) updateData.runtime = data.runtime;
    if (data.runtime_min_version !== undefined) updateData.runtime_min_version = data.runtime_min_version;
    if (data.installation_methods !== undefined) updateData.installation_methods = JSON.stringify(data.installation_methods);
    if (data.tools !== undefined) updateData.tools = JSON.stringify(data.tools);
    if (data.resources !== undefined) updateData.resources = data.resources ? JSON.stringify(data.resources) : null;
    if (data.prompts !== undefined) updateData.prompts = data.prompts ? JSON.stringify(data.prompts) : null;
    if (data.author_name !== undefined) updateData.author_name = data.author_name;
    if (data.author_contact !== undefined) updateData.author_contact = data.author_contact;
    if (data.organization !== undefined) updateData.organization = data.organization;
    if (data.license !== undefined) updateData.license = data.license;
    if (data.transport_type !== undefined) updateData.transport_type = data.transport_type;
    // Three-tier configuration schema
    if (data.template_args !== undefined) updateData.template_args = data.template_args ? JSON.stringify(data.template_args) : null;
    if (data.template_env !== undefined) updateData.template_env = data.template_env ? JSON.stringify(data.template_env) : null;
    if (data.team_args_schema !== undefined) updateData.team_args_schema = data.team_args_schema ? JSON.stringify(data.team_args_schema) : null;
    if (data.team_env_schema !== undefined) updateData.team_env_schema = data.team_env_schema ? JSON.stringify(data.team_env_schema) : null;
    if (data.user_args_schema !== undefined) updateData.user_args_schema = data.user_args_schema ? JSON.stringify(data.user_args_schema) : null;
    if (data.user_env_schema !== undefined) updateData.user_env_schema = data.user_env_schema ? JSON.stringify(data.user_env_schema) : null;
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
    
    await this.db.update(mcpServers).set(updateData).where(eq(mcpServers.id, serverId));
    
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
    
    await this.db.delete(mcpServers).where(eq(mcpServers.id, serverId));
    
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
    parsed.installation_methods = parseJsonField('installation_methods', parsed.installation_methods, []);
    parsed.tools = parseJsonField('tools', parsed.tools, []);
    parsed.resources = parseJsonField('resources', parsed.resources, null);
    parsed.prompts = parseJsonField('prompts', parsed.prompts, null);
    // Three-tier configuration schema
    parsed.template_args = parseJsonField('template_args', parsed.template_args, null);
    parsed.template_env = parseJsonField('template_env', parsed.template_env, null);
    parsed.team_args_schema = parseJsonField('team_args_schema', parsed.team_args_schema, null);
    parsed.team_env_schema = parseJsonField('team_env_schema', parsed.team_env_schema, null);
    parsed.user_args_schema = parseJsonField('user_args_schema', parsed.user_args_schema, null);
    parsed.user_env_schema = parseJsonField('user_env_schema', parsed.user_env_schema, null);
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
}
