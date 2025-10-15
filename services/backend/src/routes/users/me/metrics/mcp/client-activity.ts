import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/roleMiddleware';
import { getDb } from '../../db';
import { McpClientActivityMetricsService } from '../../services/metrics/McpClientActivityMetricsService';

const QUERY_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID to filter metrics'
    },
    time_range: {
      type: 'string',
      enum: ['1h', '3h', '6h', '12h', '24h', '7d', '30d'],
      description: 'Time range for metrics (e.g., 3h, 24h, 7d)'
    },
    interval: {
      type: 'string',
      enum: ['15m', '1h'],
      description: 'Bucket interval for aggregation'
    },
    satellite_id: {
      type: 'string',
      description: 'Optional satellite ID to filter metrics'
    },
    auth_identifier: {
      type: 'string',
      description: 'Optional auth identifier to filter metrics'
    }
  },
  required: ['team_id'],
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      type: 'object',
      properties: {
        metric_type: {
          type: 'string',
          description: 'Type of metric returned'
        },
        time_range: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              format: 'date-time',
              description: 'Start of time range (ISO 8601)'
            },
            end: {
              type: 'string',
              format: 'date-time',
              description: 'End of time range (ISO 8601)'
            },
            interval: {
              type: 'string',
              description: 'Bucket interval used'
            }
          },
          required: ['start', 'end', 'interval']
        },
        filters: {
          type: 'object',
          description: 'Applied filters',
          additionalProperties: true
        },
        buckets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Bucket timestamp (ISO 8601)'
              },
              request_count: {
                type: 'number',
                description: 'Number of requests in bucket'
              },
              tool_call_count: {
                type: 'number',
                description: 'Number of tool calls in bucket'
              },
              active_client_count: {
                type: 'number',
                description: 'Number of active clients in bucket'
              }
            },
            required: ['timestamp', 'request_count', 'tool_call_count', 'active_client_count']
          },
          description: 'Time-series buckets with metrics'
        },
        summary: {
          type: 'object',
          description: 'Summary statistics across all buckets',
          additionalProperties: true
        }
      },
      required: ['metric_type', 'time_range', 'filters', 'buckets', 'summary']
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates failure'
    },
    error: {
      type: 'string',
      description: 'Error message detailing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

interface QueryParams {
  team_id: string;
  time_range?: string;
  interval?: string;
  satellite_id?: string;
  auth_identifier?: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function mcpClientActivityMetricsRoute(server: FastifyInstance) {
  server.get('/mcp-client-activity', {
    preValidation: requirePermission('metrics.mcp_client_activity_metrics.view'),
    schema: {
      tags: ['Metrics'],
      summary: 'Get MCP client activity metrics',
      description: 'Returns time-series metrics for MCP client activity including request counts, tool calls, and active clients over time. Supports multiple time ranges and bucket intervals for detailed activity analysis.',
      security: [{ cookieAuth: [] }],
      
      querystring: QUERY_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Successful operation - metrics returned'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid query parameters'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as QueryParams;
      const userId = request.user!.id;
      
      const timeRange = query.time_range || '3h';
      const interval = query.interval || '15m';

      const db = getDb();
      const metricsService = new McpClientActivityMetricsService(db, server.log);

      const result = await metricsService.getMetrics(
        userId,
        query.team_id,
        timeRange,
        interval,
        query.satellite_id,
        query.auth_identifier
      );

      const jsonString = JSON.stringify(result);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        operation: 'get_mcp_client_activity_metrics',
        error: error instanceof Error ? error.message : String(error),
        userId: request.user?.id,
        query: request.query
      }, 'Failed to get MCP client activity metrics');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
