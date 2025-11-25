import type { FastifyBaseLogger } from 'fastify';
import { mcpClientActivity, mcpClientActivityMetrics } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AnyDatabase } from '../../db';

export const EVENT_TYPE = 'mcp.client.activity';

export const SCHEMA = {
  type: 'object',
  properties: {
    user_id: { 
      type: 'string', 
      minLength: 1,
      description: 'User ID who made the MCP requests'
    },
    team_id: { 
      type: 'string', 
      minLength: 1,
      description: 'Team ID in which the requests were made'
    },
    oauth_client_id: { 
      type: 'string', 
      minLength: 1,
      description: 'OAuth client ID of the MCP client'
    },
    client_name: { 
      type: 'string',
      description: 'Human-readable client name (VS Code, Cursor, etc.)'
    },
    user_agent: { 
      type: 'string',
      description: 'User-Agent header from the MCP client'
    },
    ip_address: { 
      type: 'string',
      description: 'IP address of the MCP client'
    },
    session_id: { 
      type: 'string',
      description: 'Optional Mcp-Session-Id for request correlation'
    },
    request_count: { 
      type: 'number', 
      minimum: 1,
      description: 'Number of requests since last event'
    },
    tool_call_count: { 
      type: 'number', 
      minimum: 0,
      description: 'Number of tool calls since last event'
    },
    last_activity_at: { 
      type: 'string', 
      format: 'date-time',
      description: 'ISO 8601 timestamp of last activity'
    }
  },
  required: [
    'user_id', 
    'team_id', 
    'oauth_client_id', 
    'request_count', 
    'tool_call_count', 
    'last_activity_at'
  ],
  additionalProperties: true
} as const;

interface McpClientActivityData {
  user_id: string;
  team_id: string;
  oauth_client_id: string;
  client_name?: string;
  user_agent?: string;
  ip_address?: string;
  session_id?: string;
  request_count: number;
  tool_call_count: number;
  last_activity_at: string;
}

const BUCKET_INTERVALS = ['15m'] as const;
const INTERVAL_SECONDS: Record<string, number> = {
  '15m': 900,
  '1h': 3600
};

function calculateBucketTimestamp(activityTimestamp: Date, intervalSeconds: number): number {
  const timestampSeconds = Math.floor(activityTimestamp.getTime() / 1000);
  return Math.floor(timestampSeconds / intervalSeconds) * intervalSeconds;
}

async function updateCumulativeActivity(
  db: AnyDatabase,
  satelliteId: string,
  data: McpClientActivityData,
  authIdentifier: string,
  activityTimestamp: Date,
  eventTimestamp: Date
): Promise<void> {
  const existing = await db.select()
    .from(mcpClientActivity)
    .where(and(
      eq(mcpClientActivity.user_id, data.user_id),
      eq(mcpClientActivity.team_id, data.team_id),
      eq(mcpClientActivity.auth_identifier, authIdentifier),
      eq(mcpClientActivity.satellite_id, satelliteId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(mcpClientActivity)
      .set({
        last_activity_at: activityTimestamp,
        total_requests: existing[0].total_requests + data.request_count,
        total_tool_calls: existing[0].total_tool_calls + data.tool_call_count,
        current_session_id: data.session_id,
        user_agent: data.user_agent,
        ip_address: data.ip_address,
        updated_at: eventTimestamp
      })
      .where(eq(mcpClientActivity.id, existing[0].id));
  } else {
    await db.insert(mcpClientActivity).values({
      id: `mcp_activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: data.user_id,
      team_id: data.team_id,
      satellite_id: satelliteId,
      auth_type: 'oauth',
      oauth_client_id: data.oauth_client_id,
      api_key_id: null,
      auth_identifier: authIdentifier,
      client_name: data.client_name || null,
      user_agent: data.user_agent || null,
      ip_address: data.ip_address || null,
      current_session_id: data.session_id || null,
      first_seen_at: activityTimestamp,
      last_activity_at: activityTimestamp,
      total_requests: data.request_count,
      total_tool_calls: data.tool_call_count,
      created_at: eventTimestamp,
      updated_at: eventTimestamp
    });
  }
}

async function writeTimeSeriesMetrics(
  db: AnyDatabase,
  satelliteId: string,
  data: McpClientActivityData,
  authIdentifier: string,
  activityTimestamp: Date,
  eventTimestamp: Date
): Promise<void> {
  for (const interval of BUCKET_INTERVALS) {
    const intervalSeconds = INTERVAL_SECONDS[interval];
    const bucketTimestamp = calculateBucketTimestamp(activityTimestamp, intervalSeconds);

    await db
      .insert(mcpClientActivityMetrics)
      .values({
        id: nanoid(),
        user_id: data.user_id,
        team_id: data.team_id,
        satellite_id: satelliteId,
        auth_identifier: authIdentifier,
        bucket_timestamp: bucketTimestamp,
        bucket_interval: interval,
        request_count: data.request_count,
        tool_call_count: data.tool_call_count,
        active_client_count: 1,
        created_at: eventTimestamp
      })
      .onConflictDoUpdate({
        target: [
          mcpClientActivityMetrics.user_id,
          mcpClientActivityMetrics.team_id,
          mcpClientActivityMetrics.satellite_id,
          mcpClientActivityMetrics.auth_identifier,
          mcpClientActivityMetrics.bucket_timestamp,
          mcpClientActivityMetrics.bucket_interval
        ],
        set: {
          request_count: sql`${mcpClientActivityMetrics.request_count} + ${data.request_count}`,
          tool_call_count: sql`${mcpClientActivityMetrics.tool_call_count} + ${data.tool_call_count}`
        }
      });
  }
}

export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as McpClientActivityData;
  const authIdentifier = `oauth:${data.oauth_client_id}`;
  const activityTimestamp = new Date(data.last_activity_at);

  await updateCumulativeActivity(
    db,
    satelliteId,
    data,
    authIdentifier,
    activityTimestamp,
    eventTimestamp
  );

  try {
    await writeTimeSeriesMetrics(
      db,
      satelliteId,
      data,
      authIdentifier,
      activityTimestamp,
      eventTimestamp
    );
  } catch (error) {
    logger.error({
      operation: 'write_time_series_metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
      satelliteId,
      userId: data.user_id,
      teamId: data.team_id,
      requestCount: data.request_count,
      toolCallCount: data.tool_call_count
    }, 'Failed to write time-series metrics (non-fatal)');
  }
}
