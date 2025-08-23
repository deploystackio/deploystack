/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, desc } from 'drizzle-orm';
import { mcpServerInstallations, mcpServers } from '../db/schema.sqlite';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { nanoid } from 'nanoid';
import { encrypt, decrypt } from '../utils/encryption';

// Types
export interface McpInstallation {
  id: string;
  team_id: string;
  server_id: string;
  created_by: string;
  installation_name: string;
  installation_type: 'local' | 'cloud';
  team_args?: string[] | null; // Team-level shared arguments
  team_env?: Record<string, string> | null; // Team-level shared environment variables (decrypted for response)
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
    homepage_url: string | null; // Optional in DB
    github_url: string | null; // Optional in DB
    tags: string[] | null; // Optional in DB
    installation_methods: any[];
    // Three-tier schema fields
    template_args: any[] | null;
    template_env: Record<string, string> | null;
    team_args_schema: any[] | null;
    team_env_schema: any[] | null;
    user_args_schema: any[] | null;
    user_env_schema: any[] | null;
    transport_type: 'stdio' | 'http' | 'sse';
  };
}

export interface CreateMcpInstallationRequest {
  server_id: string;
  installation_name: string;
  installation_type?: 'local' | 'cloud';
  team_args?: string[];
  team_env?: Record<string, string>;
}

export interface UpdateMcpInstallationRequest {
  installation_name?: string;
  team_args?: string[];
  team_env?: Record<string, string>;
}

export interface ClientConfig {
  claude_desktop: any;
  vscode: any;
  cursor: any;
}

export class McpInstallationService {
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {}

  async getTeamInstallations(teamId: string, userId: string): Promise<McpInstallation[]> {
    this.logger.debug({
      operation: 'get_team_installations',
      teamId,
      userId
    }, 'Getting MCP installations for team');

    const installations = await this.db
      .select({
        installation: mcpServerInstallations,
        server: mcpServers
      })
      .from(mcpServerInstallations)
      .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
      .where(eq(mcpServerInstallations.team_id, teamId))
      .orderBy(desc(mcpServerInstallations.created_at));

    this.logger.info({
      operation: 'get_team_installations',
      teamId,
      installationsFound: installations.length
    }, 'Retrieved MCP installations for team');

    return installations.map((row: any) => ({
      ...row.installation,
      team_args: row.installation.team_args 
        ? this.parseJsonField(row.installation.team_args, [])
        : null,
      team_env: row.installation.team_env 
        ? this.decryptEnvironmentVariables(row.installation.team_env)
        : null,
      server: row.server ? {
        id: row.server.id,
        name: row.server.name,
        description: row.server.description,
        language: row.server.language,
        runtime: row.server.runtime,
        status: row.server.status,
        author_name: row.server.author_name,
        homepage_url: row.server.homepage_url,
        github_url: row.server.github_url,
        tags: this.parseJsonField(row.server.tags, []),
        installation_methods: this.parseJsonField(row.server.installation_methods, []),
        template_args: this.parseJsonField(row.server.template_args, []),
        template_env: this.parseJsonField(row.server.template_env, {}),
        team_args_schema: this.parseJsonField(row.server.team_args_schema, []),
        team_env_schema: this.parseJsonField(row.server.team_env_schema, []),
        user_args_schema: this.parseJsonField(row.server.user_args_schema, []),
        user_env_schema: this.parseJsonField(row.server.user_env_schema, []),
        transport_type: row.server.transport_type
      } : undefined
    }));
  }

