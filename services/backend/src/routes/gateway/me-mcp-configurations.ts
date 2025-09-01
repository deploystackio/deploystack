import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../middleware/oauthMiddleware';
import { getDb } from '../../db';
import { eq, and, inArray } from 'drizzle-orm';
import { mcpServers, mcpServerInstallations, mcpUserConfigurations, teamMemberships, devices } from '../../db/schema.sqlite';
import { McpArgsStorage } from '../../utils/mcpArgsStorage';
import { McpEnvStorage } from '../../utils/mcpEnvStorage';
import { trackDeviceActivity } from '../../services/deviceActivityService';

// Response schemas
const GATEWAY_MCP_SERVER_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Server identifier' },
    name: { type: 'string', description: 'Server name' },
    command: { type: 'string', description: 'Command to execute' },
    args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Command arguments with user values merged'
    },
    env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Environment variables with user values merged'
    },
    status: {
      type: 'string',
      enum: ['ready', 'invalid'],
      description: 'Server configuration status'
    }
  },
  required: ['id', 'name', 'command', 'args', 'env', 'status'],
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    data: {
      type: 'object',
      properties: {
        servers: {
          type: 'array',
          items: GATEWAY_MCP_SERVER_SCHEMA
        }
      },
      required: ['servers'],
      additionalProperties: false
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error'],
  additionalProperties: false
} as const;

// TypeScript interfaces
interface QueryParams {
  hardware_id?: string;
}

interface GatewayMcpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'ready' | 'invalid';
}

