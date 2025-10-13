import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { mcpClientActivity } from '../../db/schema.sqlite';
import { eq, and } from 'drizzle-orm';

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

export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: LibSQLDatabase,
  eventTimestamp: Date
): Promise<void> {
  const data = eventData as unknown as McpClientActivityData;
  
  // Compute auth_identifier (always non-NULL for proper unique constraint)
  const authIdentifier = `oauth:${data.oauth_client_id}`;
  
  // Check if record exists for this user/team/auth_identifier/satellite combination
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
    // UPDATE existing record: increment counters, update timestamps
    await db.update(mcpClientActivity)
      .set({
        last_activity_at: new Date(data.last_activity_at),
        total_requests: existing[0].total_requests + data.request_count,
        total_tool_calls: existing[0].total_tool_calls + data.tool_call_count,
        current_session_id: data.session_id,
        user_agent: data.user_agent,
        ip_address: data.ip_address,
        updated_at: eventTimestamp
      })
      .where(eq(mcpClientActivity.id, existing[0].id));
  } else {
    // INSERT new record
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
      first_seen_at: new Date(data.last_activity_at),
      last_activity_at: new Date(data.last_activity_at),
      total_requests: data.request_count,
      total_tool_calls: data.tool_call_count,
      created_at: eventTimestamp,
      updated_at: eventTimestamp
    });
  }
}
