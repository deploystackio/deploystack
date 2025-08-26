/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, desc, ne } from 'drizzle-orm';
import { mcpUserConfigurations, mcpServerInstallations, mcpServers } from '../db/schema.sqlite';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { nanoid } from 'nanoid';
import { McpArgsStorage } from '../utils/mcpArgsStorage';
import { McpEnvStorage } from '../utils/mcpEnvStorage';

// Types
export interface McpUserConfiguration {
  id: string;
  installation_id: string;
  user_id: string;
  device_id?: string;
  user_args?: Record<string, string>;
  user_env?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
  // Joined installation and server information
  installation?: {
    id: string;
    installation_name: string;
    team_id: string;
    server_id: string;
    server?: {
      id: string;
      name: string;
      description: string;
      user_args_schema?: any[];
      user_env_schema?: any[];
    };
  };
}

export interface CreateUserConfigRequest {
  device_id?: string;
  user_args?: Record<string, string>;
  user_env?: Record<string, string>;
}

export interface UpdateUserConfigRequest {
  device_id?: string;
  user_args?: Record<string, string>;
  user_env?: Record<string, string>;
}

export class McpUserConfigurationService {
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {}

  async getUserConfigurations(
    installationId: string,
    userId: string,
    teamId: string
  ): Promise<McpUserConfiguration[]> {
    this.logger.debug({
      operation: 'get_user_configurations',
      installationId,
      userId,
      teamId
    }, 'Getting user configurations for installation');

    // First verify user has access to this installation
    const installation = await this.db
      .select()
      .from(mcpServerInstallations)
      .where(
        and(
          eq(mcpServerInstallations.id, installationId),
          eq(mcpServerInstallations.team_id, teamId)
        )
      )
      .limit(1);

    if (installation.length === 0) {
      throw new Error('Installation not found or access denied');
    }

    const configurations = await this.db
      .select({
        config: mcpUserConfigurations,
        installation: mcpServerInstallations,
        server: mcpServers
      })
      .from(mcpUserConfigurations)
      .leftJoin(mcpServerInstallations, eq(mcpUserConfigurations.installation_id, mcpServerInstallations.id))
      .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
      .where(
        and(
          eq(mcpUserConfigurations.installation_id, installationId),
          eq(mcpUserConfigurations.user_id, userId)
        )
      )
      .orderBy(desc(mcpUserConfigurations.created_at));

    this.logger.info({
      operation: 'get_user_configurations',
      installationId,
      userId,
      configurationsFound: configurations.length
    }, 'Retrieved user configurations');

    const processedConfigurations = [];
    
    for (const row of configurations) {
      const userArgsSchema = this.parseJsonField(row.server?.user_args_schema, []);
      const userEnvSchema = this.parseJsonField(row.server?.user_env_schema, []);

      const userArgs = row.config.user_args 
        ? await McpArgsStorage.retrieveUserArgs(
            row.config.user_args,
            userArgsSchema,
            { maskSecrets: true },
            this.logger
          )
        : undefined;

      const userEnv = row.config.user_env 
        ? await McpEnvStorage.retrieveUserEnv(
            row.config.user_env,
            userEnvSchema,
            { maskSecrets: true },
            this.logger
          )
        : undefined;

      processedConfigurations.push({
        ...row.config,
        user_args: userArgs,
        user_env: userEnv,
        installation: row.installation ? {
          id: row.installation.id,
          installation_name: row.installation.installation_name,
          team_id: row.installation.team_id,
          server_id: row.installation.server_id,
          server: row.server ? {
            id: row.server.id,
            name: row.server.name,
            description: row.server.description,
            user_args_schema: userArgsSchema,
            user_env_schema: userEnvSchema
          } : undefined
        } : undefined
      });
    }

    return processedConfigurations;
  }

