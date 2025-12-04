import { type FastifyInstance } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq, and } from 'drizzle-orm';
import { requireSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';
import { McpArgsStorage } from '../../utils/mcpArgsStorage';
import { McpEnvStorage } from '../../utils/mcpEnvStorage';

// Reusable Schema Constants
const SATELLITE_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    satelliteId: { 
      type: 'string', 
      minLength: 1,
      description: 'Unique satellite identifier'
    }
  },
  required: ['satelliteId'],
  additionalProperties: false
} as const;

const CONFIG_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    mcp_servers: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          installation_id: { type: 'string', description: 'Installation ID from mcpServerInstallations table' },
          team_id: { type: 'string', description: 'Team ID that owns this installation' },
          team_slug: { type: 'string', description: 'Team slug for identification' },
          server_name: { type: 'string', description: 'MCP server name (e.g., "context7")' },
          server_slug: { type: 'string', description: 'MCP server slug' },
          installation_name: { type: 'string', description: 'User-friendly installation name' },
          transport_type: { type: 'string', enum: ['stdio', 'http', 'sse'], description: 'MCP transport type' },
          url: { type: 'string', description: 'Server URL for HTTP/SSE transport' },
          command: { type: 'string', description: 'Command to run for stdio transport' },
          args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
          env: { type: 'object', description: 'Environment variables' },
          headers: { type: 'object', description: 'HTTP headers for HTTP/SSE transport' },
          timeout: { type: 'integer', description: 'Timeout in milliseconds' },
          enabled: { type: 'boolean', description: 'Whether this server is enabled' },
          requires_oauth: { type: 'boolean', description: 'Whether this MCP server requires OAuth authentication (Phase 10)' },
          user_id: { type: 'string', description: 'User ID who created the installation (for OAuth token retrieval, Phase 10)' },
          secret_metadata: {
            type: 'object',
            properties: {
              query_params: { type: 'array', items: { type: 'string' }, description: 'Names of query parameters that are secrets (should be masked in logs)' },
              headers: { type: 'array', items: { type: 'string' }, description: 'Names of headers that are secrets (should be masked in logs)' },
              env: { type: 'array', items: { type: 'string' }, description: 'Names of environment variables that are secrets (should be masked in logs)' }
            },
            description: 'Metadata about which fields contain secrets and should be masked in satellite logs'
          }
        },
        required: ['installation_id', 'team_id', 'server_name', 'transport_type', 'enabled']
      },
      description: 'MCP server configurations keyed by unique process identifier'
    },
    satellite_config: {
      type: 'object',
      properties: {
        polling_intervals: {
          type: 'object',
          properties: {
            normal: { type: 'integer', description: 'Normal polling interval in seconds' },
            immediate: { type: 'integer', description: 'Immediate polling interval in seconds' },
            error_backoff_max: { type: 'integer', description: 'Maximum backoff interval in seconds' }
          },
          required: ['normal', 'immediate', 'error_backoff_max']
        },
        resource_limits: {
          type: 'object',
          properties: {
            max_processes: { type: 'integer', description: 'Maximum number of MCP processes' },
            max_memory_per_process: { type: 'string', description: 'Maximum memory per process (e.g., "1GB")' },
            max_cpu_percent: { type: 'number', description: 'Maximum CPU usage percentage' }
          },
          required: ['max_processes']
        },
        team_settings: {
          type: 'object',
          properties: {
            allowed_servers: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of allowed MCP server types'
            },
            security_policies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Security policies to enforce'
            },
            isolation_level: {
              type: 'string',
              enum: ['none', 'process', 'container'],
              description: 'Process isolation level'
            }
          }
        },
        logging: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['debug', 'info', 'warn', 'error'],
              description: 'Logging level'
            },
            enable_audit: { type: 'boolean', description: 'Enable audit logging' },
            retention_days: { type: 'integer', description: 'Log retention period in days' }
          }
        },
        network: {
          type: 'object',
          properties: {
            timeout_seconds: { type: 'integer', description: 'Network timeout in seconds' },
            retry_attempts: { type: 'integer', description: 'Number of retry attempts' },
            proxy_url: { type: 'string', description: 'Proxy URL if required' }
          }
        }
      },
      required: ['polling_intervals', 'resource_limits']
    }
  },
  required: ['mcp_servers', 'satellite_config']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface SatelliteIdParams {
  satelliteId: string;
}

