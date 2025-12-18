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
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tool_id: {
            type: 'string',
            minLength: 1,
            description: 'Tool metadata unique identifier'
          },
          is_disabled: {
            type: 'boolean',
            description: 'Whether to disable (true) or enable (false) the tool'
          }
        },
        required: ['tool_id', 'is_disabled'],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 100,
      description: 'Array of tools to toggle (max 100 items)'
    }
  },
  required: ['tools'],
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
        total_requested: { type: 'number', description: 'Total number of tools requested' },
        total_succeeded: { type: 'number', description: 'Number of successfully updated tools' },
        total_failed: { type: 'number', description: 'Number of failed tool updates' },
        total_skipped: { type: 'number', description: 'Number of tools skipped (already in requested state)' },
        command_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of satellite command IDs for tracking (one per successfully updated tool)'
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool_id: { type: 'string', description: 'Tool metadata unique identifier' },
              tool_name: { type: 'string', description: 'Name of the tool' },
              is_disabled: { type: 'boolean', description: 'Current disabled status' },
              status: {
                type: 'string',
                enum: ['success', 'failed', 'skipped'],
                description: 'Result status for this tool'
              },
              message: { type: 'string', description: 'Status message' }
            },
            required: ['tool_id', 'status', 'message']
          },
          description: 'Detailed results for each tool'
        }
      },
      required: ['total_requested', 'total_succeeded', 'total_failed', 'total_skipped', 'results']
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

interface ToolToggleRequest {
  tool_id: string;
  is_disabled: boolean;
}

interface RequestBody {
  tools: ToolToggleRequest[];
}

interface ToolResult {
  tool_id: string;
  tool_name?: string;
  is_disabled?: boolean;
  status: 'success' | 'failed' | 'skipped';
  message: string;
}

interface SuccessResponse {
  success: boolean;
  data: {
    total_requested: number;
    total_succeeded: number;
    total_failed: number;
    total_skipped: number;
    command_ids?: string[];
    results: ToolResult[];
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// =============================================================================
// ROUTE SCHEMA
// =============================================================================

const batchToggleToolsRouteSchema = {
  tags: ['MCP Tools'],
  summary: 'Batch toggle tool disabled status',
  description: 'Enable or disable multiple MCP tools for a specific installation in a single request. Returns detailed results for each tool. Requires mcp.tools.manage permission (team_admin or global_admin). Requires Content-Type: application/json header when sending request body.',
  security: [{ cookieAuth: [] }],

  params: PARAMS_SCHEMA,
  body: BODY_SCHEMA,

  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: BODY_SCHEMA
      }
    }
  },

  response: {
    200: {
      ...SUCCESS_RESPONSE_SCHEMA,
      description: 'All tools processed successfully (including skipped)'
    },
    207: {
      ...SUCCESS_RESPONSE_SCHEMA,
      description: 'Multi-Status - Some tools succeeded, some failed'
    },
    400: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - All tools failed or validation error'
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
      description: 'Not Found - Installation does not exist'
    },
    500: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Internal Server Error'
    }
  }
};

// =============================================================================
// ROUTE IMPLEMENTATION
// =============================================================================