  async getUserConfigurationById(
    configId: string,
    userId: string,
    teamId: string
  ): Promise<McpUserConfiguration | null> {
    this.logger.debug({
      operation: 'get_user_configuration_by_id',
      configId,
      userId,
      teamId
    }, 'Getting user configuration by ID');

    const result = await this.db
      .select({
        config: mcpUserConfigurations,
        installation: mcpServerInstallations,
        server: mcpServers
      })
      .from(mcpUserConfigurations)
      .leftJoin(mcpServerInstallations, eq(mcpUserConfigurations.installation_id, mcpServerInstallations.id))
      .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
      .where(
        and(
          eq(mcpUserConfigurations.id, configId),
          eq(mcpUserConfigurations.user_id, userId),
          eq(mcpServerInstallations.team_id, teamId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      this.logger.debug({
        operation: 'get_user_configuration_by_id',
        configId,
        userId,
        teamId
      }, 'User configuration not found');
      return null;
    }

    const { config, installation, server } = result[0];

    const userArgsSchema = this.parseJsonField(server?.user_args_schema, []);
    const userEnvSchema = this.parseJsonField(server?.user_env_schema, []);

    const userArgs = config.user_args 
      ? await McpArgsStorage.retrieveUserArgs(
          config.user_args,
          userArgsSchema,
          { maskSecrets: true },
          this.logger
        )
      : undefined;

    const userEnv = config.user_env 
      ? await McpEnvStorage.retrieveUserEnv(
          config.user_env,
          userEnvSchema,
          { maskSecrets: true },
          this.logger
        )
      : undefined;

    return {
      ...config,
      user_args: userArgs,
      user_env: userEnv,
      installation: installation ? {
        id: installation.id,
        installation_name: installation.installation_name,
        team_id: installation.team_id,
        server_id: installation.server_id,
        server: server ? {
          id: server.id,
          name: server.name,
          description: server.description,
          user_args_schema: userArgsSchema,
          user_env_schema: userEnvSchema
        } : undefined
      } : undefined
    };
  }

  async createUserConfiguration(
    installationId: string,
    userId: string,
    teamId: string,
    data: CreateUserConfigRequest
  ): Promise<McpUserConfiguration> {
    this.logger.debug({
      operation: 'create_user_configuration',
      installationId,
      userId,
      teamId,
      deviceId: data.device_id
    }, 'Creating user configuration');

    // Verify installation exists and user has access
    const installation = await this.db
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

    if (installation.length === 0) {
      throw new Error('Installation not found or access denied');
    }

    // Check for existing configuration with same device ID (if provided)
    if (data.device_id) {
      const existingConfig = await this.db
        .select()
        .from(mcpUserConfigurations)
        .where(
          and(
            eq(mcpUserConfigurations.installation_id, installationId),
            eq(mcpUserConfigurations.user_id, userId),
            eq(mcpUserConfigurations.device_id, data.device_id)
          )
        )
        .limit(1);

      if (existingConfig.length > 0) {
        throw new Error('A configuration with this device ID already exists for this installation');
      }
    }

    // Validate user args and env against server schema
    const serverInfo = installation[0].server;
    if (serverInfo) {
      if (data.user_args) {
        this.validateUserArgs(data.user_args, this.parseJsonField(serverInfo.user_args_schema, []));
      }
      if (data.user_env) {
        this.validateUserEnv(data.user_env, this.parseJsonField(serverInfo.user_env_schema, []));
      }
    }

    const configId = nanoid();
    const now = new Date();

    const configData = {
      id: configId,
      installation_id: installationId,
      user_id: userId,
      device_id: data.device_id || null,
      user_args: data.user_args ? await McpArgsStorage.storeUserArgs(
        data.user_args, 
        this.parseJsonField(serverInfo?.user_args_schema, []), 
        this.logger
      ) : null,
      user_env: data.user_env ? await McpEnvStorage.storeUserEnv(
        data.user_env, 
        this.parseJsonField(serverInfo?.user_env_schema, []), 
        this.logger
      ) : null,
      created_at: now,
      updated_at: now,
      last_used_at: null
    };

    await this.db.insert(mcpUserConfigurations).values(configData);

    this.logger.info({
      operation: 'create_user_configuration',
      configId,
      installationId,
      userId
    }, 'Successfully created user configuration');

    // Return the created configuration
    const created = await this.getUserConfigurationById(configId, userId, teamId);
    if (!created) {
      throw new Error('Failed to retrieve created configuration');
    }

    return created;
  }

  async updateUserConfiguration(
    configId: string,
    userId: string,
    teamId: string,
    data: UpdateUserConfigRequest
  ): Promise<McpUserConfiguration | null> {
    this.logger.debug({
      operation: 'update_user_configuration',
      configId,
      userId,
      teamId
    }, 'Updating user configuration');

    // Get existing configuration with server info for validation
    const existing = await this.getUserConfigurationById(configId, userId, teamId);
    if (!existing) {
      return null;
    }

    // Validate against server schema if server info is available
    if (existing.installation?.server) {
      if (data.user_args !== undefined) {
        this.validateUserArgs(data.user_args, existing.installation.server.user_args_schema || []);
      }
      if (data.user_env !== undefined) {
        this.validateUserEnv(data.user_env, existing.installation.server.user_env_schema || []);
      }
    }

    // Check for device ID conflicts if changing device ID
    if (data.device_id !== undefined && data.device_id !== existing.device_id) {
      const conflictingConfig = await this.db
        .select()
        .from(mcpUserConfigurations)
        .where(
          and(
            eq(mcpUserConfigurations.installation_id, existing.installation_id),
            eq(mcpUserConfigurations.user_id, userId),
            eq(mcpUserConfigurations.device_id, data.device_id),
            // Exclude current configuration
            ne(mcpUserConfigurations.id, configId)
          )
        )
        .limit(1);

      if (conflictingConfig.length > 0) {
        throw new Error('A configuration with this device ID already exists for this installation');
      }
    }

    const updateData: any = {
      updated_at: new Date()
    };

    if (data.device_id !== undefined) {
      updateData.device_id = data.device_id || null;
    }

    if (data.user_args !== undefined) {
      updateData.user_args = data.user_args ? await McpArgsStorage.storeUserArgs(
        data.user_args, 
        existing.installation?.server?.user_args_schema || [], 
        this.logger
      ) : null;
    }

    if (data.user_env !== undefined) {
      updateData.user_env = data.user_env ? await McpEnvStorage.storeUserEnv(
        data.user_env, 
        existing.installation?.server?.user_env_schema || [], 
        this.logger
      ) : null;
    }

    await this.db
      .update(mcpUserConfigurations)
      .set(updateData)
      .where(eq(mcpUserConfigurations.id, configId));

    this.logger.info({
      operation: 'update_user_configuration',
      configId,
      updatedFields: Object.keys(updateData)
    }, 'Successfully updated user configuration');

    return await this.getUserConfigurationById(configId, userId, teamId);
  }

  async deleteUserConfiguration(
    configId: string,
    userId: string,
    teamId: string
  ): Promise<boolean> {
    this.logger.debug({
      operation: 'delete_user_configuration',
      configId,
      userId,
      teamId
    }, 'Deleting user configuration');

    // Verify ownership through join to ensure user can only delete their own configs in their team
    const result = await this.db
      .delete(mcpUserConfigurations)
      .where(
        and(
          eq(mcpUserConfigurations.id, configId),
          eq(mcpUserConfigurations.user_id, userId),
          // Verify team access through installation
          eq(mcpUserConfigurations.installation_id, 
            this.db.select({ id: mcpServerInstallations.id })
              .from(mcpServerInstallations)
              .where(eq(mcpServerInstallations.team_id, teamId))
              .limit(1)
          )
        )
      );

    const deleted = result.changes > 0;

    this.logger.info({
      operation: 'delete_user_configuration',
      configId,
      deleted
    }, 'User configuration deletion completed');

    return deleted;
  }

  async updateUserArgs(
    configId: string,
    userId: string,
    teamId: string,
    args: Record<string, string>
  ): Promise<McpUserConfiguration | null> {
    this.logger.debug({
      operation: 'update_user_args',
      configId,
      userId,
      teamId,
      argsCount: Object.keys(args).length
    }, 'Updating user configuration args');

    return await this.updateUserConfiguration(configId, userId, teamId, { user_args: args });
  }

  async updateUserEnv(
    configId: string,
    userId: string,
    teamId: string,
    env: Record<string, string>
  ): Promise<McpUserConfiguration | null> {
    this.logger.debug({
      operation: 'update_user_env',
      configId,
      userId,
      teamId,
      envVarCount: Object.keys(env).length
    }, 'Updating user configuration environment variables');

    return await this.updateUserConfiguration(configId, userId, teamId, { user_env: env });
  }

  private validateUserArgs(userArgs: Record<string, string>, schema: any[]): void {
    // Validate user args against schema if provided
    // Args are now key-value mappings (placeholder -> actual value)
    if (schema && schema.length > 0) {
      // Validate each argument mapping against schema
      for (const [argName, argValue] of Object.entries(userArgs)) {
        const schemaEntry = schema.find((arg: any) => arg.name === argName);
        
        if (schemaEntry) {
          // If this field is required and the sent value is empty, throw error
          if (schemaEntry.required && (!argValue || argValue.trim() === '')) {
            throw new Error(`Required argument '${argName}' is missing or empty`);
          }
          
          // Additional type validation can be added here in the future
          // e.g., if (schemaEntry.type === 'number' && isNaN(Number(argValue)))
        }
        // Note: We don't validate fields that aren't in the schema - allowing flexibility
      }
    }
  }

  private validateUserEnv(userEnv: Record<string, string>, schema: any[]): void {
    // Validate user environment variables against schema
    // Only validate the fields that are actually being sent, not all required fields
    for (const [envVarName, envVarValue] of Object.entries(userEnv)) {
      const schemaEntry = schema.find((envVar: any) => envVar.name === envVarName)
      
      if (schemaEntry) {
        // If this field is required and the sent value is empty, throw error
        if (schemaEntry.required && (!envVarValue || envVarValue.trim() === '')) {
          throw new Error(`Required environment variable '${envVarName}' is missing or empty`)
        }
        
        // Additional type validation can be added here in the future
        // e.g., if (schemaEntry.type === 'number' && isNaN(Number(envVarValue)))
      }
      // Note: We don't validate fields that aren't in the schema - allowing flexibility
    }
  }

  private parseJsonField(fieldValue: any, defaultValue: any): any {
    // Handle null, undefined, or empty values
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      return defaultValue;
    }
    
    // If it's already an object/array, return as-is
    if (typeof fieldValue !== 'string') {
      return fieldValue;
    }
    
    // Handle empty string after trimming
    if (fieldValue.trim() === '') {
      return defaultValue;
    }
    
    try {
      const parsed = JSON.parse(fieldValue);
      return parsed;
    } catch (e) {
      this.logger.warn({
        operation: 'parse_json_field_error',
        fieldValue,
        fieldType: typeof fieldValue,
        fieldLength: fieldValue?.length,
        error: e instanceof Error ? e.message : String(e)
      }, 'Failed to parse JSON field, using default value');
      return defaultValue;
    }
  }
}

// Export service instance - will be initialized in the main application
export let mcpUserConfigurationService: McpUserConfigurationService;

export function initializeMcpUserConfigurationService(db: AnyDatabase, logger: FastifyBaseLogger) {
  mcpUserConfigurationService = new McpUserConfigurationService(db, logger);
}
