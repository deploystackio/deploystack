import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { McpInstallationService } from '../../../services/mcpInstallationService';
import { SatelliteCommandService } from '../../../services/satelliteCommandService';
import { getDb, getSchema } from '../../../db';
import { eq, and, sql } from 'drizzle-orm';
import { validateArgs, validateEnvVars } from '../../../lib/security';
import { McpEnvStorage } from '../../../utils/mcpEnvStorage';
import { McpArgsStorage } from '../../../utils/mcpArgsStorage';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  formatInstallationResponse,
  type TeamAndInstallationParams,
  type InstallationData,
  type InstallationUpdateSuccessResponse,
  type ErrorResponse
} from './schemas';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';

interface ConfigSchemaItem {
  name: string;
  type: 'string' | 'secret' | 'boolean';
  description?: string;
  required?: boolean;
}

interface UpdateConfigSchemaRequest {
  action: 'add' | 'remove';
  config_type: 'env' | 'args';
  item?: ConfigSchemaItem & { value?: string };
  item_name?: string;
}

const UPDATE_CONFIG_SCHEMA_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['add', 'remove'],
      description: 'Whether to add or remove a config schema item'
    },
    config_type: {
      type: 'string',
      enum: ['env', 'args'],
      description: 'Type of configuration to modify'
    },
    item: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 256 },
        type: { type: 'string', enum: ['string', 'secret', 'boolean'] },
        description: { type: 'string', maxLength: 1024 },
        required: { type: 'boolean' },
        value: { type: 'string', maxLength: 32768 }
      },
      required: ['name', 'type'],
      description: 'Schema item to add (required for add action)'
    },
    item_name: {
      type: 'string',
      minLength: 1,
      maxLength: 256,
      description: 'Name of the item to remove (required for remove action)'
    }
  },
  required: ['action', 'config_type'],
  additionalProperties: false
} as const;

function parseJsonField(fieldValue: string | null | undefined, defaultValue: unknown): unknown {
  if (!fieldValue || fieldValue.trim() === '') {
    return defaultValue;
  }
  try {
    return JSON.parse(fieldValue);
  } catch {
    return defaultValue;
  }
}

