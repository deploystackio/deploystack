/**
 * MCP Request Logs Event Handler
 *
 * Stores incoming client tool call requests in the database
 * with a 100-line limit per installation.
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { mcpRequestLogs } from '../../db/schema';
import { nanoid } from 'nanoid';

// Event type identifier
export const EVENT_TYPE = 'mcp.request.logs';

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
    requests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'User who made the request (optional)'
          },
          tool_name: {
            type: 'string',
            minLength: 1,
            description: 'Name of the tool called'
          },
          tool_params: {
            type: 'object',
            description: 'Parameters passed to the tool'
          },
          response_time_ms: {
            type: 'number',
            minimum: 0,
            description: 'Response time in milliseconds'
          },
          success: {
            type: 'boolean',
            description: 'Whether the call succeeded'
          },
          error_message: {
            type: 'string',
            description: 'Error message if failed'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp'
          }
        },
        required: ['tool_name', 'tool_params', 'response_time_ms', 'success', 'timestamp']
      },
      description: 'Array of request log entries'
    }
  },
  required: ['installation_id', 'team_id', 'requests'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface RequestEntry {
  user_id?: string;
  tool_name: string;
  tool_params: Record<string, unknown>;
  response_time_ms: number;
  success: boolean;
  error_message?: string;
  timestamp: string;
}

interface RequestLogsData {
  installation_id: string;
  team_id: string;
  requests: RequestEntry[];
}

/**
 * Handle mcp.request.logs event
 *
 * Bulk inserts request logs into the database.
 * Log cleanup (100-line limit) is handled by a separate cron job.
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as RequestLogsData;

  logger.debug({
    operation: 'process_request_logs',
    installation_id: data.installation_id,
    team_id: data.team_id,
    request_count: data.requests.length
  }, 'Processing request logs event');

  if (data.requests.length === 0) {
    logger.debug({
      operation: 'process_request_logs',
      installation_id: data.installation_id
    }, 'No requests to store');
    return;
  }

  try {
    // Bulk insert request logs
    const logRecords = data.requests.map(request => ({
      id: nanoid(),
      installation_id: data.installation_id,
      team_id: data.team_id,
      user_id: request.user_id || null,
      tool_name: request.tool_name,
      tool_params: request.tool_params,
      response_time_ms: request.response_time_ms,
      success: request.success,
      error_message: request.error_message || null,
      created_at: new Date(request.timestamp)
    }));

    await db.insert(mcpRequestLogs).values(logRecords);

    logger.info({
      operation: 'store_request_logs',
      installation_id: data.installation_id,
      request_count: data.requests.length
    }, 'Request logs stored successfully');

  } catch (error) {
    logger.error({
      operation: 'store_request_logs_failed',
      installation_id: data.installation_id,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to store request logs');

    throw error;
  }
}
