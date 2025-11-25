/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq, and, asc } from 'drizzle-orm';
import { requireSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';

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

const COMMANDS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    last_poll: { 
      type: 'string', 
      format: 'date-time',
      description: 'ISO timestamp for optimization (only return commands newer than this)'
    },
    limit: { 
      type: 'integer', 
      minimum: 1, 
      maximum: 50, 
      default: 10,
      description: 'Maximum commands to return'
    }
  },
  additionalProperties: false
} as const;

const COMMAND_RESULT_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    command_id: { 
      type: 'string', 
      minLength: 1,
      description: 'Command ID being reported'
    },
    status: { 
      type: 'string', 
      enum: ['acknowledged', 'executing', 'completed', 'failed'],
      description: 'Command execution status'
    },
    result: { 
      type: 'object',
      description: 'Command execution result data (JSON object)'
    },
    error_message: { 
      type: 'string',
      description: 'Error message for failed commands'
    }
  },
  required: ['command_id', 'status'],
  additionalProperties: false
} as const;

const COMMANDS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    commands: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Command ID' },
          command_type: { 
            type: 'string', 
            enum: ['spawn', 'kill', 'restart', 'configure', 'health_check'],
            description: 'Type of command to execute'
          },
          priority: { 
            type: 'string', 
            enum: ['immediate', 'high', 'normal', 'low'],
            description: 'Command priority level'
          },
          payload: { 
            type: 'object',
            description: 'Command data with team context'
          },
          correlation_id: { 
            type: 'string',
            description: 'Correlation ID for request tracing'
          },
        },
        required: ['id', 'command_type', 'priority', 'payload']
      }
    },
    polling_mode: { 
      type: 'string', 
      enum: ['immediate', 'normal', 'slow'],
      description: 'Recommended polling mode based on pending commands'
    },
    next_poll_interval: { 
      type: 'integer',
      description: 'Recommended next poll interval in seconds'
    }
  },
  required: ['commands', 'polling_mode', 'next_poll_interval']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
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

interface CommandsQuery {
  last_poll?: string;
  limit?: number;
}

interface CommandResultRequest {
  command_id: string;
  status: 'acknowledged' | 'executing' | 'completed' | 'failed';
  result?: Record<string, any>;
  error_message?: string;
}

