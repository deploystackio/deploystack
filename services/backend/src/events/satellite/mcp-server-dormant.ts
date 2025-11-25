/**
 * MCP Server Dormant Event Handler
 * 
 * Updates satelliteProcesses table when an MCP server process goes dormant due to inactivity
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { satelliteProcesses } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.dormant';

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
    process_id: {
      type: 'number',
      description: 'Operating system process ID'
    },
    idle_duration_seconds: {
      type: 'number',
      minimum: 0,
      description: 'Duration of inactivity before going dormant'
    },
    last_activity_at: {
      type: 'string',
      format: 'date-time',
      description: 'Last activity timestamp'
    }
  },
  required: ['server_id', 'server_slug', 'team_id', 'process_id', 'idle_duration_seconds', 'last_activity_at'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerDormantData {
  server_id: string;
  server_slug: string;
  team_id: string;
  process_id: number;
  idle_duration_seconds: number;
  last_activity_at: string;
}

/**
 * Handle mcp.server.dormant event
 * 
 * Updates the satelliteProcesses table to mark the process as terminated (dormant).
 * This event is emitted when a satellite terminates an idle stdio MCP server to save resources.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  _logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ServerDormantData;
  
  // Update process status to stopped (dormant state)
  await db
    .update(satelliteProcesses)
    .set({
      status: 'stopped',
      health_status: 'unknown',
      stopped_at: eventTimestamp,
      updated_at: new Date()
    })
    .where(eq(satelliteProcesses.id, data.server_id));
}
