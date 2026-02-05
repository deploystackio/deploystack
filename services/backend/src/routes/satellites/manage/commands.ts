import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { eq, desc, count } from 'drizzle-orm';
import { getDb, getSchema } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';

// Reusable schema constants
const SATELLITE_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    satelliteId: {
      type: 'string',
      minLength: 1,
      description: 'Satellite ID is required'
    }
  },
  required: ['satelliteId'],
  additionalProperties: false
} as const;

const QUERY_SCHEMA = {
  type: 'object',
  properties: {
    limit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum number of commands to return (1-100, default: 20)'
    },
    offset: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Number of commands to skip (≥0, default: 0)'
    }
  },
  additionalProperties: false
} as const;

const COMMAND_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    satellite_id: { type: 'string' },
    command_type: {
      type: 'string',
      enum: ['spawn', 'kill', 'restart', 'configure', 'health_check', 'invalidate_user_token_cache']
    },
    priority: { type: 'string', enum: ['immediate', 'high', 'normal', 'low'] },
    payload: { type: 'string' },
    status: {
      type: 'string',
      enum: ['pending', 'acknowledged', 'executing', 'completed', 'failed']
    },
    target_team_id: { type: ['string', 'null'] },
    correlation_id: { type: ['string', 'null'] },
    retry_count: { type: 'number' },
    max_retries: { type: 'number' },
    error_message: { type: ['string', 'null'] },
    result: { type: ['string', 'null'] },
    created_by: { type: ['string', 'null'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  },
  required: ['id', 'satellite_id', 'command_type', 'priority', 'payload', 'status',
             'retry_count', 'max_retries', 'created_at', 'updated_at']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        commands: {
          type: 'array',
          items: COMMAND_SCHEMA
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' },
            has_more: { type: 'boolean' }
          },
          required: ['total', 'limit', 'offset', 'has_more']
        }
      },
      required: ['commands', 'pagination']
    }
  },
  required: ['success', 'data']
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

interface QueryParams {
  limit?: string;
  offset?: string;
}

interface Command {
  id: string;
  satellite_id: string;
  command_type: 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache';
  priority: 'immediate' | 'high' | 'normal' | 'low';
  payload: string;
  status: 'pending' | 'acknowledged' | 'executing' | 'completed' | 'failed';
  target_team_id: string | null;
  correlation_id: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  result: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SuccessResponse {
  success: boolean;
  data: {
    commands: Command[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// Pagination validation helper
function validatePaginationParams(query: QueryParams): { limit: number; offset: number } {
  const limit = query.limit ? parseInt(query.limit, 10) : 20;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  if (isNaN(offset) || offset < 0) {
    throw new Error('Offset must be non-negative');
  }

  return { limit, offset };
}

export default async function listSatelliteCommandsRoute(server: FastifyInstance) {
  server.get<{ Params: SatelliteIdParams; Querystring: QueryParams }>(
    '/satellites/manage/:satelliteId/commands',
    {
      preValidation: requirePermission('satellites.view.command'),
      schema: {
        tags: ['Satellite Management'],
        summary: 'List satellite commands',
        description: 'Retrieve paginated list of satellite command records. Returns latest commands first. Requires global_admin role.',
        security: [{ cookieAuth: [] }],

        params: SATELLITE_ID_PARAM_SCHEMA,
        querystring: QUERY_SCHEMA,

        response: {
          200: {
            ...SUCCESS_RESPONSE_SCHEMA,
            description: 'Commands retrieved successfully'
          },
          400: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Bad Request - Invalid pagination parameters'
          },
          401: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Unauthorized'
          },
          403: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Forbidden - Insufficient permissions'
          },
          404: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Not Found - Satellite does not exist'
          },
          500: {
            ...ERROR_RESPONSE_SCHEMA,
            description: 'Internal Server Error'
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: SatelliteIdParams; Querystring: QueryParams }>, reply: FastifyReply) => {
      try {
        const { satelliteId } = request.params;
        const query = request.query;

        // Validate pagination parameters
        let limit: number, offset: number;
        try {
          ({ limit, offset } = validatePaginationParams(query));
        } catch (validationError) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: validationError instanceof Error ? validationError.message : 'Invalid pagination parameters'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        request.log.info({
          operation: 'list_satellite_commands',
          userId: request.user?.id,
          satelliteId,
          pagination: { limit, offset }
        }, 'Listing satellite commands');

        const db = getDb();
        const { satellites, satelliteCommands } = getSchema();

        // Check if satellite exists
        const existingSatellite = await db
          .select({ id: satellites.id })
          .from(satellites)
          .where(eq(satellites.id, satelliteId))
          .limit(1);

        if (existingSatellite.length === 0) {
          request.log.warn({
            operation: 'list_satellite_commands',
            userId: request.user?.id,
            satelliteId
          }, 'Satellite not found');

          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Satellite not found'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(404).type('application/json').send(jsonString);
        }

        // Get total count and commands in parallel
        const [totalResult, commands] = await Promise.all([
          // Count query
          db
            .select({ count: count() })
            .from(satelliteCommands)
            .where(eq(satelliteCommands.satellite_id, satelliteId)),

          // Data query with pagination
          db
            .select({
              id: satelliteCommands.id,
              satellite_id: satelliteCommands.satellite_id,
              command_type: satelliteCommands.command_type,
              priority: satelliteCommands.priority,
              payload: satelliteCommands.payload,
              status: satelliteCommands.status,
              target_team_id: satelliteCommands.target_team_id,
              correlation_id: satelliteCommands.correlation_id,
              retry_count: satelliteCommands.retry_count,
              max_retries: satelliteCommands.max_retries,
              error_message: satelliteCommands.error_message,
              result: satelliteCommands.result,
              created_by: satelliteCommands.created_by,
              created_at: satelliteCommands.created_at,
              updated_at: satelliteCommands.updated_at
            })
            .from(satelliteCommands)
            .where(eq(satelliteCommands.satellite_id, satelliteId))
            .orderBy(desc(satelliteCommands.created_at))
            .limit(limit)
            .offset(offset)
        ]);

        const total = totalResult[0]?.count || 0;

        // Format response
        const formattedCommands: Command[] = commands.map(cmd => ({
          id: cmd.id,
          satellite_id: cmd.satellite_id,
          command_type: cmd.command_type,
          priority: cmd.priority,
          payload: cmd.payload,
          status: cmd.status,
          target_team_id: cmd.target_team_id,
          correlation_id: cmd.correlation_id,
          retry_count: cmd.retry_count,
          max_retries: cmd.max_retries,
          error_message: cmd.error_message,
          result: cmd.result,
          created_by: cmd.created_by,
          created_at: cmd.created_at.toISOString(),
          updated_at: cmd.updated_at.toISOString()
        }));

        request.log.info({
          operation: 'list_satellite_commands',
          userId: request.user?.id,
          satelliteId,
          totalResults: total,
          returnedResults: formattedCommands.length,
          pagination: { limit, offset }
        }, 'Satellite commands list completed');

        const successResponse: SuccessResponse = {
          success: true,
          data: {
            commands: formattedCommands,
            pagination: {
              total,
              limit,
              offset,
              has_more: offset + limit < total
            }
          }
        };

        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        request.log.error({
          operation: 'list_satellite_commands',
          userId: request.user?.id,
          satelliteId: request.params?.satelliteId,
          error
        }, `Error listing satellite commands: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to retrieve satellite commands'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
