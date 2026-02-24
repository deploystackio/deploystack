/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, desc } from 'drizzle-orm';
import { getSchema } from '../db/index';
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
  user_args?: Record<string, string>;
  user_env?: Record<string, string>;
  user_headers?: Record<string, string>;
  user_url_query_params?: Record<string, string>;
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
      user_headers_schema?: any[];
      user_url_query_params_schema?: any[];
    };
  };
}

export interface CreateUserConfigRequest {
  user_args?: Record<string, string>;
  user_env?: Record<string, string>;
  user_headers?: Record<string, string>;
  user_url_query_params?: Record<string, string>;
}

export interface UpdateUserConfigRequest {
  user_args?: Record<string, string>;
  user_env?: Record<string, string>;
  user_headers?: Record<string, string>;
  user_url_query_params?: Record<string, string>;
}

export class McpUserConfigurationService {
  private readonly mcpUserConfigurations: ReturnType<typeof getSchema>['mcpUserConfigurations'];
  private readonly mcpServerInstallations: ReturnType<typeof getSchema>['mcpServerInstallations'];
  private readonly mcpServers: ReturnType<typeof getSchema>['mcpServers'];

  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {
    const schema = getSchema();
    this.mcpUserConfigurations = schema.mcpUserConfigurations;
    this.mcpServerInstallations = schema.mcpServerInstallations;
    this.mcpServers = schema.mcpServers;
  }

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
      .from(this.mcpServerInstallations)
      .where(
        and(
          eq(this.mcpServerInstallations.id, installationId),
          eq(this.mcpServerInstallations.team_id, teamId)
        )
      )
      .limit(1);

    if (installation.length === 0) {
      throw new Error('Installation not found or access denied');
    }

    const configurations = await this.db
      .select({
        config: this.mcpUserConfigurations,
        installation: this.mcpServerInstallations,
        server: this.mcpServers
      })
      .from(this.mcpUserConfigurations)
      .leftJoin(this.mcpServerInstallations, eq(this.mcpUserConfigurations.installation_id, this.mcpServerInstallations.id))
      .leftJoin(this.mcpServers, eq(this.mcpServerInstallations.server_id, this.mcpServers.id))
      .where(
        and(
          eq(this.mcpUserConfigurations.installation_id, installationId),
          eq(this.mcpUserConfigurations.user_id, userId)
        )
      )
      .orderBy(desc(this.mcpUserConfigurations.created_at));

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
      const userHeadersSchema = this.parseJsonField(row.server?.user_headers_schema, []);
      const userUrlQueryParamsSchema = this.parseJsonField(row.server?.user_url_query_params_schema, []);

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

      const userHeaders = row.config.user_headers
        ? await McpEnvStorage.retrieveUserEnv(
            row.config.user_headers,
            userHeadersSchema,
            { maskSecrets: true },
            this.logger
          )
        : undefined;

      const userUrlQueryParams = row.config.user_url_query_params
        ? await McpEnvStorage.retrieveUserEnv(
            row.config.user_url_query_params,
            userUrlQueryParamsSchema,
            { maskSecrets: true },
            this.logger
          )
        : undefined;