export default async function batchToggleToolsRoute(server: FastifyInstance) {
  server.patch<{
    Params: RouteParams;
    Body: RequestBody;
  }>('/teams/:teamId/mcp/installations/:installationId/tools', {
    preValidation: requireTeamPermission('mcp.tools.manage'),
    schema: batchToggleToolsRouteSchema
  }, async (request, reply) => {
    const { teamId, installationId } = request.params as RouteParams;
    const { tools } = request.body as RequestBody;
    const userId = request.user!.id;

    request.log.info({
      operation: 'batch_toggle_tool_status',
      teamId,
      installationId,
      toolCount: tools.length,
      userId
    }, 'Batch toggling tool disabled status');

    try {
      const db = getDb();
      const { mcpToolMetadata, mcpServerInstallations, satellites, satelliteCommands, mcpServers } = getSchema();

      // Step 1: Get server slug for satellite command (shared by all tools)
      const installationResult = await db
        .select({
          server_slug: mcpServers.slug
        })
        .from(mcpServerInstallations)
        .leftJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(eq(mcpServerInstallations.id, installationId))
        .limit(1);

      if (!installationResult || installationResult.length === 0) {
        request.log.warn({
          operation: 'batch_toggle_tool_status',
          teamId,
          installationId,
          userId
        }, 'Installation not found');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found'
        };
        return reply.status(404).type('application/json').send(JSON.stringify(errorResponse));
      }

      const serverSlug = installationResult[0]?.server_slug || 'unknown';

      // Step 2: Process each tool
      const results: ToolResult[] = [];
      const successfulUpdates: Array<{ tool_name: string; is_disabled: boolean }> = [];

      for (const { tool_id, is_disabled } of tools) {
        try {
          // Verify tool exists and belongs to the team/installation
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
                eq(mcpToolMetadata.id, tool_id),
                eq(mcpToolMetadata.installation_id, installationId),
                eq(mcpToolMetadata.team_id, teamId)
              )
            )
            .limit(1);

          if (!toolResult || toolResult.length === 0) {
            results.push({
              tool_id,
              status: 'failed',
              message: 'Tool not found or access denied'
            });
            continue;
          }

          const tool = toolResult[0];

          // Check if tool is already in the requested state
          if (tool.is_disabled === is_disabled) {
            const action = is_disabled ? 'disabled' : 'enabled';
            results.push({
              tool_id,
              tool_name: tool.tool_name,
              is_disabled: tool.is_disabled,
              status: 'skipped',
              message: `Tool already ${action}`
            });
            continue;
          }

          // Update the tool status in database
          await db
            .update(mcpToolMetadata)
            .set({
              is_disabled,
              updated_at: new Date()
            })
            .where(eq(mcpToolMetadata.id, tool_id));

          // Track successful update for satellite command
          successfulUpdates.push({
            tool_name: tool.tool_name,
            is_disabled
          });

          const action = is_disabled ? 'disabled' : 'enabled';
          results.push({
            tool_id,
            tool_name: tool.tool_name,
            is_disabled,
            status: 'success',
            message: `Tool ${action} successfully`
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            tool_id,
            status: 'failed',
            message: errorMessage
          });
        }
      }

      // Step 3: Create individual satellite commands for each successful update
      const commandIds: string[] = [];

      if (successfulUpdates.length > 0) {
        // Find active satellite (prefer team satellite over global)
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

        if (activeSatellites.length > 0) {
          const targetSatellite = activeSatellites.find(s => s.satellite_type === 'team') || activeSatellites[0];

          // Create individual command for each tool (reusing existing update_tool_status action)
          for (const { tool_name, is_disabled } of successfulUpdates) {
            const commandId = nanoid();
            commandIds.push(commandId);

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
                tool_name,
                is_disabled
              }),
              status: 'pending',
              target_team_id: teamId,
              correlation_id: nanoid(),
              created_by: userId,
              created_at: new Date(),
              updated_at: new Date()
            });
          }

          request.log.info({
            operation: 'batch_toggle_tool_status',
            teamId,
            installationId,
            toolCount: successfulUpdates.length,
            commandCount: commandIds.length,
            satelliteId: targetSatellite.id,
            userId
          }, 'Individual satellite commands created for batch operation');
        } else {
          request.log.warn({
            operation: 'batch_toggle_tool_status',
            teamId,
            installationId,
            userId
          }, 'No active satellite found - tool statuses updated in database only');
        }
      }

      // Step 4: Calculate statistics and determine HTTP status code
      const totalRequested = tools.length;
      const totalSucceeded = results.filter(r => r.status === 'success').length;
      const totalFailed = results.filter(r => r.status === 'failed').length;
      const totalSkipped = results.filter(r => r.status === 'skipped').length;

      let statusCode = 200;
      if (totalSucceeded === 0 && totalFailed > 0) {
        statusCode = 400; // All failed
      } else if (totalSucceeded > 0 && totalFailed > 0) {
        statusCode = 207; // Partial success (Multi-Status)
      }

      request.log.info({
        operation: 'batch_toggle_tool_status',
        teamId,
        installationId,
        totalRequested,
        totalSucceeded,
        totalFailed,
        totalSkipped,
        statusCode,
        userId
      }, 'Batch toggle completed');

      const successResponse: SuccessResponse = {
        success: statusCode !== 400,
        data: {
          total_requested: totalRequested,
          total_succeeded: totalSucceeded,
          total_failed: totalFailed,
          total_skipped: totalSkipped,
          command_ids: commandIds.length > 0 ? commandIds : undefined,
          results
        }
      };
      return reply.status(statusCode).type('application/json').send(JSON.stringify(successResponse));

    } catch (error) {
      request.log.error({
        operation: 'batch_toggle_tool_status',
        error,
        teamId,
        installationId,
        userId
      }, 'Failed to batch toggle tool status');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const errorResponse: ErrorResponse = {
        success: false,
        error: errorMessage
      };
      return reply.status(500).type('application/json').send(JSON.stringify(errorResponse));
    }
  });
}
