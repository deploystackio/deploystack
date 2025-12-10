/**
 * MCP Server Logs Event Handler
 *
 * Stores internal MCP server logs (stderr, startup, connection errors)
 * in the database with a 100-line limit per installation.
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { mcpServerLogs } from '../../db/schema';
import { nanoid } from 'nanoid';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.logs';

// JSON Schema for Fastify validation
export const SCHEMA = {
  type: 'object',
  properties: {
    installation_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server installation identifier'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team identifier'
    },
    logs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['info', 'warn', 'error', 'debug'],
            description: 'Log level'
          },
          message: {
            type: 'string',
            description: 'Log message content'
          },
          metadata: {
            type: 'object',
            description: 'Optional structured metadata'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp'
          }
        },
        required: ['level', 'message', 'timestamp']
      },
      description: 'Array of log entries'
    }
  },
  required: ['installation_id', 'team_id', 'logs'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface ServerLogsData {
  installation_id: string;
  team_id: string;
  logs: LogEntry[];
}

/**
 * Handle mcp.server.logs event
 *
 * Bulk inserts server logs into the database.
 * Log cleanup (100-line limit) is handled by a separate cron job.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as ServerLogsData;

  logger.debug({
    operation: 'process_server_logs',
    installation_id: data.installation_id,
    team_id: data.team_id,
    log_count: data.logs.length
  }, 'Processing server logs event');

  if (data.logs.length === 0) {
    logger.debug({
      operation: 'process_server_logs',
      installation_id: data.installation_id
    }, 'No logs to store');
    return;
  }

  try {
    // Bulk insert logs
    const logRecords = data.logs.map(log => ({
      id: nanoid(),
      installation_id: data.installation_id,
      team_id: data.team_id,
      log_type: 'mcp_server_log',
      log_level: log.level,
      message: log.message,
      metadata: log.metadata || null,
      created_at: new Date(log.timestamp)
    }));

    await db.insert(mcpServerLogs).values(logRecords);

    logger.info({
      operation: 'store_server_logs',
      installation_id: data.installation_id,
      log_count: data.logs.length
    }, 'Server logs stored successfully');

  } catch (error) {
    logger.error({
      operation: 'store_server_logs_failed',
      installation_id: data.installation_id,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to store server logs');

    throw error;
  }
}
