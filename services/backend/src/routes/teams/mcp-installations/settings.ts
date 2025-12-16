import { type FastifyInstance } from 'fastify';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { getDb, getSchema } from '../../../db';
import { eq, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID that owns the installation'
    },
    installationId: {
      type: 'string',
      minLength: 1,
      description: 'Installation ID'
    }
  },
  required: ['teamId', 'installationId'],
  additionalProperties: false
} as const;

const BODY_SCHEMA = {
  type: 'object',
  properties: {
    request_logging_enabled: {
      type: 'boolean',
      description: 'Whether to enable request/response logging for this installation'
    }
  },
  additionalProperties: false
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          description: 'Updated installation settings'
        },
        command_id: { type: 'string', description: 'Satellite command ID for tracking (if satellite available)' },
        message: { type: 'string', description: 'Human-readable status message' }
      },
      required: ['settings', 'message']
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false, description: 'Indicates failure' },
    error: { type: 'string', description: 'Error message detailing what went wrong' }
  },
  required: ['success', 'error']
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

interface RouteParams {
  teamId: string;
  installationId: string;
}

interface RequestBody {
  request_logging_enabled?: boolean;
}

interface SuccessResponse {
  success: boolean;
  data: {
    settings: Record<string, unknown>;
    command_id?: string;
    message: string;
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function updateInstallationSettingsRoute(server: FastifyInstance) {
  server.patch<{
    Params: RouteParams;
    Body: RequestBody;
  }>('/teams/:teamId/mcp/installations/:installationId/settings', {
    preValidation: requireTeamPermission('mcp.installations.edit'),
    schema: {
      tags: ['MCP Installations'],
      summary: 'Update installation settings',
      description: 'Update generic settings for an MCP server installation. Settings are merged with existing values. Currently supports: request_logging_enabled (boolean). Requires mcp.installations.edit permission (team_admin or global_admin). Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],

      params: PARAMS_SCHEMA,
      body: BODY_SCHEMA,

      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Installation settings updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid settings provided'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or not a team member'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Installation does not exist or not owned by team'
        },
        503: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Service Unavailable - No active satellite available'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { teamId, installationId } = request.params;
    const settingsUpdate = request.body;
    const userId = request.user!.id;

    request.log.info({
      operation: 'update_installation_settings',
      teamId,
      installationId,
      userId,
      settingsUpdate
    }, 'Updating installation settings');

    // Validate that at least one setting is provided
    if (Object.keys(settingsUpdate).length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'At least one setting must be provided'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }

    try {
      const db = getDb();
      const schema = getSchema();

      // Get installation and verify ownership
      const installations = await db
        .select()
        .from(schema.mcpServerInstallations)
        .where(
          and(
            eq(schema.mcpServerInstallations.id, installationId),
            eq(schema.mcpServerInstallations.team_id, teamId)
          )
        )
        .leftJoin(schema.mcpServers, eq(schema.mcpServerInstallations.server_id, schema.mcpServers.id))
        .limit(1);

      const installation = installations[0];

      if (!installation || !installation.mcpServerInstallations) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found or does not belong to specified team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const installationData = installation.mcpServerInstallations;
      const serverData = installation.mcpServers;

      // Parse existing settings (JSONB column)
      const currentSettings = (installationData.settings as Record<string, unknown>) || {};

      // Merge with new settings
      const updatedSettings = {
        ...currentSettings,
        ...settingsUpdate
      };

      // Update database
      await db.update(schema.mcpServerInstallations)
        .set({
          settings: updatedSettings,
          updated_at: new Date()
        })
        .where(eq(schema.mcpServerInstallations.id, installationId));

      request.log.info({
        operation: 'update_installation_settings_success',
        installationId,
        teamId
      }, 'Installation settings updated in database');

      // Try to send configure command to satellite (if available)
      let commandId: string | undefined;

      const activeSatellites = await db
        .select()
        .from(schema.satellites)
        .where(
          and(
            eq(schema.satellites.status, 'active'),
            or(
              eq(schema.satellites.satellite_type, 'global'),
              and(
                eq(schema.satellites.satellite_type, 'team'),
                eq(schema.satellites.team_id, teamId)
              )
            )
          )
        );

      if (activeSatellites.length > 0) {
        // Prefer team satellite over global
        const targetSatellite = activeSatellites.find((s) => s.satellite_type === 'team') || activeSatellites[0];

        commandId = nanoid();

        await db.insert(schema.satelliteCommands).values({
          id: commandId,
          satellite_id: targetSatellite.id,
          command_type: 'configure',
          priority: 'immediate',
          payload: JSON.stringify({
            action: 'update_installation_settings',
            installation_id: installationId,
            team_id: teamId,
            server_slug: serverData?.slug || '',
            settings: updatedSettings
          }),
          status: 'pending',
          target_team_id: teamId,
          correlation_id: nanoid(),
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
        });

        request.log.info({
          operation: 'send_configure_command',
          commandId,
          satelliteId: targetSatellite.id,
          installationId
        }, 'Configure command sent to satellite');
      } else {
        request.log.warn({
          operation: 'no_active_satellite',
          installationId,
          teamId
        }, 'No active satellite available - settings saved to database only');
      }

      const successResponse: SuccessResponse = {
        success: true,
        data: {
          settings: updatedSettings,
          command_id: commandId,
          message: commandId
            ? 'Settings updated and satellite notified'
            : 'Settings updated (no active satellite available - will sync on next connection)'
        }
      };

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'update_installation_settings_failed',
        installationId,
        teamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update installation settings');

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update installation settings'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
