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
    },
    toolId: {
      type: 'string',
      minLength: 1,
      description: 'Tool metadata ID'
    }
  },
  required: ['teamId', 'installationId', 'toolId'],
  additionalProperties: false
} as const;

const BODY_SCHEMA = {
  type: 'object',
  properties: {
    is_disabled: {
      type: 'boolean',
      description: 'Whether to disable (true) or enable (false) the tool'
    }
  },
  required: ['is_disabled'],
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
        tool_id: { type: 'string', description: 'Tool metadata unique identifier' },
        tool_name: { type: 'string', description: 'Name of the tool' },
        is_disabled: { type: 'boolean', description: 'Current disabled status' },
        command_id: { type: 'string', description: 'Satellite command ID for tracking' },
        message: { type: 'string', description: 'Human-readable status message' }
      },
      required: ['tool_id', 'tool_name', 'is_disabled', 'message']
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
  toolId: string;
}

interface RequestBody {
  is_disabled: boolean;
}

interface SuccessResponse {
  success: boolean;
  data: {
    tool_id: string;
    tool_name: string;
    is_disabled: boolean;
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

export default async function toggleToolRoute(server: FastifyInstance) {
  server.patch<{
    Params: RouteParams;
    Body: RequestBody;
  }>('/teams/:teamId/mcp/installations/:installationId/tools/:toolId', {
    preValidation: requireTeamPermission('mcp.tools.manage'),
    schema: {
      tags: ['MCP Tools'],
      summary: 'Toggle tool disabled status',
      description: 'Enable or disable an MCP tool for a specific installation. When disabled, the satellite will return an LLM-friendly error message. Requires mcp.tools.manage permission (team_admin or global_admin).',
      security: [{ cookieAuth: [] }],

      params: PARAMS_SCHEMA,
      body: BODY_SCHEMA,

      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Tool status updated successfully'
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
          description: 'Not Found - Tool or installation does not exist'
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
    const { teamId, installationId, toolId } = request.params as RouteParams;
    const { is_disabled } = request.body as RequestBody;
    const userId = request.user!.id;

    request.log.info({
      operation: 'toggle_tool_status',
      teamId,
      installationId,
      toolId,
      is_disabled,
      userId
    }, 'Toggling tool disabled status');

    try {
      const db = getDb();
      const { mcpToolMetadata, mcpServerInstallations, satellites, satelliteCommands, mcpServers } = getSchema();

      // Step 1: Verify tool exists and belongs to the team/installation
      const toolResult = await db
        .select({
          id: mcpToolMetadata.id,
          tool_name: mcpToolMetadata.tool_name,
          installation_id: mcpToolMetadata.installation_id,
          team_id: mcpToolMetadata.team_id,
          is_disabled: mcpToolMetadata.is_disabled
        })
        .from(mcpToolMetadata)
        .where(
          and(
            eq(mcpToolMetadata.id, toolId),
            eq(mcpToolMetadata.installation_id, installationId),
            eq(mcpToolMetadata.team_id, teamId)
          )
        )
        .limit(1);

      if (!toolResult || toolResult.length === 0) {
        request.log.warn({
          operation: 'toggle_tool_status',
          teamId,
          installationId,
          toolId,
          userId
        }, 'Tool not found');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Tool not found'
        };
        return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
      }

      const tool = toolResult[0];

      // Step 2: Check if status is already the requested value
      if (tool.is_disabled === is_disabled) {
        const action = is_disabled ? 'disabled' : 'enabled';
        const successResponse: SuccessResponse = {
          success: true,
          data: {
            tool_id: tool.id,
            tool_name: tool.tool_name,
            is_disabled: tool.is_disabled,
            message: `Tool is already ${action}. No changes made.`
          }
        };
        return reply.status(200).type('application/json').send(JSON.stringify(successResponse));
      }

      // Step 3: Get the server slug for the satellite command
      const installationResult = await db
        .select({
          server_slug: mcpServers.slug
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(eq(mcpServerInstallations.id, installationId))
        .limit(1);

      const serverSlug = installationResult[0]?.server_slug || 'unknown';

      // Step 4: Update the tool status in the database
      await db
        .update(mcpToolMetadata)
        .set({
          is_disabled,
          updated_at: new Date()
        })
        .where(eq(mcpToolMetadata.id, toolId));

      // Step 5: Find active satellite(s) to send the command
      // First try team satellite, then fall back to global satellite
      const activeSatellites = await db
        .select({
          id: satellites.id,
          satellite_type: satellites.satellite_type
        })
        .from(satellites)
        .where(
          and(
            eq(satellites.status, 'active'),
            or(
              eq(satellites.satellite_type, 'global'),
              and(
                eq(satellites.satellite_type, 'team'),
                eq(satellites.team_id, teamId)
              )
            )
          )
        );

      let commandId: string | undefined;

      if (activeSatellites.length > 0) {
        // Prefer team satellite over global satellite
        const targetSatellite = activeSatellites.find(s => s.satellite_type === 'team') || activeSatellites[0];
        commandId = nanoid();

        // Step 6: Create satellite command with immediate priority
        await db.insert(satelliteCommands).values({
          id: commandId,
          satellite_id: targetSatellite.id,
          command_type: 'configure',
          priority: 'immediate',
          payload: JSON.stringify({
            action: 'update_tool_status',
            installation_id: installationId,
            team_id: teamId,
            server_slug: serverSlug,
            tool_name: tool.tool_name,
            is_disabled
          }),
          status: 'pending',
          target_team_id: teamId,
          correlation_id: nanoid(),
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
        });

        request.log.info({
          operation: 'toggle_tool_status',
          teamId,
          installationId,
          toolId,
          tool_name: tool.tool_name,
          is_disabled,
          commandId,
          satelliteId: targetSatellite.id,
          userId
        }, 'Tool status updated and satellite command created');
      } else {
        request.log.warn({
          operation: 'toggle_tool_status',
          teamId,
          installationId,
          toolId,
          userId
        }, 'No active satellite found - tool status updated in database only');
      }

      const action = is_disabled ? 'disabled' : 'enabled';
      const syncMessage = commandId
        ? 'Changes saved and sent to satellite.'
        : 'No active satellite available - change saved to database.';

      const successResponse: SuccessResponse = {
        success: true,
        data: {
          tool_id: tool.id,
          tool_name: tool.tool_name,
          is_disabled,
          command_id: commandId,
          message: `Tool ${action}. ${syncMessage}`
        }
      };
      return reply.status(200).type('application/json').send(JSON.stringify(successResponse));

    } catch (error) {
      request.log.error({
        operation: 'toggle_tool_status',
        error,
        teamId,
        installationId,
        toolId,
        userId
      }, 'Failed to toggle tool status');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
    }
  });
}