  async getInstallationById(installationId: string, teamId: string): Promise<McpInstallation | null> {
    this.logger.debug({
      operation: 'get_installation_by_id',
      installationId,
      teamId
    }, 'Getting MCP installation by ID');

    const result = await this.db
      .select({
        installation: mcpServerInstallations,
        server: mcpServers
      })
      .from(mcpServerInstallations)
      .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
      .where(
        and(
          eq(mcpServerInstallations.id, installationId),
          eq(mcpServerInstallations.team_id, teamId)
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

    return {
      ...installation,
      team_args: installation.team_args 
        ? this.parseJsonField(installation.team_args, [])
        : null,
      team_env: installation.team_env 
        ? this.decryptEnvironmentVariables(installation.team_env)
        : null,
      server: server ? {
        id: server.id,
        name: server.name,
        description: server.description,
        language: server.language,
        runtime: server.runtime,
        status: server.status,
        author_name: server.author_name,
        homepage_url: server.homepage_url,
        github_url: server.github_url,
        tags: this.parseJsonField(server.tags, []),
        installation_methods: this.parseJsonField(server.installation_methods, []),
        template_args: this.parseJsonField(server.template_args, []),
        template_env: this.parseJsonField(server.template_env, {}),
        team_args_schema: this.parseJsonField(server.team_args_schema, []),
        team_env_schema: this.parseJsonField(server.team_env_schema, []),
        user_args_schema: this.parseJsonField(server.user_args_schema, []),
        user_env_schema: this.parseJsonField(server.user_env_schema, []),
        transport_type: server.transport_type
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
      .from(mcpServerInstallations)
      .where(
        and(
          eq(mcpServerInstallations.team_id, teamId),
          eq(mcpServerInstallations.installation_name, data.installation_name)
        )
      )
      .limit(1);

    if (existingInstallation.length > 0) {
      throw new Error('An installation with this name already exists in the team');
    }

    // Verify server exists
    const server = await this.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, data.server_id))
      .limit(1);

    if (server.length === 0) {
      throw new Error('Server not found');
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
      installation_type: data.installation_type || 'local',
      team_args: data.team_args 
        ? JSON.stringify(data.team_args)
        : null,
      team_env: data.team_env 
        ? this.encryptEnvironmentVariables(data.team_env)
        : null,
      created_at: now,
      updated_at: now,
      last_used_at: null
    };

    await this.db.insert(mcpServerInstallations).values(installationData);

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
        .from(mcpServerInstallations)
        .where(
          and(
            eq(mcpServerInstallations.team_id, teamId),
            eq(mcpServerInstallations.installation_name, data.installation_name),
            eq(mcpServerInstallations.id, installationId) // Exclude current installation
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
        ? this.encryptEnvironmentVariables(data.team_env)
        : null;
    }

    if (data.team_args !== undefined) {
      updateData.team_args = data.team_args
        ? JSON.stringify(data.team_args)
        : null;
    }

    await this.db
      .update(mcpServerInstallations)
      .set(updateData)
      .where(eq(mcpServerInstallations.id, installationId));

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
      .delete(mcpServerInstallations)
      .where(
        and(
          eq(mcpServerInstallations.id, installationId),
          eq(mcpServerInstallations.team_id, teamId)
        )
      );

    const deleted = result.changes > 0;

    this.logger.info({
      operation: 'delete_installation',
      installationId,
      deleted
    }, 'MCP installation deletion completed');

    return deleted;
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

    const installation = await this.getInstallationById(installationId, teamId);
    if (!installation || !installation.server) {
      throw new Error('Installation not found');
    }

    // Update last_used_at
    await this.db
      .update(mcpServerInstallations)
      .set({ last_used_at: new Date() })
      .where(eq(mcpServerInstallations.id, installationId));

    // Get Claude Desktop config from server's installation_methods
    const claudeDesktopMethod = installation.server.installation_methods.find(
      (method: any) => method.client === 'claude-desktop'
    );

    if (!claudeDesktopMethod) {
      throw new Error('Server does not support Claude Desktop installation');
    }

    // Merge template with team environment variables
    const mergedEnv = { ...claudeDesktopMethod.env };
    if (installation.team_env) {
      Object.assign(mergedEnv, installation.team_env);
    }

    const baseConfig = {
      command: claudeDesktopMethod.command,
      args: claudeDesktopMethod.args,
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
        return this.generateVSCodeConfig(installation, baseConfig);

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

  private encryptEnvironmentVariables(vars: Record<string, string>): string {
    return encrypt(JSON.stringify(vars));
  }

  private decryptEnvironmentVariables(encryptedVars: string): Record<string, string> {
    try {
      const decrypted = decrypt(encryptedVars);
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error({
        operation: 'decrypt_environment_variables',
        error
      }, 'Failed to decrypt environment variables');
      return {};
    }
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