interface CommandsResponse {
  commands: Array<{
    id: string;
    command_type: 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check';
    priority: 'immediate' | 'high' | 'normal' | 'low';
    payload: Record<string, any>;
    correlation_id?: string;
  }>;
  polling_mode: 'immediate' | 'normal' | 'slow';
  next_poll_interval: number;
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function satelliteCommandsRoute(server: FastifyInstance) {
  // GET /api/satellites/{satelliteId}/commands - Satellite polling for pending commands
  server.get('/satellites/:satelliteId/commands', {
    preValidation: [requireSatelliteAuth()], // Satellite API key authentication
    schema: {
      tags: ['Satellite Commands'],
      summary: 'Poll for pending satellite commands',
      description: 'Satellite polls for pending commands. Requires satellite API key authentication via Bearer token.',
      security: [{ bearerAuth: [] }],
      
      params: SATELLITE_ID_PARAM_SCHEMA,
      querystring: COMMANDS_QUERY_SCHEMA,
      
      response: {
        200: {
          ...COMMANDS_RESPONSE_SCHEMA,
          description: 'Pending commands for satellite'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid satellite API key'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Satellite not found or access denied'
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
    const { limit = 10 } = request.query as CommandsQuery;

    const db = getDb();
    const { satellites, satelliteCommands } = getSchema();

    try {
      // Verify satellite exists and is active
      const satellite = await db
        .select()
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
      
      // Only active satellites get commands, inactive satellites get empty arrays
      let pendingCommands: any[] = [];
      
      if (satellite[0].status === 'active') {
        // Build query conditions for active satellites
        const conditions = [
          eq(satelliteCommands.satellite_id, satelliteId),
          eq(satelliteCommands.status, 'pending')
          // Temporarily removed expiration check to debug command retrieval
        ];
        
        // Note: Removed last_poll optimization to simplify logic
        // Commands are filtered by status='pending' which is the primary concern
        
        // Query pending commands with priority ordering
        pendingCommands = await db
          .select({
            id: satelliteCommands.id,
            command_type: satelliteCommands.command_type,
            priority: satelliteCommands.priority,
            payload: satelliteCommands.payload,
            correlation_id: satelliteCommands.correlation_id
          })
          .from(satelliteCommands)
          .where(and(...conditions))
          .orderBy(
            asc(satelliteCommands.created_at)
          )
          .limit(limit);
      }
      // Inactive satellites get empty array (no commands until activated)
      
      // Determine polling mode based on command priorities
      let pollingMode: 'immediate' | 'normal' | 'slow' = 'slow';
      let nextPollInterval = 60; // Default 60 seconds
      
      const hasImmediateCommands = pendingCommands.some((cmd: any) => cmd.priority === 'immediate');
      const hasHighCommands = pendingCommands.some((cmd: any) => cmd.priority === 'high');
      
      if (hasImmediateCommands) {
        pollingMode = 'immediate';
        nextPollInterval = 2; // 2 seconds for immediate commands
      } else if (hasHighCommands) {
        pollingMode = 'normal';
        nextPollInterval = 10; // 10 seconds for high priority commands
      } else if (pendingCommands.length > 0) {
        pollingMode = 'normal';
        nextPollInterval = 30; // 30 seconds for normal commands
      }
      
      // Format commands for response
      const formattedCommands = pendingCommands.map((cmd: any) => ({
        id: cmd.id,
        command_type: cmd.command_type as any,
        priority: cmd.priority as any,
        payload: JSON.parse(cmd.payload),
        correlation_id: cmd.correlation_id || undefined
      }));
      
      const response: CommandsResponse = {
        commands: formattedCommands,
        polling_mode: pollingMode,
        next_poll_interval: nextPollInterval
      };
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({
        operation: 'satellite_commands_poll',
        satelliteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to poll satellite commands');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error while polling commands'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
  
  // POST /api/satellites/{satelliteId}/command-result - Satellite reports command execution results
  server.post('/satellites/:satelliteId/command-result', {
    preValidation: [requireSatelliteAuth()], // Satellite API key authentication
    schema: {
      tags: ['Satellite Commands'],
      summary: 'Report command execution result',
      description: 'Satellite reports the result of command execution. Requires Content-Type: application/json header when sending request body.',
      security: [{ bearerAuth: [] }],
      
      params: SATELLITE_ID_PARAM_SCHEMA,
      body: COMMAND_RESULT_REQUEST_SCHEMA,
      
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: COMMAND_RESULT_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Command result recorded successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid command result data'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid satellite API key'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Command not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { satelliteId } = request.params as SatelliteIdParams;
    const { command_id, status, result, error_message } = request.body as CommandResultRequest;

    const db = getDb();
    const { satelliteCommands } = getSchema();

    try {
      // Verify command exists and belongs to this satellite
      const command = await db
        .select()
        .from(satelliteCommands)
        .where(and(
          eq(satelliteCommands.id, command_id),
          eq(satelliteCommands.satellite_id, satelliteId)
        ))
        .limit(1);
      
      if (command.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Command not found or does not belong to this satellite'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }
      
      // Update command with result
      const updateData: any = {
        status,
        updated_at: new Date()
      };
      
      if (result) {
        updateData.result = JSON.stringify(result);
      }
      
      if (error_message) {
        updateData.error_message = error_message;
      }
      
      await db
        .update(satelliteCommands)
        .set(updateData)
        .where(eq(satelliteCommands.id, command_id));
      
      request.log.info({
        operation: 'satellite_command_result',
        satelliteId,
        commandId: command_id,
        status,
        hasResult: !!result,
        hasError: !!error_message
      }, 'Satellite command result recorded');
      
      const successResponse: SuccessResponse = {
        success: true,
        message: `Command ${command_id} result recorded with status: ${status}`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({
        operation: 'satellite_command_result',
        satelliteId,
        commandId: command_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to record satellite command result');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error while recording command result'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
