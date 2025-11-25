/**
 * MCP Server Started Event Handler
 * 
 * Updates satelliteProcesses table when an MCP server successfully starts
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { satelliteProcesses } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.started';

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
    transport: {
      type: 'string',
      enum: ['stdio', 'http'],
      description: 'Transport protocol type'
    },
    tool_count: {
      type: 'number',
      minimum: 0,
      description: 'Number of tools discovered'
    },
    spawn_duration_ms: {
      type: 'number',
      minimum: 0,
      description: 'Time taken to spawn process in milliseconds'
    }
  },
  required: ['server_id', 'server_slug', 'team_id', 'process_id', 'transport', 'tool_count', 'spawn_duration_ms'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerStartedData {
  server_id: string;
  server_slug: string;
  team_id: string;
  process_id: number;
  transport: 'stdio' | 'http';
  tool_count: number;
  spawn_duration_ms: number;
}

/**
 * Handle mcp.server.started event
 * 
 * Updates the satelliteProcesses table to mark the process as running.
 * This event is emitted when a satellite successfully starts an MCP server process.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  _logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ServerStartedData;
  
  // Update process status to running
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
