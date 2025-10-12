/**
 * MCP Server Started Event Handler
 * 
 * Updates satelliteProcesses table when an MCP server successfully starts
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { satelliteProcesses } from '../../db/schema.sqlite';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.started';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    processId: {
      type: 'string',
      minLength: 1,
      description: 'Unique process identifier in satelliteProcesses table'
    },
    serverId: {
      type: 'string',
      minLength: 1,
      description: 'MCP server identifier'
    },
    serverName: {
      type: 'string',
      minLength: 1,
      description: 'Human-readable MCP server name'
    },
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier'
    },
    pid: {
      type: 'number',
      description: 'Operating system process ID'
    },
    localPort: {
      type: 'number',
      description: 'Local port for HTTP communication'
    }
  },
  required: ['processId', 'serverId', 'serverName', 'teamId'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerStartedData {
  processId: string;
  serverId: string;
  serverName: string;
  teamId: string;
  pid?: number;
  localPort?: number;
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
  db: LibSQLDatabase,
  eventTimestamp: Date
): Promise<void> {
  const data = eventData as unknown as ServerStartedData;
  
  // Update process status to running
  await db
    .update(satelliteProcesses)
    .set({
      status: 'running',
      process_pid: data.pid || null,
      local_port: data.localPort || null,
      health_status: 'healthy',
      started_at: eventTimestamp,
      updated_at: new Date()
    })
    .where(eq(satelliteProcesses.id, data.processId));
}
