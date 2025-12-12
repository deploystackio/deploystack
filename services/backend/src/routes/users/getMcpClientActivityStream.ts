import type { FastifyInstance } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq, and, gt, sql } from 'drizzle-orm';
import { requireAuthenticationAny } from '../../middleware/oauthMiddleware';

const QUERY_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID to filter activity by'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Number of results (1-100)'
    },
    active_within_minutes: {
      type: 'integer',
      minimum: 1,
      maximum: 1440,
      default: 30,
      description: 'Show clients active within N minutes (1-1440)'
    }
  },
  required: ['team_id'],
  additionalProperties: false
} as const;

interface QueryParams {
  team_id: string;
  limit?: number;
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

async function fetchClientActivity(
  userId: string,
  teamId: string,
  limit: number,
  activeWithinMinutes: number
): Promise<ActivityItem[]> {
  const db = getDb();
  const { mcpClientActivity, satellites } = getSchema();

  const cutoffTime = new Date(Date.now() - activeWithinMinutes * 60 * 1000);

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
        eq(mcpClientActivity.team_id, teamId),
        gt(mcpClientActivity.last_activity_at, cutoffTime)
      )
    )
    .orderBy(sql`${mcpClientActivity.last_activity_at} DESC`)
    .limit(limit);

  return activityRecords.map((record: ActivityRecord) => ({
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
}

export default async function getMcpClientActivityStreamRoute(server: FastifyInstance) {
  server.get('/users/me/mcp/client-activity/stream', {
    sse: true,
    preValidation: [requireAuthenticationAny()],
    schema: {
      tags: ['Users', 'MCP'],
      summary: 'Stream MCP client activity via SSE',
      description: 'Real-time stream of MCP client activity using Server-Sent Events. Pushes updates every 10 seconds.',
      security: [
        { cookieAuth: [] },
        { bearerAuth: [] }
      ],
      querystring: QUERY_PARAMS_SCHEMA
    }
  }, async (request, reply) => {
    const userId = request.user!.id;
    const query = request.query as QueryParams;
    const teamId = query.team_id;
    const limit = query.limit || 20;
    const activeWithinMinutes = query.active_within_minutes || 30;

    let updateInterval: NodeJS.Timeout | null = null;
    let lastDataHash = '';

    // Keep connection open
    reply.sse.keepAlive();

    // Send initial data
    try {
      const activities = await fetchClientActivity(userId, teamId, limit, activeWithinMinutes);
      lastDataHash = JSON.stringify(activities);

      reply.sse.send({
        event: 'client_activity',
        data: { activities }
      });
    } catch (error) {
      server.log.error(error, 'SSE: Error fetching initial client activity');
      reply.sse.send({
        event: 'error',
        data: { error: 'Failed to fetch client activity' }
      });
    }

    // Set up periodic updates (every 10 seconds)
    updateInterval = setInterval(async () => {
      if (!reply.sse.isConnected) {
        if (updateInterval) clearInterval(updateInterval);
        return;
      }

      try {
        const activities = await fetchClientActivity(userId, teamId, limit, activeWithinMinutes);
        const currentHash = JSON.stringify(activities);

        // Only send if data changed
        if (currentHash !== lastDataHash) {
          lastDataHash = currentHash;
          reply.sse.send({
            event: 'client_activity',
            data: { activities }
          });
        }
      } catch (error) {
        server.log.error(error, 'SSE: Error fetching client activity update');
      }
    }, 10000);

    // Cleanup on disconnect
    reply.sse.onClose(() => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
      server.log.debug({ userId, teamId }, 'SSE: Client activity stream closed');
    });
  });
}