      processedConfigurations.push({
        ...row.config,
        last_used_at: row.config.last_used_at ?? undefined,
        user_args: userArgs,
        user_env: userEnv,
        user_headers: userHeaders,
        user_url_query_params: userUrlQueryParams,
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
            user_env_schema: userEnvSchema,
            user_headers_schema: userHeadersSchema,
            user_url_query_params_schema: userUrlQueryParamsSchema
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
        config: this.mcpUserConfigurations,
        installation: this.mcpServerInstallations,
        server: this.mcpServers
      })
      .from(this.mcpUserConfigurations)
      .leftJoin(this.mcpServerInstallations, eq(this.mcpUserConfigurations.installation_id, this.mcpServerInstallations.id))
      .leftJoin(this.mcpServers, eq(this.mcpServerInstallations.server_id, this.mcpServers.id))
      .where(
        and(
          eq(this.mcpUserConfigurations.id, configId),
          eq(this.mcpUserConfigurations.user_id, userId),
          eq(this.mcpServerInstallations.team_id, teamId)
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
    const userHeadersSchema = this.parseJsonField(server?.user_headers_schema, []);
    const userUrlQueryParamsSchema = this.parseJsonField(server?.user_url_query_params_schema, []);

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

    const userHeaders = config.user_headers
      ? await McpEnvStorage.retrieveUserEnv(
          config.user_headers,
          userHeadersSchema,
          { maskSecrets: true },
          this.logger
        )
      : undefined;

    const userUrlQueryParams = config.user_url_query_params
      ? await McpEnvStorage.retrieveUserEnv(
          config.user_url_query_params,
          userUrlQueryParamsSchema,
          { maskSecrets: true },
          this.logger
        )
      : undefined;

    return {
      ...config,
      last_used_at: config.last_used_at ?? undefined,
      user_args: userArgs,
      user_env: userEnv,
      user_headers: userHeaders,
      user_url_query_params: userUrlQueryParams,
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
          user_env_schema: userEnvSchema,
          user_headers_schema: userHeadersSchema,
          user_url_query_params_schema: userUrlQueryParamsSchema
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
      teamId
    }, 'Creating user configuration');

    // Verify installation exists and user has access
    const installation = await this.db
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

    if (installation.length === 0) {
      throw new Error('Installation not found or access denied');
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
      if (data.user_headers) {
        this.validateUserHeaders(data.user_headers, this.parseJsonField(serverInfo.user_headers_schema, []));
      }
      if (data.user_url_query_params) {
        this.validateUserUrlQueryParams(data.user_url_query_params, this.parseJsonField(serverInfo.user_url_query_params_schema, []));
      }
    }

    const configId = nanoid();
    const now = new Date();

    const configData = {
      id: configId,
      installation_id: installationId,
      user_id: userId,
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
      user_headers: data.user_headers ? await McpEnvStorage.storeUserEnv(
        data.user_headers,
        this.parseJsonField(serverInfo?.user_headers_schema, []),
        this.logger
      ) : null,
      user_url_query_params: data.user_url_query_params ? await McpEnvStorage.storeUserEnv(
        data.user_url_query_params,
        this.parseJsonField(serverInfo?.user_url_query_params_schema, []),
        this.logger
      ) : null,
      created_at: now,
      updated_at: now,
      last_used_at: null
    };

    await this.db.insert(this.mcpUserConfigurations).values(configData);

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
      if (data.user_headers !== undefined) {
        this.validateUserHeaders(data.user_headers, existing.installation.server.user_headers_schema || []);
      }
      if (data.user_url_query_params !== undefined) {
        this.validateUserUrlQueryParams(data.user_url_query_params, existing.installation.server.user_url_query_params_schema || []);
      }
    }


    const updateData: any = {
      updated_at: new Date()
    };

    // Fetch raw encrypted values from DB for merging partial updates
    const rawConfig = await this.db
      .select({
        user_env: this.mcpUserConfigurations.user_env,
        user_headers: this.mcpUserConfigurations.user_headers,
        user_url_query_params: this.mcpUserConfigurations.user_url_query_params,
      })
      .from(this.mcpUserConfigurations)
      .where(eq(this.mcpUserConfigurations.id, configId))
      .limit(1);

    const rawRecord = rawConfig[0];

    if (data.user_args !== undefined) {
      updateData.user_args = data.user_args ? await McpArgsStorage.storeUserArgs(
        data.user_args,
        existing.installation?.server?.user_args_schema || [],
        this.logger
      ) : null;
    }

    if (data.user_env !== undefined) {
      if (data.user_env) {
        // Merge: decrypt existing values, apply incoming changes, re-encrypt
        let mergedEnv = data.user_env;
        if (rawRecord?.user_env) {
          const existingDecrypted = await McpEnvStorage.retrieveUserEnv(
            rawRecord.user_env,
            existing.installation?.server?.user_env_schema || [],
            { maskSecrets: false, decryptSecrets: true },
            this.logger
          );
          mergedEnv = { ...existingDecrypted, ...data.user_env };
        }
        updateData.user_env = await McpEnvStorage.storeUserEnv(
          mergedEnv,
          existing.installation?.server?.user_env_schema || [],
          this.logger
        );
      } else {
        updateData.user_env = null;
      }
    }

