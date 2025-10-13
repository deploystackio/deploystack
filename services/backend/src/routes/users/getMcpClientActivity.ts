import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db';
import { mcpClientActivity, satellites } from '../../db/schema.sqlite';
import { eq, and, gt, sql } from 'drizzle-orm';
import { requireAuthenticationAny } from '../../middleware/oauthMiddleware';

// Reusable Schema Constants
const QUERY_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Number of results per page (1-100)'
    },
    offset: {
      type: 'integer',
      minimum: 0,
      default: 0,
      description: 'Pagination offset'
    },
    active_within_minutes: {
      type: 'integer',
      minimum: 1,
      maximum: 1440,
      default: 30,
      description: 'Show clients active within N minutes (1-1440)'
    }
  },
  additionalProperties: false
} as const;

const ACTIVITY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Activity record ID' },
    client_name: { type: ['string', 'null'], description: 'Client name (VS Code, Cursor, etc.)' },
    satellite: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Satellite ID' },
        name: { type: 'string', description: 'Satellite name' }
      },
      required: ['id', 'name']
    },
    last_activity_at: { type: 'string', format: 'date-time', description: 'Last activity timestamp' },
    total_requests: { type: 'integer', description: 'Total request count' },
    total_tool_calls: { type: 'integer', description: 'Total tool call count' },
    user_agent: { type: ['string', 'null'], description: 'Client user agent' },
    first_seen_at: { type: 'string', format: 'date-time', description: 'First seen timestamp' }
  },
  required: ['id', 'client_name', 'satellite', 'last_activity_at', 'total_requests', 'total_tool_calls', 'first_seen_at']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    data: {
      type: 'object',
      properties: {
        activities: {
          type: 'array',
          items: ACTIVITY_ITEM_SCHEMA
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer', description: 'Total number of activity records' },
            limit: { type: 'integer', description: 'Page size limit' },
            offset: { type: 'integer', description: 'Current offset' },
            has_more: { type: 'boolean', description: 'Whether more results exist' }
          },
          required: ['total', 'limit', 'offset', 'has_more']
        }
      },
      required: ['activities', 'pagination']
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface QueryParams {
  limit?: number;
  offset?: number;
  active_within_minutes?: number;
}

interface ActivityItem {
  id: string;
  client_name: string | null;
  satellite: {
    id: string;
    name: string;
  };
  last_activity_at: string;
  total_requests: number;
  total_tool_calls: number;
  user_agent: string | null;
  first_seen_at: string;
}

interface SuccessResponse {
  success: boolean;
  data: {
    activities: ActivityItem[];
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

interface ActivityRecord {
  id: string;
  client_name: string | null;
  user_agent: string | null;
  last_activity_at: Date;
  first_seen_at: Date;
  total_requests: number;
  total_tool_calls: number;
  satellite_id: string;
  satellite_name: string;
}

export default async function getMcpClientActivityRoute(server: FastifyInstance) {
  server.get('/users/me/mcp/client-activity', {
    preValidation: [requireAuthenticationAny()],
    schema: {
      tags: ['Users', 'MCP'],
      summary: 'Get current user\'s active MCP clients',
      description: 'Returns the current user\'s active MCP clients (VS Code, Cursor, etc.) based on recent activity. This is a PERSONAL dashboard endpoint - users see ONLY their own clients, not their team members\' activity.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      
      querystring: QUERY_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Current user\'s active MCP clients'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid query parameters'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb();
      const userId = request.user!.id;
      const query = request.query as QueryParams;
      
      const limit = query.limit || 20;
      const offset = query.offset || 0;
      const activeWithinMinutes = query.active_within_minutes || 30;
      
      // Calculate cutoff timestamp (X minutes ago)
      const cutoffTime = new Date(Date.now() - activeWithinMinutes * 60 * 1000);
      
      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(mcpClientActivity)
        .where(
          and(
            eq(mcpClientActivity.user_id, userId),
            gt(mcpClientActivity.last_activity_at, cutoffTime)
          )
        );
      
      const total = Number(countResult[0]?.count || 0);
      
      // Get activity records with satellite information
      const activityRecords = await db
        .select({
          id: mcpClientActivity.id,
          client_name: mcpClientActivity.client_name,
          user_agent: mcpClientActivity.user_agent,
          last_activity_at: mcpClientActivity.last_activity_at,
          first_seen_at: mcpClientActivity.first_seen_at,
          total_requests: mcpClientActivity.total_requests,
          total_tool_calls: mcpClientActivity.total_tool_calls,
          satellite_id: satellites.id,
          satellite_name: satellites.name
        })
        .from(mcpClientActivity)
        .innerJoin(satellites, eq(mcpClientActivity.satellite_id, satellites.id))
        .where(
          and(
            eq(mcpClientActivity.user_id, userId),
            gt(mcpClientActivity.last_activity_at, cutoffTime)
          )
        )
        .orderBy(sql`${mcpClientActivity.last_activity_at} DESC`)
        .limit(limit)
        .offset(offset);
      
      // Format activities
      const activities: ActivityItem[] = activityRecords.map((record: ActivityRecord) => ({
        id: record.id,
        client_name: record.client_name,
        satellite: {
          id: record.satellite_id,
          name: record.satellite_name
        },
        last_activity_at: record.last_activity_at.toISOString(),
        total_requests: record.total_requests,
        total_tool_calls: record.total_tool_calls,
        user_agent: record.user_agent,
        first_seen_at: record.first_seen_at.toISOString()
      }));
      
      const successResponse: SuccessResponse = {
        success: true,
        data: {
          activities,
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
      server.log.error(error, 'Error fetching MCP client activity');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch MCP client activity'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
