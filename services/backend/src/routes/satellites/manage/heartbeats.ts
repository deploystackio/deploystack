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
      description: 'Maximum number of heartbeats to return (1-100, default: 20)'
    },
    offset: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Number of heartbeats to skip (≥0, default: 0)'
    }
  },
  additionalProperties: false
} as const;

const HEARTBEAT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    satellite_id: { type: 'string' },
    status: { type: 'string', enum: ['active', 'degraded', 'error'] },
    system_metrics: { type: 'string' },
    process_count: { type: 'number' },
    healthy_process_count: { type: 'number' },
    error_count: { type: 'number' },
    response_time_ms: { type: ['number', 'null'] },
    uptime_seconds: { type: ['number', 'null'] },
    version: { type: ['string', 'null'] },
    timestamp: { type: 'string' }
  },
  required: ['id', 'satellite_id', 'status', 'system_metrics', 'process_count',
             'healthy_process_count', 'error_count', 'timestamp']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        heartbeats: {
          type: 'array',
          items: HEARTBEAT_SCHEMA
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
      required: ['heartbeats', 'pagination']
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

interface Heartbeat {
  id: string;
  satellite_id: string;
  status: 'active' | 'degraded' | 'error';
  system_metrics: string;
  process_count: number;
  healthy_process_count: number;
  error_count: number;
  response_time_ms: number | null;
  uptime_seconds: number | null;
  version: string | null;
  timestamp: string;
}

interface SuccessResponse {
  success: boolean;
  data: {
    heartbeats: Heartbeat[];
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

export default async function listSatelliteHeartbeatsRoute(server: FastifyInstance) {
  server.get<{ Params: SatelliteIdParams; Querystring: QueryParams }>(
    '/satellites/manage/:satelliteId/heartbeats',
    {
      preValidation: requirePermission('satellites.view.heartbeat'),
      schema: {
        tags: ['Satellite Management'],
        summary: 'List satellite heartbeats',
        description: 'Retrieve paginated list of satellite heartbeat records. Returns latest heartbeats first. Requires global_admin role.',
        security: [{ cookieAuth: [] }],

        params: SATELLITE_ID_PARAM_SCHEMA,
        querystring: QUERY_SCHEMA,

        response: {
          200: {
            ...SUCCESS_RESPONSE_SCHEMA,
            description: 'Heartbeats retrieved successfully'
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
          operation: 'list_satellite_heartbeats',
          userId: request.user?.id,
          satelliteId,
          pagination: { limit, offset }
        }, 'Listing satellite heartbeats');

        const db = getDb();
        const { satellites, satelliteHeartbeats } = getSchema();

        // Check if satellite exists
        const existingSatellite = await db
          .select({ id: satellites.id })
          .from(satellites)
          .where(eq(satellites.id, satelliteId))
          .limit(1);

        if (existingSatellite.length === 0) {
          request.log.warn({
            operation: 'list_satellite_heartbeats',
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

        // Get total count and heartbeats in parallel
        const [totalResult, heartbeats] = await Promise.all([
          // Count query
          db
            .select({ count: count() })
            .from(satelliteHeartbeats)
            .where(eq(satelliteHeartbeats.satellite_id, satelliteId)),

          // Data query with pagination
          db
            .select({
              id: satelliteHeartbeats.id,
              satellite_id: satelliteHeartbeats.satellite_id,
              status: satelliteHeartbeats.status,
              system_metrics: satelliteHeartbeats.system_metrics,
              process_count: satelliteHeartbeats.process_count,
              healthy_process_count: satelliteHeartbeats.healthy_process_count,
              error_count: satelliteHeartbeats.error_count,
              response_time_ms: satelliteHeartbeats.response_time_ms,
              uptime_seconds: satelliteHeartbeats.uptime_seconds,
              version: satelliteHeartbeats.version,
              timestamp: satelliteHeartbeats.timestamp
            })
            .from(satelliteHeartbeats)
            .where(eq(satelliteHeartbeats.satellite_id, satelliteId))
            .orderBy(desc(satelliteHeartbeats.timestamp))
            .limit(limit)
            .offset(offset)
        ]);

        const total = totalResult[0]?.count || 0;

        // Format response
        const formattedHeartbeats: Heartbeat[] = heartbeats.map(hb => ({
          id: hb.id,
          satellite_id: hb.satellite_id,
          status: hb.status,
          system_metrics: hb.system_metrics,
          process_count: hb.process_count,
          healthy_process_count: hb.healthy_process_count,
          error_count: hb.error_count,
          response_time_ms: hb.response_time_ms,
          uptime_seconds: hb.uptime_seconds,
          version: hb.version,
          timestamp: hb.timestamp.toISOString()
        }));

        request.log.info({
          operation: 'list_satellite_heartbeats',
          userId: request.user?.id,
          satelliteId,
          totalResults: total,
          returnedResults: formattedHeartbeats.length,
          pagination: { limit, offset }
        }, 'Satellite heartbeats list completed');

        const successResponse: SuccessResponse = {
          success: true,
          data: {
            heartbeats: formattedHeartbeats,
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
          operation: 'list_satellite_heartbeats',
          userId: request.user?.id,
          satelliteId: request.params?.satelliteId,
          error
        }, `Error listing satellite heartbeats: ${error instanceof Error ? error.message : 'Unknown error'}`);

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to retrieve satellite heartbeats'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
