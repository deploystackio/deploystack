/**
 * MCP Tool Executed Event Handler
 * 
 * Logs tool execution to satelliteUsageLogs table for analytics and audit trails
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { FastifyBaseLogger } from 'fastify';
import { satelliteUsageLogs } from '../../db/schema.sqlite';
import { nanoid } from 'nanoid';

// Event type identifier
export const EVENT_TYPE = 'mcp.tool.executed';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    tool_name: {
      type: 'string',
      minLength: 1,
      description: 'MCP tool name (e.g., filesystem-read_file)'
    },
    server_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server identifier that executed the tool'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier for the execution context'
    },
    duration_ms: {
      type: 'number',
      minimum: 0,
      description: 'Tool execution duration in milliseconds'
    },
    success: {
      type: 'boolean',
      description: 'Whether the tool execution succeeded'
    },
    error_message: {
      type: 'string',
      description: 'Error message if execution failed'
    }
  },
  required: ['tool_name', 'server_id', 'team_id', 'duration_ms', 'success'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ToolExecutedData {
  tool_name: string;
  server_id: string;
  team_id: string;
  duration_ms: number;
  success: boolean;
  error_message?: string;
}

/**
 * Handle mcp.tool.executed event
 * 
 * Logs tool execution to satelliteUsageLogs table for analytics and audit trails.
 * This provides complete visibility into MCP tool usage across teams.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: LibSQLDatabase,
  eventTimestamp: Date,
  _logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ToolExecutedData;
  
  // Format date partition for efficient querying
  const datePartition = eventTimestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Insert usage log record
  await db.insert(satelliteUsageLogs).values({
    id: nanoid(),
    satellite_id: satelliteId,
    user_id: null,
    team_id: data.team_id,
    process_id: null,
    request_method: 'POST',
    request_path: `/mcp/tool/${data.tool_name}`,
    tool_name: data.tool_name,
    duration_ms: data.duration_ms,
    status_code: data.success ? 200 : 500,
    error_message: data.error_message || null,
    request_size_bytes: null,
    response_size_bytes: null,
    user_agent: null,
    ip_address: null,
    timestamp: eventTimestamp,
    date_partition: datePartition
  });
  
  // Future enhancement: Real-time usage metrics aggregation
  // Future enhancement: Cost tracking and billing calculations
  // Future enhancement: Rate limiting enforcement
}