export default async function updateConfigSchemaRoute(server: FastifyInstance) {
  server.patch<{
    Params: TeamAndInstallationParams;
    Body: UpdateConfigSchemaRequest;
  }>('/teams/:teamId/mcp/installations/:installationId/config-schema', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.edit')
    ],
    schema: {
      tags: ['MCP Installations'],
      summary: 'Add or remove config schema items for GitHub-deployed MCP servers',
      description: 'Allows team admins to add or remove team-level args and env vars on GitHub-deployed MCP server installations. Only works for servers with source=github.',
      security: DUAL_AUTH_SECURITY,
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
      body: UPDATE_CONFIG_SCHEMA_REQUEST_SCHEMA,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          },
          description: 'Config schema updated successfully'
        },
        ...COMMON_ERROR_RESPONSES
      }
    }
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';
    const { action, config_type, item, item_name } = request.body;

    request.log.info({
      operation: 'update_config_schema',
      teamId,
      installationId,
      userId,
      authType,
      action,
      config_type
    }, 'Updating MCP installation config schema');

    try {
      // Validate request
      if (action === 'add' && !item) {
        const errorResponse: ErrorResponse = { success: false, error: 'item is required for add action' };
        return reply.status(400).type('application/json').send(JSON.stringify(errorResponse));
      }
      if (action === 'remove' && !item_name) {
        const errorResponse: ErrorResponse = { success: false, error: 'item_name is required for remove action' };
        return reply.status(400).type('application/json').send(JSON.stringify(errorResponse));
      }

      const db = getDb();
      const { mcpServers, mcpServerInstallations, mcpServerInstances } = getSchema();

      // Fetch installation with server data
      const installationRows = await db
        .select({
          installation_id: mcpServerInstallations.id,
          server_id: mcpServerInstallations.server_id,
          team_env: mcpServerInstallations.team_env,
          team_args: mcpServerInstallations.team_args,
          source: mcpServers.source,
          owner_team_id: mcpServers.owner_team_id,
          team_env_schema: mcpServers.team_env_schema,
          team_args_schema: mcpServers.team_args_schema,
        })
        .from(mcpServerInstallations)
        .innerJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(
          and(
            eq(mcpServerInstallations.id, installationId),
            eq(mcpServerInstallations.team_id, teamId)
          )
        )
        .limit(1);

      if (installationRows.length === 0) {
        const errorResponse: ErrorResponse = { success: false, error: 'Installation not found' };
        return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
      }

      const row = installationRows[0];

      // Guard: only GitHub-deployed servers
      if (row.source !== 'github') {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Config schema modification is only allowed for GitHub-deployed servers'
        };
        return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
      }

      // Guard: team must own this GitHub server (prevents cross-team schema tampering)
      if (row.owner_team_id !== teamId) {
        request.log.warn({
          operation: 'update_config_schema',
          teamId,
          installationId,
          serverOwnerId: row.owner_team_id
        }, 'Team attempted to modify config schema of a server they do not own');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Config schema modification is only allowed for servers owned by your team'
        };
        return reply.status(403).type('application/json').send(JSON.stringify(errorResponse));
      }

      const schemaField = config_type === 'env' ? 'team_env_schema' : 'team_args_schema';
      const dataField = config_type === 'env' ? 'team_env' : 'team_args';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentSchema = parseJsonField(row[schemaField] as string | null, []) as any[];
      const currentData = row[dataField];

      if (action === 'add') {
        // Check for duplicate name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (currentSchema.some((s: any) => s.name === item!.name)) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `A ${config_type === 'env' ? 'environment variable' : 'argument'} with name "${item!.name}" already exists`
          };
          return reply.status(409).type('application/json').send(JSON.stringify(errorResponse));
        }

        // Security validation for the value
        if (config_type === 'env' && item!.value) {
          const envValidation = validateEnvVars({ [item!.name]: item!.value });
          if (!envValidation.valid) {
            const errorResponse: ErrorResponse = { success: false, error: envValidation.error! };
            return reply.status(400).type('application/json').send(JSON.stringify(errorResponse));
          }
        }
        if (config_type === 'args' && item!.value) {
          const argsValidation = validateArgs([item!.value]);
          if (!argsValidation.valid) {
            const errorResponse: ErrorResponse = { success: false, error: argsValidation.error! };
            return reply.status(400).type('application/json').send(JSON.stringify(errorResponse));
          }
        }

        // Build new schema entry
        const newSchemaEntry: ConfigSchemaItem = {
          name: item!.name,
          type: item!.type,
          ...(item!.description && { description: item!.description }),
          ...(item!.required !== undefined && { required: item!.required })
        };

        const updatedSchema = [...currentSchema, newSchemaEntry];

        // Update the schema on mcpServers
        await db.update(mcpServers)
          .set({ [schemaField]: JSON.stringify(updatedSchema) })
          .where(eq(mcpServers.id, row.server_id));

        // Update the installation data with the new value
        if (item!.value !== undefined) {
          if (config_type === 'env') {
            // Decrypt existing, add new key, re-encrypt with updated schema
            let existingEnv: Record<string, string> = {};
            if (currentData) {
              existingEnv = await McpEnvStorage.retrieveTeamEnv(
                currentData,
                currentSchema,
                { decryptSecrets: true },
                request.log
              );
            }
            existingEnv[item!.name] = item!.value;
            const encrypted = await McpEnvStorage.storeTeamEnv(existingEnv, updatedSchema, request.log);
            await db.update(mcpServerInstallations)
              .set({ team_env: encrypted, updated_at: new Date() })
              .where(eq(mcpServerInstallations.id, installationId));
          } else {
            // Args: decrypt existing, add new value, re-encrypt with updated schema
            let existingArgs: string[] = [];
            if (currentData) {
              existingArgs = await McpArgsStorage.retrieveTeamArgs(
                currentData,
                currentSchema,
                { decryptSecrets: true },
                request.log
              );
            }
            existingArgs.push(item!.value);
            const encrypted = await McpArgsStorage.storeTeamArgs(existingArgs, updatedSchema, request.log);
            await db.update(mcpServerInstallations)
              .set({ team_args: encrypted, updated_at: new Date() })
              .where(eq(mcpServerInstallations.id, installationId));
          }
        } else {
          // No value provided, just update timestamp
          await db.update(mcpServerInstallations)
            .set({ updated_at: new Date() })
            .where(eq(mcpServerInstallations.id, installationId));
        }

      } else {
        // action === 'remove'
        const removeTarget = item_name!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schemaIndex = currentSchema.findIndex((s: any) => s.name === removeTarget);
        if (schemaIndex === -1) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `Config item "${removeTarget}" not found in schema`
          };
          return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
        }

        const updatedSchema = currentSchema.filter((_: unknown, i: number) => i !== schemaIndex);

        // Update the schema on mcpServers
        await db.update(mcpServers)
          .set({ [schemaField]: JSON.stringify(updatedSchema) })
          .where(eq(mcpServers.id, row.server_id));

        // Remove the value from installation data
        if (config_type === 'env') {
          if (currentData) {
            const existingEnv = await McpEnvStorage.retrieveTeamEnv(
              currentData,
              currentSchema,
              { decryptSecrets: true },
              request.log
            );
            delete existingEnv[removeTarget];
            if (Object.keys(existingEnv).length > 0) {
              const encrypted = await McpEnvStorage.storeTeamEnv(existingEnv, updatedSchema, request.log);
              await db.update(mcpServerInstallations)
                .set({ team_env: encrypted, updated_at: new Date() })
                .where(eq(mcpServerInstallations.id, installationId));
            } else {
              await db.update(mcpServerInstallations)
                .set({ team_env: null, updated_at: new Date() })
                .where(eq(mcpServerInstallations.id, installationId));
            }
          }
        } else {
          // Args: rebuild without the removed index
          if (currentData) {
            const existingArgs = await McpArgsStorage.retrieveTeamArgs(
              currentData,
              currentSchema,
              { decryptSecrets: true },
              request.log
            );
            existingArgs.splice(schemaIndex, 1);
            if (existingArgs.length > 0) {
              const encrypted = await McpArgsStorage.storeTeamArgs(existingArgs, updatedSchema, request.log);
              await db.update(mcpServerInstallations)
                .set({ team_args: encrypted, updated_at: new Date() })
                .where(eq(mcpServerInstallations.id, installationId));
            } else {
              await db.update(mcpServerInstallations)
                .set({ team_args: null, updated_at: new Date() })
                .where(eq(mcpServerInstallations.id, installationId));
            }
          }
        }
      }

      // Set status to 'restarting' for instances
      await db.update(mcpServerInstances)
        .set({
          status: 'restarting',
          status_message: 'Configuration schema updated, server restarting...',
          status_updated_at: new Date()
        })
        .where(
          and(
            eq(mcpServerInstances.installation_id, installationId),
            sql`${mcpServerInstances.status} != 'awaiting_user_config'`
          )
        );

      // Notify satellite for restart
      try {
        const satelliteCommandService = new SatelliteCommandService(db, request.log);
        const commands = await satelliteCommandService.notifyMcpUpdate(
          installationId,
          teamId,
          userId
        );

        request.log.info({
          operation: 'update_config_schema',
          installationId,
          commandsCreated: commands.length
        }, 'Satellite commands created for config schema update');
      } catch (commandError) {
        request.log.error(commandError, `Failed to create satellite commands for config schema update ${installationId}:`);
      }

      // Emit event
      try {
        const eventContext: EventContext = {
          db,
          logger: request.log,
          user: {
            id: userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'unknown'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_INSTALLATION_UPDATED,
          {
            installation: {
              id: installationId,
              serverId: row.server_id,
              teamId
            },
            updatedBy: {
              id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            changes: { action, config_type, item_name: item?.name || item_name },
            metadata: { ip: request.ip }
          },
          eventContext
        );
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit event for config schema update ${installationId}:`);
      }

      // Fetch updated installation for response
      const installationService = new McpInstallationService(db, request.log);
      const updatedInstallation = await installationService.getInstallationById(installationId, teamId);

      if (!updatedInstallation) {
        const errorResponse: ErrorResponse = { success: false, error: 'Failed to fetch updated installation' };
        return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
      }

      const successResponse: InstallationUpdateSuccessResponse = {
        success: true,
        data: formatInstallationResponse(updatedInstallation as InstallationData),
        message: `Config ${action === 'add' ? 'item added' : 'item removed'} successfully`
      };
      return reply.status(200).type('application/json').send(JSON.stringify(successResponse));

    } catch (error) {
      request.log.error({
        operation: 'update_config_schema',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to update config schema');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorResponse: ErrorResponse = { success: false, error: errorMessage };
      return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
    }
  });
}
