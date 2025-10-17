/**
 * MCP Server Restarted Event Handler
 * 
 * Updates satelliteProcesses table when an MCP server is restarted after a crash
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { FastifyBaseLogger } from 'fastify';
import { satelliteProcesses } from '../../db/schema.sqlite';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.restarted';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    server_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server identifier (installation_id)'
    },
    server_slug: {
      type: 'string',
      minLength: 1,
      description: 'MCP server slug (installation_name)'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier'
    },
    old_process_id: {
      type: 'number',
      description: 'Previous operating system process ID'
    },
    new_process_id: {
      type: 'number',
      description: 'New operating system process ID after restart'
    },
    restart_reason: {
      type: 'string',
      enum: ['crash', 'health_check_failed'],
      description: 'Reason for the restart'
    },
    attempt_number: {
      type: 'number',
      minimum: 1,
      maximum: 3,
      description: 'Restart attempt number (1-3)'
    }
  },
  required: ['server_id', 'server_slug', 'team_id', 'old_process_id', 'new_process_id', 'restart_reason', 'attempt_number'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerRestartedData {
  server_id: string;
  server_slug: string;
  team_id: string;
  old_process_id: number;
  new_process_id: number;
  restart_reason: 'crash' | 'health_check_failed';
  attempt_number: number;
}

/**
 * Handle mcp.server.restarted event
 * 
 * Updates the satelliteProcesses table to mark the process as running again with new PID.
 * This event is emitted when a satellite automatically restarts a crashed MCP server.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: LibSQLDatabase,
  eventTimestamp: Date,
  _logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ServerRestartedData;
  
  // Update process status back to running with new PID
  await db
    .update(satelliteProcesses)
    .set({
      status: 'running',
      process_pid: data.new_process_id,
      health_status: 'healthy',
      started_at: eventTimestamp,
      error_message: null, // Clear previous error
      updated_at: new Date()
    })
    .where(eq(satelliteProcesses.id, data.server_id));
}
