/**
 * MCP Tool Executed Event Handler
 * 
 * Logs tool execution to satelliteUsageLogs table for analytics and audit trails
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { satelliteUsageLogs } from '../../db/schema.sqlite';
import { nanoid } from 'nanoid';

// Event type identifier
export const EVENT_TYPE = 'mcp.tool.executed';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    processId: {
      type: 'string',
      description: 'Process identifier in satelliteProcesses table'
    },
    toolName: {
      type: 'string',
      minLength: 1,
      description: 'MCP tool name (e.g., filesystem/read_file)'
    },
    serverId: {
      type: 'string',
      minLength: 1,
      description: 'MCP server identifier that executed the tool'
    },
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier for the execution context'
    },
    userId: {
      type: 'string',
      description: 'User who triggered the tool execution'
    },
    durationMs: {
      type: 'number',
      minimum: 0,
      description: 'Tool execution duration in milliseconds'
    },
    statusCode: {
      type: 'number',
      description: 'Execution status code (200 = success, 4xx/5xx = error)'
    },
    errorMessage: {
      type: 'string',
      description: 'Error message if execution failed'
    },
    requestSizeBytes: {
      type: 'number',
      minimum: 0,
      description: 'Input payload size in bytes'
    },
    responseSizeBytes: {
      type: 'number',
      minimum: 0,
      description: 'Output payload size in bytes'
    },
    userAgent: {
      type: 'string',
      description: 'Client user agent (e.g., VS Code version)'
    },
    ipAddress: {
      type: 'string',
      description: 'Client IP address if available'
    }
  },
  required: ['toolName', 'serverId', 'teamId'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ToolExecutedData {
  processId?: string;
  toolName: string;
  serverId: string;
  teamId: string;
  userId?: string;
  durationMs?: number;
  statusCode?: number;
  errorMessage?: string;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  userAgent?: string;
  ipAddress?: string;
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
  eventTimestamp: Date
): Promise<void> {
  const data = eventData as unknown as ToolExecutedData;
  
  // Format date partition for efficient querying
  const datePartition = eventTimestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Insert usage log record
  await db.insert(satelliteUsageLogs).values({
    id: nanoid(),
    satellite_id: satelliteId,
    user_id: data.userId || null,
    team_id: data.teamId,
    process_id: data.processId || null,
    request_method: 'POST', // MCP tools are typically POST requests
    request_path: `/mcp/tool/${data.toolName}`,
    tool_name: data.toolName,
    duration_ms: data.durationMs || null,
    status_code: data.statusCode || (data.errorMessage ? 500 : 200),
    error_message: data.errorMessage || null,
    request_size_bytes: data.requestSizeBytes || null,
    response_size_bytes: data.responseSizeBytes || null,
    user_agent: data.userAgent || null,
    ip_address: data.ipAddress || null,
    timestamp: eventTimestamp,
    date_partition: datePartition
  });
  
  // Future enhancement: Real-time usage metrics aggregation
  // Future enhancement: Cost tracking and billing calculations
  // Future enhancement: Rate limiting enforcement
}
