/**
 * MCP Server Crashed Event Handler
 * 
 * Updates satelliteProcesses table when an MCP server crashes unexpectedly
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { satelliteProcesses } from '../../db/schema.sqlite';
import { eq } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.crashed';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    processId: {
      type: 'string',
      minLength: 1,
      description: 'Process identifier in satelliteProcesses table'
    },
    serverId: {
      type: 'string',
      minLength: 1,
      description: 'MCP server identifier that crashed'
    },
    serverName: {
      type: 'string',
      minLength: 1,
      description: 'Human-readable MCP server name'
    },
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier for the crashed server'
    },
    exitCode: {
      type: 'number',
      description: 'Process exit code'
    },
    signal: {
      type: 'string',
      description: 'Signal that terminated the process (e.g., SIGKILL, SIGSEGV)'
    },
    errorMessage: {
      type: 'string',
      description: 'Error message or crash reason'
    },
    stackTrace: {
      type: 'string',
      description: 'Stack trace if available'
    }
  },
  required: ['processId', 'serverId', 'serverName', 'teamId'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface ServerCrashedData {
  processId: string;
  serverId: string;
  serverName: string;
  teamId: string;
  exitCode?: number;
  signal?: string;
  errorMessage?: string;
  stackTrace?: string;
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
  db: LibSQLDatabase,
  eventTimestamp: Date
): Promise<void> {
  const data = eventData as unknown as ServerCrashedData;
  
  // Build error message from available data
  const errorDetails = [];
  if (data.exitCode !== undefined) errorDetails.push(`Exit code: ${data.exitCode}`);
  if (data.signal) errorDetails.push(`Signal: ${data.signal}`);
  if (data.errorMessage) errorDetails.push(data.errorMessage);
  
  const errorMessage = errorDetails.length > 0 
    ? errorDetails.join(' | ') 
    : 'Process crashed unexpectedly';
  
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
    .where(eq(satelliteProcesses.id, data.processId));
  
  // Future enhancement: Trigger alert notifications
  // Future enhancement: Create incident tracking record
  // Future enhancement: Automatic restart based on policies
}
