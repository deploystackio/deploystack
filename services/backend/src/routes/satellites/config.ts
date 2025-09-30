import { type FastifyInstance } from 'fastify';
import { getDb } from '../../db';
import { satellites, mcpServerInstallations, mcpServers, teams } from '../../db/schema.sqlite';
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
          enabled: { type: 'boolean', description: 'Whether this server is enabled' }
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
  timeout?: number;
  enabled: boolean;
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
          team_slug: teams.slug
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .leftJoin(teams, eq(mcpServerInstallations.team_id, teams.id))
        .where(whereClause);

      // Process each installation using proven gateway logic
      for (const { installation, server, team_slug } of installations) {
        if (!server || !team_slug) continue;

        try {
          // Create unique process identifier: {server_slug}-{team_slug}-{installation_id}
          const processId = `${server.slug}-${team_slug}-${installation.id}`;

          // Parse base configuration from packages (like gateway)
          const packages = JSON.parse(server.packages || '[]');
          
          if (!packages || packages.length === 0) {
            request.log.warn({
              serverId: server.id,
              serverName: server.name
            }, 'No packages configuration found');
            continue;
          }

          const packageConfig = packages[0];
          if (!packageConfig.transport) {
            request.log.warn({
              serverId: server.id,
              serverName: server.name
            }, 'No transport configuration in package');
            continue;
          }

          // Start with base configuration from package transport
          let finalCommand = packageConfig.transport.command || 'npx';
          let finalArgs = [...(packageConfig.transport.args || [])];
          let finalEnv = { ...(packageConfig.transport.env || {}) };
          let finalUrl = packageConfig.transport.url; // Extract real URL from package transport
          let finalHeaders = { ...(packageConfig.transport.headers || {}) };

          // Apply team configuration with proper decryption (like gateway)
          if (installation.team_args) {
            try {
              const teamArgsSchema = JSON.parse(server.team_args_schema || '[]');
              const decryptedTeamArgs = await McpArgsStorage.retrieveTeamArgs(
                installation.team_args,
                teamArgsSchema,
                { maskSecrets: false }, // Decrypt secrets for satellite
                request.log
              );
              
              // Apply decrypted team arguments
              if (Array.isArray(decryptedTeamArgs) && decryptedTeamArgs.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                teamArgsSchema.forEach((schema: any, index: number) => {
                  if (decryptedTeamArgs[index] !== undefined) {
                    const argIndex = finalArgs.findIndex(arg => arg === schema.name);
                    if (argIndex !== -1) {
                      finalArgs[argIndex + 1] = decryptedTeamArgs[index];
                    }
                  }
                });
              }
            } catch (error) {
              request.log.warn({
                serverId: server.id,
                error: error instanceof Error ? error.message : String(error)
              }, 'Failed to decrypt and parse team_args');
            }
          }

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
            enabled: true
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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const teamHeadersSchema = JSON.parse(server.team_headers_schema || '[]');
                // TODO: Add proper header decryption like args/env
                const teamHeaders = JSON.parse(installation.team_headers);
                serverConfig.headers = { ...serverConfig.headers, ...teamHeaders };
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to parse team_headers');
              }
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