    if (data.user_headers !== undefined) {
      if (data.user_headers) {
        // Merge with existing headers
        let mergedHeaders = data.user_headers;
        if (rawRecord?.user_headers) {
          const existingDecrypted = await McpEnvStorage.retrieveUserEnv(
            rawRecord.user_headers,
            existing.installation?.server?.user_headers_schema || [],
            { maskSecrets: false, decryptSecrets: true },
            this.logger
          );
          mergedHeaders = { ...existingDecrypted, ...data.user_headers };
        }
        updateData.user_headers = await McpEnvStorage.storeUserEnv(
          mergedHeaders,
          existing.installation?.server?.user_headers_schema || [],
          this.logger
        );
      } else {
        updateData.user_headers = null;
      }
    }

    if (data.user_url_query_params !== undefined) {
      if (data.user_url_query_params) {
        // Merge with existing query params
        let mergedParams = data.user_url_query_params;
        if (rawRecord?.user_url_query_params) {
          const existingDecrypted = await McpEnvStorage.retrieveUserEnv(
            rawRecord.user_url_query_params,
            existing.installation?.server?.user_url_query_params_schema || [],
            { maskSecrets: false, decryptSecrets: true },
            this.logger
          );
          mergedParams = { ...existingDecrypted, ...data.user_url_query_params };
        }
        updateData.user_url_query_params = await McpEnvStorage.storeUserEnv(
          mergedParams,
          existing.installation?.server?.user_url_query_params_schema || [],
          this.logger
        );
      } else {
        updateData.user_url_query_params = null;
      }
    }

    await this.db
      .update(this.mcpUserConfigurations)
      .set(updateData)
      .where(eq(this.mcpUserConfigurations.id, configId));

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
      .delete(this.mcpUserConfigurations)
      .where(
        and(
          eq(this.mcpUserConfigurations.id, configId),
          eq(this.mcpUserConfigurations.user_id, userId),
          // Verify team access through installation
          eq(this.mcpUserConfigurations.installation_id, 
            this.db.select({ id: this.mcpServerInstallations.id })
              .from(this.mcpServerInstallations)
              .where(eq(this.mcpServerInstallations.team_id, teamId))
              .limit(1)
          )
        )
      );

    const deleted = (result.rowCount || 0) > 0;

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

  async updateUserHeaders(
    configId: string,
    userId: string,
    teamId: string,
    headers: Record<string, string>
  ): Promise<McpUserConfiguration | null> {
    this.logger.debug({
      operation: 'update_user_headers',
      configId,
      userId,
      teamId,
      headerCount: Object.keys(headers).length
    }, 'Updating user configuration headers');

    return await this.updateUserConfiguration(configId, userId, teamId, { user_headers: headers });
  }

  async updateUserQueryParams(
    configId: string,
    userId: string,
    teamId: string,
    queryParams: Record<string, string>
  ): Promise<McpUserConfiguration | null> {
    this.logger.debug({
      operation: 'update_user_query_params',
      configId,
      userId,
      teamId,
      queryParamCount: Object.keys(queryParams).length
    }, 'Updating user configuration URL query parameters');

    return await this.updateUserConfiguration(configId, userId, teamId, { user_url_query_params: queryParams });
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

  private validateUserHeaders(userHeaders: Record<string, string>, schema: any[]): void {
    // Validate user headers against schema
    // Only validate the fields that are actually being sent, not all required fields
    for (const [headerName, headerValue] of Object.entries(userHeaders)) {
      const schemaEntry = schema.find((header: any) => header.name === headerName)

      if (schemaEntry) {
        // If this field is required and the sent value is empty, throw error
        if (schemaEntry.required && (!headerValue || headerValue.trim() === '')) {
          throw new Error(`Required header '${headerName}' is missing or empty`)
        }

        // Additional type validation can be added here in the future
      }
      // Note: We don't validate fields that aren't in the schema - allowing flexibility
    }
  }

  private validateUserUrlQueryParams(userUrlQueryParams: Record<string, string>, schema: any[]): void {
    // Validate user URL query params against schema
    // Only validate the fields that are actually being sent, not all required fields
    for (const [paramName, paramValue] of Object.entries(userUrlQueryParams)) {
      const schemaEntry = schema.find((param: any) => param.name === paramName)

      if (schemaEntry) {
        // If this field is required and the sent value is empty, throw error
        if (schemaEntry.required && (!paramValue || paramValue.trim() === '')) {
          throw new Error(`Required URL query parameter '${paramName}' is missing or empty`)
        }

        // Additional type validation can be added here in the future
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