interface SuccessResponse {
  success: boolean;
  data: {
    servers: GatewayMcpServer[];
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function gatewayMeMcpConfigurationsRoute(server: FastifyInstance) {
  server.get('/gateway/me/mcp-configurations', {
    preValidation: [
      requireAuthenticationAny(),
      requireOAuthScope('mcp:read')
    ],
    schema: {
      tags: ['Gateway'],
      summary: 'Get merged MCP configurations for gateway',
      description: 'Retrieves all MCP server configurations for the authenticated user with merged template, team, and user-specific values. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      querystring: {
        type: 'object',
        properties: {
          hardware_id: {
            type: 'string',
            description: 'Hardware ID to get device-specific user configurations'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'MCP configurations retrieved successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid hardware_id or missing parameters'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user!.id;
    const query = request.query as QueryParams;
    const hardwareId = query.hardware_id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.debug({
      operation: 'gateway_mcp_configurations',
      userId,
      hardwareId,
      authType,
      clientId: request.tokenPayload?.clientId,
      scope: request.tokenPayload?.scope,
      endpoint: request.url
    }, 'Authentication method determined for gateway MCP configurations');

    request.log.info({
      operation: 'get_gateway_mcp_configurations',
      userId,
      hardwareId,
      authType
    }, 'Getting merged MCP configurations for gateway');

    try {
      const db = getDb();

      // Find device by hardware_id if provided
      let deviceId: string | null = null;
      if (hardwareId) {
        const deviceResults = await db
          .select({ id: devices.id })
          .from(devices)
          .where(
            and(
              eq(devices.user_id, userId),
              eq(devices.hardware_id, hardwareId)
            )
          )
          .limit(1);

        if (deviceResults.length > 0) {
          deviceId = deviceResults[0].id;
          request.log.debug({
            operation: 'get_gateway_mcp_configurations',
            userId,
            hardwareId,
            deviceId
          }, 'Found device by hardware_id');
        } else {
          request.log.warn({
            operation: 'get_gateway_mcp_configurations',
            userId,
            hardwareId
          }, 'No device found for hardware_id');
        }
      }

      // Get user's teams
      const userTeams = await db
        .select({ teamId: teamMemberships.team_id })
        .from(teamMemberships)
        .where(eq(teamMemberships.user_id, userId));

      if (userTeams.length === 0) {
        request.log.warn({
          operation: 'get_gateway_mcp_configurations',
          userId,
          teamsFound: 0
        }, 'User has no team memberships');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User has no team memberships'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const teamIds = userTeams.map((t: { teamId: string }) => t.teamId);

      // Get all MCP server installations for user's teams with server details
      const installations = await db
        .select({
          installation: mcpServerInstallations,
          server: mcpServers
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(
          and(
            eq(mcpServers.status, 'active'),
            inArray(mcpServerInstallations.team_id, teamIds)
          )
        );

      const servers: GatewayMcpServer[] = [];

      for (const { installation, server } of installations) {
        if (!server) continue;

        try {
          // Parse base configuration from installation_methods
          const installationMethods = JSON.parse(server.installation_methods || '[]');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const claudeDesktopMethod = installationMethods.find((method: any) => method.client === 'claude-desktop');
          
          if (!claudeDesktopMethod) {
            request.log.warn({
              serverId: server.id,
              serverName: server.name
            }, 'No claude-desktop installation method found');
            continue;
          }

          // Start with base configuration
          let finalCommand = claudeDesktopMethod.command || 'npx';
          let finalArgs = [...(claudeDesktopMethod.args || [])];
          let finalEnv = { ...(claudeDesktopMethod.env || {}) };

          // Apply team configuration with proper decryption
          if (installation.team_args) {
            try {
              const teamArgsSchema = JSON.parse(server.team_args_schema || '[]');
              const decryptedTeamArgs = await McpArgsStorage.retrieveTeamArgs(
                installation.team_args,
                teamArgsSchema,
                { maskSecrets: false }, // Decrypt secrets for gateway
                request.log
              );
              
              // Apply decrypted team arguments
              if (Array.isArray(decryptedTeamArgs) && decryptedTeamArgs.length > 0) {
                // Replace args based on team_args_schema
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                teamArgsSchema.forEach((schema: any, index: number) => {
                  if (decryptedTeamArgs[index] !== undefined) {
                    // Find the argument in finalArgs and replace it
                    const argIndex = finalArgs.findIndex(arg => arg === schema.name);
                    if (argIndex !== -1) {
                      finalArgs[argIndex + 1] = decryptedTeamArgs[index]; // Replace the value after the argument name
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

          // Apply team environment variables with proper decryption
          if (installation.team_env) {
            try {
              const teamEnvSchema = JSON.parse(server.team_env_schema || '[]');
              const decryptedTeamEnv = await McpEnvStorage.retrieveTeamEnv(
                installation.team_env,
                teamEnvSchema,
                { maskSecrets: false }, // Decrypt secrets for gateway
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

          // Get user configuration for this installation and device
          let userConfig = null;
          if (deviceId) {
            const userConfigs = await db
              .select()
              .from(mcpUserConfigurations)
              .where(
                and(
                  eq(mcpUserConfigurations.installation_id, installation.id),
                  eq(mcpUserConfigurations.user_id, userId),
                  eq(mcpUserConfigurations.device_id, deviceId)
                )
              )
              .limit(1);

            userConfig = userConfigs[0] || null;
          }

          // Apply user configuration
          let configStatus: 'ready' | 'invalid' = 'ready';
          
          if (userConfig) {
            // Apply user args with proper decryption
            if (userConfig.user_args) {
              try {
                const userArgsSchema = JSON.parse(server.user_args_schema || '[]');
                const decryptedUserArgs = await McpArgsStorage.retrieveUserArgs(
                  userConfig.user_args,
                  userArgsSchema,
                  { maskSecrets: false }, // Decrypt secrets for gateway
                  request.log
                );
                
                // Replace user-specific arguments
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                userArgsSchema.forEach((schema: any) => {
                  if (decryptedUserArgs[schema.name] !== undefined) {
                    const argIndex = finalArgs.findIndex(arg => arg === schema.name);
                    if (argIndex !== -1) {
                      finalArgs[argIndex] = decryptedUserArgs[schema.name];
                    } else {
                      // Add new argument if not found
                      finalArgs.push(decryptedUserArgs[schema.name]);
                    }
                  } else if (schema.required) {
                    configStatus = 'invalid';
                    request.log.warn({
                      serverId: server.id,
                      argName: schema.name
                    }, 'Required user argument is missing');
                  }
                });
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to decrypt and parse user_args');
                configStatus = 'invalid';
              }
            }

            // Apply user environment variables with proper decryption
            if (userConfig.user_env) {
              try {
                const userEnvSchema = JSON.parse(server.user_env_schema || '[]');
                const decryptedUserEnv = await McpEnvStorage.retrieveUserEnv(
                  userConfig.user_env,
                  userEnvSchema,
                  { maskSecrets: false }, // Decrypt secrets for gateway
                  request.log
                );
                finalEnv = { ...finalEnv, ...decryptedUserEnv };
              } catch (error) {
                request.log.warn({
                  serverId: server.id,
                  error: error instanceof Error ? error.message : String(error)
                }, 'Failed to decrypt and parse user_env');
                configStatus = 'invalid';
              }
            }
          } else {
            // Check if user configuration is required
            const userArgsSchema = JSON.parse(server.user_args_schema || '[]');
            const userEnvSchema = JSON.parse(server.user_env_schema || '[]');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasRequiredUserConfig = userArgsSchema.some((schema: any) => schema.required) ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        userEnvSchema.some((schema: any) => schema.required);
            
            if (hasRequiredUserConfig) {
              configStatus = 'invalid';
              request.log.warn({
                serverId: server.id,
                hardwareId,
                deviceId
              }, 'User configuration required but not found');
            }
          }

          servers.push({
            id: server.id,
            name: server.name,
            command: finalCommand,
            args: finalArgs,
            env: finalEnv,
            status: configStatus
          });

        } catch (error) {
          request.log.error({
            serverId: server.id,
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to process server configuration');
          
          // Add server as invalid
          servers.push({
            id: server.id,
            name: server.name,
            command: 'npx',
            args: [],
            env: {},
            status: 'invalid'
          });
        }
      }

      request.log.info({
        operation: 'get_gateway_mcp_configurations',
        userId,
        hardwareId,
        deviceId,
        authType,
        serversCount: servers.length,
        readyServers: servers.filter(s => s.status === 'ready').length,
        invalidServers: servers.filter(s => s.status === 'invalid').length
      }, 'Successfully retrieved gateway MCP configurations');

      // Track device activity if hardware_id was provided (fire-and-forget)
      if (hardwareId) {
        trackDeviceActivity(db, hardwareId, request.log, {
          updateLastIp: request.ip,
          silent: true
        });
      }

      const successResponse: SuccessResponse = {
        success: true,
        data: {
          servers
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'get_gateway_mcp_configurations',
        error,
        userId,
        hardwareId
      }, 'Failed to retrieve gateway MCP configurations');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
