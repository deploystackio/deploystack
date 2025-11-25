/**
 * MCP Server Crashed Event Handler
 * 
 * Updates satelliteProcesses table when an MCP server crashes unexpectedly
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { satelliteProcesses } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.crashed';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    server_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server identifier that crashed'
    },
    server_slug: {
      type: 'string',
      minLength: 1,
      description: 'MCP server slug'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier for the crashed server'
    },
    process_id: {
      type: 'number',
      description: 'Operating system process ID'
    },
    exit_code: {
      type: 'number',
      description: 'Process exit code'
    },
    signal: {
      type: 'string',
      description: 'Signal that terminated the process (e.g., SIGTERM, SIGKILL)'
    },
    uptime_seconds: {
      type: 'number',
      minimum: 0,
      description: 'Process uptime in seconds before crash'
    },
    crash_count: {
      type: 'number',
      minimum: 1,
      description: 'Number of crashes for this process'
    },
    will_restart: {
      type: 'boolean',
      description: 'Whether the process will be automatically restarted'
    }
  },
  required: ['server_id', 'server_slug', 'team_id', 'process_id', 'exit_code', 'signal', 'uptime_seconds', 'crash_count', 'will_restart'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerCrashedData {
  server_id: string;
  server_slug: string;
  team_id: string;
  process_id: number;
  exit_code: number;
  signal: string;
  uptime_seconds: number;
  crash_count: number;
  will_restart: boolean;
}

/**
 * Handle mcp.server.crashed event
 * 
 * Updates the satelliteProcesses table to mark the process as failed.
 * This event enables immediate alerting and crash analysis.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  _logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ServerCrashedData;
  
  // Build error message from available data
  const errorMessage = `Process crashed: Exit code ${data.exit_code}, Signal: ${data.signal}, Uptime: ${data.uptime_seconds}s, Crash #${data.crash_count}`;
  
  // Update process status to failed
  await db
    .update(satelliteProcesses)
    .set({
      status: 'failed',
      health_status: 'unhealthy',
      error_message: errorMessage,
      stopped_at: eventTimestamp,
      updated_at: new Date()
    })
    .where(eq(satelliteProcesses.id, data.server_id));
  
  // Future enhancement: Trigger alert notifications
  // Future enhancement: Create incident tracking record
  // Future enhancement: Automatic restart based on policies
}