interface McpServerConfig {
  installation_id: string;
  team_id: string;
  team_slug: string;
  server_name: string;
  server_slug: string;
  installation_name: string;
  transport_type: 'stdio' | 'http' | 'sse';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  url_query_params?: Record<string, string>;
  timeout?: number;
  enabled: boolean;
  // Phase 10: OAuth support for HTTP/SSE MCP servers
  requires_oauth?: boolean;
  user_id?: string;
  secret_metadata?: {
    query_params?: string[];
    headers?: string[];
    env?: string[];
  };
}

interface ConfigResponse {
  mcp_servers: Record<string, McpServerConfig>;
  satellite_config: {
    polling_intervals: {
      normal: number;
      immediate: number;
      error_backoff_max: number;
    };
    resource_limits: {
      max_processes: number;
      max_memory_per_process?: string;
      max_cpu_percent?: number;
    };
    team_settings?: {
      allowed_servers?: string[];
      security_policies?: string[];
      isolation_level?: 'none' | 'process' | 'container';
    };
    logging?: {
      level?: 'debug' | 'info' | 'warn' | 'error';
      enable_audit?: boolean;
      retention_days?: number;
    };
    network?: {
      timeout_seconds?: number;
      retry_attempts?: number;
      proxy_url?: string;
    };
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function satelliteConfigRoute(server: FastifyInstance) {
  // GET /api/satellites/{satelliteId}/config - Satellite configuration retrieval
  server.get('/satellites/:satelliteId/config', {
    preValidation: [requireSatelliteAuth()], // Satellite API key authentication
    schema: {
      tags: ['Satellite Configuration'],
      summary: 'Get satellite configuration',
      description: 'Retrieve configuration settings for the satellite. Used by satellites to get their operational parameters.',
      security: [{ bearerAuth: [] }],
      
      params: SATELLITE_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...CONFIG_RESPONSE_SCHEMA,
          description: 'Satellite configuration'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid satellite API key'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Satellite not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { satelliteId } = request.params as SatelliteIdParams;

    const db = getDb();
    const { satellites, mcpServerInstallations, mcpServers, teams, mcpUserConfigurations } = getSchema();

    try {
      // Verify satellite exists and get its configuration
      const satellite = await db
        .select({
          id: satellites.id,
          name: satellites.name,
          satellite_type: satellites.satellite_type,
          team_id: satellites.team_id,
          config: satellites.config,
          capabilities: satellites.capabilities
        })
        .from(satellites)
        .where(eq(satellites.id, satelliteId))
        .limit(1);
      
      if (satellite.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Satellite not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }
      
      const satelliteData = satellite[0];
      
      // Parse existing configuration or use defaults
      let existingConfig = {};
      if (satelliteData.config) {
        try {
          existingConfig = JSON.parse(satelliteData.config);
        } catch {
          // Ignore JSON parse errors, use defaults
        }
      }
      
      // Build configuration based on satellite type and settings
      const baseConfig = {
        polling_intervals: {
          normal: 30,           // 30 seconds for normal polling
          immediate: 2,         // 2 seconds for immediate commands
          error_backoff_max: 300 // 5 minutes maximum backoff
        },
        resource_limits: {
          max_processes: satelliteData.satellite_type === 'global' ? 100 : 50,
          max_memory_per_process: '1GB',
          max_cpu_percent: 80.0
        },
        team_settings: {
          allowed_servers: [], // Will be populated based on team permissions
          security_policies: [],
          isolation_level: 'process' as const
        },
        logging: {
          level: 'info' as const,
          enable_audit: true,
          retention_days: 30
        },
        network: {
          timeout_seconds: 30,
          retry_attempts: 3,
          proxy_url: undefined
        }
      };
      
      // Merge with existing configuration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mergedConfig: any = {
        ...baseConfig,
        ...existingConfig
      };
      
      // Apply satellite-type specific configurations
      if (satelliteData.satellite_type === 'global') {
        // Global satellites serve all teams
        mergedConfig.team_settings = {
          ...mergedConfig.team_settings,
          allowed_servers: ['*'], // Allow all server types
          isolation_level: 'process' // Strong isolation for multi-tenant
        };
        mergedConfig.resource_limits.max_processes = 100;
      } else {
        // Team satellites have team-specific settings
        mergedConfig.team_settings = {
          ...mergedConfig.team_settings,
          isolation_level: 'none' // Less isolation needed for single team
        };
        mergedConfig.resource_limits.max_processes = 50;
      }
      
      // Parse capabilities to determine allowed servers
      let capabilities: string[] = [];
      if (satelliteData.capabilities) {
        try {
          capabilities = JSON.parse(satelliteData.capabilities);
        } catch {
          // Ignore JSON parse errors
        }
      }
      
      if (capabilities.length > 0 && satelliteData.satellite_type === 'team') {
        mergedConfig.team_settings.allowed_servers = capabilities;
      }
      
      // Fetch MCP server installations for this satellite
      const mcpServerConfigs: Record<string, McpServerConfig> = {};
      
      // Get ALL MCP server installations with server details (adapted from gateway logic)
      // Global satellites get all teams, team satellites get only their team
      const whereClause = satelliteData.satellite_type === 'global' 
        ? eq(mcpServers.status, 'active')
        : and(
            eq(mcpServers.status, 'active'),
            eq(mcpServerInstallations.team_id, satelliteData.team_id!)
          );

      const installations = await db
        .select({
          installation: mcpServerInstallations,
          server: mcpServers,
          team_slug: teams.slug,
          created_by_user_id: mcpServerInstallations.created_by // Phase 10: User ID for OAuth
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .leftJoin(teams, eq(mcpServerInstallations.team_id, teams.id))
        .where(whereClause);

      // Process each installation using proven gateway logic
      for (const { installation, server, team_slug, created_by_user_id } of installations) {
        if (!server || !team_slug) continue;

        try {
          // Create unique process identifier: {server_slug}-{team_slug}-{installation_id}
          const processId = `${server.slug}-${team_slug}-${installation.id}`;

          // Initialize configuration variables
          let finalCommand: string | undefined;
          let finalArgs: string[] = [];
          let finalEnv: Record<string, string> = {};
          let finalUrl: string | undefined;
          let finalHeaders: Record<string, string> = {};

          // Parse base configuration based on transport type
          if (server.transport_type === 'stdio') {
            // For stdio, use packages for command and env, but build args from three-tier schema
            const packages = JSON.parse(server.packages || '[]');

            if (!packages || packages.length === 0) {
              request.log.warn({
                serverId: server.id,
                serverName: server.name
              }, 'No packages configuration found for stdio transport');
              continue;
            }

            const packageConfig = packages[0];
            if (!packageConfig || !packageConfig.transport) {
              request.log.warn({
                serverId: server.id,
                serverName: server.name,
                hasPackageConfig: !!packageConfig
              }, 'No transport configuration in package');
              continue;
            }

            finalCommand = packageConfig.transport.command || 'npx';
            finalEnv = { ...(packageConfig.transport.env || {}) };

            // Build args from three-tier configuration with proper order
            // This replaces the old packages[0].transport.args approach
            interface ArgItem {
              value: string;
              order: number;
              source: 'template' | 'team' | 'user';
            }
            const orderedArgs: ArgItem[] = [];

            // 1. Parse template_args (fixed values with order)
            try {
              const templateArgs = JSON.parse(server.template_args || '[]');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              templateArgs.forEach((arg: any, index: number) => {
                if (arg.value !== undefined && arg.value !== '') {
                  orderedArgs.push({
                    value: arg.value,
                    order: arg.order ?? index,
                    source: 'template'
                  });
                }
              });
            } catch (error) {
              request.log.warn({
                serverId: server.id,
                error: error instanceof Error ? error.message : String(error)
              }, 'Failed to parse template_args');
            }

            // 2. Parse team_args_schema and get values from installation.team_args
            if (installation.team_args) {
              try {
                const teamArgsSchema = JSON.parse(server.team_args_schema || '[]');
                const decryptedTeamArgs = await McpArgsStorage.retrieveTeamArgs(
                  installation.team_args,
                  teamArgsSchema,
                  { maskSecrets: false }, // Decrypt secrets for satellite
                  request.log
                );

                // Map decrypted values back with their schema order
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                teamArgsSchema.forEach((schema: any, index: number) => {
                  const value = decryptedTeamArgs[index];
                  if (value !== undefined && value !== '') {
                    orderedArgs.push({
                      value: value,
                      order: schema.order ?? (100 + index), // Team args after template args
                      source: 'team'
                    });
                  }
                });
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to decrypt and parse team_args for ordering');
              }
            }

            // 3. Fetch and add user args for the installation creator
            if (created_by_user_id) {
              try {
                const userConfigs = await db
                  .select()
                  .from(mcpUserConfigurations)
                  .where(
                    and(
                      eq(mcpUserConfigurations.installation_id, installation.id),
                      eq(mcpUserConfigurations.user_id, created_by_user_id)
                    )
                  )
                  .limit(1);

                const userConfig = userConfigs[0];
                if (userConfig?.user_args) {
                  const userArgsSchema = JSON.parse(server.user_args_schema || '[]');
                  const decryptedUserArgs = await McpArgsStorage.retrieveUserArgs(
                    userConfig.user_args,
                    userArgsSchema,
                    { maskSecrets: false }, // Decrypt secrets for satellite
                    request.log
                  );

                  // Add user args to orderedArgs with their schema order
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  userArgsSchema.forEach((schema: any, index: number) => {
                    const value = decryptedUserArgs[schema.name];
                    if (value !== undefined && value !== '') {
                      orderedArgs.push({
                        value: value,
                        order: schema.order ?? (200 + index), // User args after template and team
                        source: 'user' as const
                      });
                    }
                  });

                  request.log.debug({
                    serverId: server.id,
                    userId: created_by_user_id,
                    userArgsCount: Object.keys(decryptedUserArgs).length
                  }, 'Added user args to configuration');
                }
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  userId: created_by_user_id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to fetch or parse user args');
              }
            }

            // Sort by order and extract values
            orderedArgs.sort((a, b) => a.order - b.order);
            finalArgs = orderedArgs.map(arg => arg.value);

            request.log.debug({
              serverId: server.id,
              serverName: server.name,
              argsCount: finalArgs.length,
              argsOrder: orderedArgs.map(a => ({ value: a.value.substring(0, 20), order: a.order, source: a.source }))
            }, 'Built args array from three-tier configuration');
          } else if (server.transport_type === 'http' || server.transport_type === 'sse') {
            // For HTTP/SSE, use remotes
            const remotes = JSON.parse(server.remotes || '[]');

            if (!remotes || remotes.length === 0) {
              request.log.warn({
                serverId: server.id,
                serverName: server.name,
                transportType: server.transport_type
              }, 'No remotes configuration found for HTTP/SSE transport');
              continue;
            }

            const remoteConfig = remotes[0];
            if (!remoteConfig || !remoteConfig.url) {
              request.log.warn({
                serverId: server.id,
                serverName: server.name,
                hasRemoteConfig: !!remoteConfig
              }, 'No URL in remote configuration');
              continue;
            }

            finalUrl = remoteConfig.url;
            finalHeaders = { ...(remoteConfig.headers || {}) };
          }

          // NOTE: Team args are now handled in the three-tier configuration block above
          // with proper ordering support. The old findIndex-based approach is removed.

          // Apply team environment variables with proper decryption (like gateway)
          if (installation.team_env) {
            try {
              const teamEnvSchema = JSON.parse(server.team_env_schema || '[]');
              const decryptedTeamEnv = await McpEnvStorage.retrieveTeamEnv(
                installation.team_env,
                teamEnvSchema,
                { maskSecrets: false }, // Decrypt secrets for satellite
                request.log
              );
              
              // Merge decrypted team environment variables
              finalEnv = { ...finalEnv, ...decryptedTeamEnv };
            } catch (error) {
              request.log.warn({
                serverId: server.id,
                error: error instanceof Error ? error.message : String(error)
              }, 'Failed to decrypt and process team_env');
            }
          }

          // Build server configuration based on transport type
          const serverConfig: McpServerConfig = {
            installation_id: installation.id,
            team_id: installation.team_id,
            team_slug: team_slug,
            server_name: server.name,
            server_slug: server.slug,
            installation_name: installation.installation_name,
            transport_type: server.transport_type as 'stdio' | 'http' | 'sse',
            enabled: true,
            // Phase 10: OAuth support for HTTP/SSE MCP servers
            requires_oauth: server.requires_oauth || false,
            user_id: created_by_user_id // User who created the installation (for OAuth token retrieval)
          };

          if (server.transport_type === 'stdio') {
            // For stdio transport, use the processed command and args
            serverConfig.command = finalCommand;
            serverConfig.args = finalArgs;
            serverConfig.env = finalEnv;
          } else if (server.transport_type === 'http' || server.transport_type === 'sse') {
            // For HTTP/SSE transport, use the real URL from installation method
            serverConfig.url = finalUrl;
            serverConfig.timeout = 45000;
            
            // Apply headers from installation method and team configuration
            serverConfig.headers = finalHeaders;

            if (installation.team_headers) {
              try {
                const teamHeadersSchema = JSON.parse(server.team_headers_schema || '[]');
                const decryptedTeamHeaders = await McpEnvStorage.retrieveTeamEnv(
                  installation.team_headers,
                  teamHeadersSchema,
                  { maskSecrets: false }, // Decrypt secrets for satellite
                  request.log
                );
                serverConfig.headers = { ...serverConfig.headers, ...decryptedTeamHeaders };
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to decrypt and parse team_headers');
              }
            }

            // Handle team URL query params with decryption
            let finalQueryParams: Record<string, string> = {};
            if (installation.team_url_query_params) {
              try {
                const teamUrlQueryParamsSchema = JSON.parse(server.team_url_query_params_schema || '[]');
                const decryptedTeamQueryParams = await McpEnvStorage.retrieveTeamEnv(
                  installation.team_url_query_params,
                  teamUrlQueryParamsSchema,
                  { maskSecrets: false }, // Decrypt secrets for satellite
                  request.log
                );
                finalQueryParams = { ...finalQueryParams, ...decryptedTeamQueryParams };
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to decrypt and parse team_url_query_params');
              }
            }

            // Fetch and apply user-level HTTP configuration (Tier 3)
            // User config overrides team config for headers and URL query params
            if (created_by_user_id) {
              try {
                const httpUserConfigs = await db
                  .select()
                  .from(mcpUserConfigurations)
                  .where(
                    and(
                      eq(mcpUserConfigurations.installation_id, installation.id),
                      eq(mcpUserConfigurations.user_id, created_by_user_id)
                    )
                  )
                  .limit(1);

                const httpUserConfig = httpUserConfigs[0];

                // Process user headers (overrides team headers)
                if (httpUserConfig?.user_headers) {
                  try {
                    const userHeadersSchema = JSON.parse(server.user_headers_schema || '[]');
                    const decryptedUserHeaders = await McpEnvStorage.retrieveUserEnv(
                      httpUserConfig.user_headers,
                      userHeadersSchema,
                      { maskSecrets: false }, // Decrypt secrets for satellite
                      request.log
                    );
                    serverConfig.headers = { ...serverConfig.headers, ...decryptedUserHeaders };

                    request.log.debug({
                      serverId: server.id,
                      userId: created_by_user_id,
                      userHeadersCount: Object.keys(decryptedUserHeaders).length
                    }, 'Added user headers to HTTP configuration');
                  } catch (error) {
                    request.log.warn({
                      serverId: server.id,
                      userId: created_by_user_id,
                      error: error instanceof Error ? error.message : String(error)
                    }, 'Failed to decrypt and parse user_headers');
                  }
                }

                // Process user URL query params (overrides team query params)
                if (httpUserConfig?.user_url_query_params) {
                  try {
                    const userUrlQueryParamsSchema = JSON.parse(server.user_url_query_params_schema || '[]');
                    const decryptedUserQueryParams = await McpEnvStorage.retrieveUserEnv(
                      httpUserConfig.user_url_query_params,
                      userUrlQueryParamsSchema,
                      { maskSecrets: false }, // Decrypt secrets for satellite
                      request.log
                    );
                    finalQueryParams = { ...finalQueryParams, ...decryptedUserQueryParams };

                    request.log.debug({
                      serverId: server.id,
                      userId: created_by_user_id,
                      userQueryParamsCount: Object.keys(decryptedUserQueryParams).length
                    }, 'Added user URL query params to HTTP configuration');
                  } catch (error) {
                    request.log.warn({
                      serverId: server.id,
                      userId: created_by_user_id,
                      error: error instanceof Error ? error.message : String(error)
                    }, 'Failed to decrypt and parse user_url_query_params');
                  }
                }
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  userId: created_by_user_id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to fetch user configuration for HTTP transport');
              }
            }

            // Apply query params to URL if any exist
            if (finalUrl && Object.keys(finalQueryParams).length > 0) {
              try {
                const url = new URL(finalUrl);
                Object.entries(finalQueryParams).forEach(([key, value]) => {
                  url.searchParams.set(key, value);
                });
                serverConfig.url = url.toString();
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to apply query params to URL');
                serverConfig.url = finalUrl; // Fall back to original URL
              }
            }

            // Extract secret metadata for satellite logging
            const secretQueryParams: string[] = [];
            const secretHeaders: string[] = [];

            // Extract secret query params from team schema
            if (installation.team_url_query_params) {
              try {
                const teamUrlQueryParamsSchema = JSON.parse(server.team_url_query_params_schema || '[]');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                teamUrlQueryParamsSchema.forEach((field: any) => {
                  if (field.type === 'secret' || field.type === 'password') {
                    secretQueryParams.push(field.name);
                  }
                });
              } catch (error) {
                request.log.debug({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to extract secret query param metadata from team schema');
              }
            }

            // Extract secret query params from user schema
            try {
              const userUrlQueryParamsSchema = JSON.parse(server.user_url_query_params_schema || '[]');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              userUrlQueryParamsSchema.forEach((field: any) => {
                if (field.type === 'secret' || field.type === 'password') {
                  if (!secretQueryParams.includes(field.name)) {
                    secretQueryParams.push(field.name);
                  }
                }
              });
            } catch (error) {
              request.log.debug({
                serverId: server.id,
                error: error instanceof Error ? error.message : String(error)
              }, 'Failed to extract secret query param metadata from user schema');
            }

            // Extract secret headers from team schema
            if (installation.team_headers) {
              try {
                const teamHeadersSchema = JSON.parse(server.team_headers_schema || '[]');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                teamHeadersSchema.forEach((field: any) => {
                  if (field.type === 'secret' || field.type === 'password') {
                    secretHeaders.push(field.name);
                  }
                });
              } catch (error) {
                request.log.debug({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to extract secret header metadata from team schema');
              }
            }

            // Extract secret headers from user schema
            try {
              const userHeadersSchema = JSON.parse(server.user_headers_schema || '[]');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              userHeadersSchema.forEach((field: any) => {
                if (field.type === 'secret' || field.type === 'password') {
                  if (!secretHeaders.includes(field.name)) {
                    secretHeaders.push(field.name);
                  }
                }
              });
            } catch (error) {
              request.log.debug({
                serverId: server.id,
                error: error instanceof Error ? error.message : String(error)
              }, 'Failed to extract secret header metadata from user schema');
            }

            // Add secret metadata to config if any secrets found
            if (secretQueryParams.length > 0 || secretHeaders.length > 0) {
              serverConfig.secret_metadata = {
                query_params: secretQueryParams.length > 0 ? secretQueryParams : undefined,
                headers: secretHeaders.length > 0 ? secretHeaders : undefined
              };
            }
          }

          // Extract secret env vars metadata for stdio transport
          if (server.transport_type === 'stdio' && installation.team_env) {
            const secretEnvVars: string[] = [];
            try {
              const teamEnvSchema = JSON.parse(server.team_env_schema || '[]');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teamEnvSchema.forEach((field: any) => {
                if (field.type === 'secret' || field.type === 'password') {
                  secretEnvVars.push(field.name);
                }
              });

              if (secretEnvVars.length > 0) {
                serverConfig.secret_metadata = {
                  ...serverConfig.secret_metadata,
                  env: secretEnvVars
                };
              }
            } catch (error) {
              request.log.debug({
                serverId: server.id,
                error: error instanceof Error ? error.message : String(error)
              }, 'Failed to extract secret env metadata');
            }
          }

          mcpServerConfigs[processId] = serverConfig;

          request.log.debug({
            operation: 'satellite_config_server_processed',
            processId,
            serverId: server.id,
            serverName: server.name,
            teamSlug: team_slug,
            transportType: server.transport_type,
            hasCommand: !!serverConfig.command,
            hasUrl: !!serverConfig.url,
            argsCount: serverConfig.args?.length || 0,
            envCount: Object.keys(serverConfig.env || {}).length
          }, 'MCP server configuration processed for satellite');

        } catch (error) {
          request.log.error({
            serverId: server.id,
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to process server configuration');
          
          // Add server as disabled on error
          const processId = `${server.slug}-${team_slug}-${installation.id}`;
          mcpServerConfigs[processId] = {
            installation_id: installation.id,
            team_id: installation.team_id,
            team_slug: team_slug,
            server_name: server.name,
            server_slug: server.slug,
            installation_name: installation.installation_name,
            transport_type: server.transport_type as 'stdio' | 'http' | 'sse',
            enabled: false // Disabled due to processing error
          };
        }
      }
      
      const response: ConfigResponse = {
        mcp_servers: mcpServerConfigs,
        satellite_config: mergedConfig
      };
      
      request.log.info({
        operation: 'satellite_config_retrieval',
        satelliteId,
        satelliteType: satelliteData.satellite_type,
        teamId: satelliteData.team_id,
        maxProcesses: mergedConfig.resource_limits.max_processes
      }, 'Satellite configuration retrieved');
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({
        operation: 'satellite_config_retrieval',
        satelliteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to retrieve satellite configuration');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error while retrieving configuration'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
