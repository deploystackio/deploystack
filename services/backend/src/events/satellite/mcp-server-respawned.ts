/**
 * MCP Server Respawned Event Handler
 * 
 * Updates satelliteProcesses table when a dormant MCP server is respawned
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { satelliteProcesses } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.respawned';

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
      description: 'New operating system process ID'
    },
    dormant_duration_seconds: {
      type: 'number',
      minimum: 0,
      description: 'Duration process was dormant'
    },
    respawn_duration_ms: {
      type: 'number',
      minimum: 0,
      description: 'Time taken to respawn process in milliseconds'
    }
  },
  required: ['server_id', 'server_slug', 'team_id', 'process_id', 'dormant_duration_seconds', 'respawn_duration_ms'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerRespawnedData {
  server_id: string;
  server_slug: string;
  team_id: string;
  process_id: number;
  dormant_duration_seconds: number;
  respawn_duration_ms: number;
}

/**
 * Handle mcp.server.respawned event
 * 
 * Updates the satelliteProcesses table to mark the process as running again.
 * This event is emitted when a satellite automatically respawns a dormant stdio MCP server.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  _logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ServerRespawnedData;
  
  // Update process status back to running with new PID
  await db
    .update(satelliteProcesses)
    .set({
      status: 'running',
      process_pid: data.process_id,
      health_status: 'healthy',
      started_at: eventTimestamp,
      updated_at: new Date()
    })
    .where(eq(satelliteProcesses.id, data.server_id));
}
