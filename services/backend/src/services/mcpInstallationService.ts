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
  user_id: string;
  installation_name: string;
  installation_type: 'local' | 'cloud';
  user_environment_variables?: Record<string, string>; // Decrypted for response
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
  // Joined server information
  server?: {
    id: string;
    name: string;
    description: string;
    github_url: string | null;
    runtime: string;
    installation_methods: any[];
    environment_variables: any[];
    default_config: any;
  };
}

export interface CreateMcpInstallationRequest {
  server_id: string;
  installation_name: string;
  installation_type?: 'local' | 'cloud';
  user_environment_variables?: Record<string, string>;
}

export interface UpdateMcpInstallationRequest {
  installation_name?: string;
  user_environment_variables?: Record<string, string>;
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
      user_environment_variables: row.installation.user_environment_variables 
        ? this.decryptEnvironmentVariables(row.installation.user_environment_variables)
        : undefined,
      server: row.server ? {
        id: row.server.id,
        name: row.server.name,
        description: row.server.description,
        github_url: row.server.github_url,
        homepage_url: row.server.homepage_url,
        author_name: row.server.author_name,
        language: row.server.language,
        runtime: row.server.runtime,
        status: row.server.status,
        tags: this.parseJsonField(row.server.tags, []),
        environment_variables: this.parseJsonField(row.server.environment_variables, []),
        installation_methods: this.parseJsonField(row.server.installation_methods, []),
        category_id: row.server.category_id
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
      user_environment_variables: installation.user_environment_variables 
        ? this.decryptEnvironmentVariables(installation.user_environment_variables)
        : undefined,
      server: server ? {
        id: server.id,
        name: server.name,
        description: server.description,
        github_url: server.github_url,
        homepage_url: server.homepage_url,
        author_name: server.author_name,
        language: server.language,
        runtime: server.runtime,
        status: server.status,
        tags: this.parseJsonField(server.tags, []),
        environment_variables: this.parseJsonField(server.environment_variables, []),
        category_id: server.category_id
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

    // Validate environment variables against server schema
    if (data.user_environment_variables) {
      this.validateEnvironmentVariables(
        data.user_environment_variables,
        this.parseJsonField(server[0].environment_variables, [])
      );
    }

    const installationId = nanoid();
    const now = new Date();

    const installationData = {
      id: installationId,
      team_id: teamId,
      server_id: data.server_id,
      user_id: userId,
      installation_name: data.installation_name,
      installation_type: data.installation_type || 'local',
      user_environment_variables: data.user_environment_variables 
        ? this.encryptEnvironmentVariables(data.user_environment_variables)
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

    if (data.user_environment_variables !== undefined) {
      // Validate against server schema
      if (existing.server?.environment_variables) {
        this.validateEnvironmentVariables(
          data.user_environment_variables,
          existing.server.environment_variables
        );
      }

      updateData.user_environment_variables = data.user_environment_variables
        ? this.encryptEnvironmentVariables(data.user_environment_variables)
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

    // Merge template with user environment variables
    const mergedEnv = { ...claudeDesktopMethod.env };
    if (installation.user_environment_variables) {
      Object.assign(mergedEnv, installation.user_environment_variables);
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
