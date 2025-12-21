/**
 * MCP Server Status Changed Event Handler
 *
 * Updates mcpServerInstallations table when satellite reports status changes
 * during MCP server installation, discovery, or health check processes.
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { mcpServerInstallations } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

// Event type identifier
export const EVENT_TYPE = 'mcp.server.status_changed';

// Valid status values
const VALID_STATUSES = [
  'provisioning',
  'command_received',
  'connecting',
  'discovering_tools',
  'syncing_tools',
  'online',
  'restarting',
  'offline',
  'error',
  'requires_reauth',
  'permanently_failed'
] as const;

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
      description: 'Team identifier for security validation'
    },
    status: {
      type: 'string',
      enum: VALID_STATUSES,
      description: 'New status value'
    },
    status_message: {
      type: 'string',
      description: 'Human-readable status message or error details'
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp of when status changed'
    }
  },
  required: ['installation_id', 'team_id', 'status', 'timestamp'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface StatusChangedData {
  installation_id: string;
  team_id: string;
  status: typeof VALID_STATUSES[number];
  status_message?: string;
  timestamp: string;
}

/**
 * Handle mcp.server.status_changed event
 *
 * Updates the mcpServerInstallations table with new status from satellite.
 * This event is emitted during installation lifecycle:
 * - provisioning -> connecting -> discovering_tools -> syncing_tools -> online
 * - Or error states: offline, error, requires_reauth, permanently_failed
 */
export async function handle(
  satelliteId: string,
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  eventTimestamp: Date,
  logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as unknown as StatusChangedData;

  logger.info({
    operation: 'mcp_server_status_changed',
    satelliteId,
    installationId: data.installation_id,
    teamId: data.team_id,
    newStatus: data.status,
    statusMessage: data.status_message
  }, 'Processing MCP server status change');

  // Update installation status with team_id verification for security
  const result = await db
    .update(mcpServerInstallations)
    .set({
      status: data.status,
      status_message: data.status_message || null,
      status_updated_at: eventTimestamp,
      updated_at: new Date()
    })
    .where(
      and(
        eq(mcpServerInstallations.id, data.installation_id),
        eq(mcpServerInstallations.team_id, data.team_id)
      )
    );

  // Check if update was successful (PostgreSQL returns rowCount)
  const rowsAffected = (result as { rowCount?: number }).rowCount || 0;

  if (rowsAffected === 0) {
    logger.warn({
      operation: 'mcp_server_status_changed',
      installationId: data.installation_id,
      teamId: data.team_id
    }, 'No installation found matching id and team_id - status not updated');
  } else {
    logger.info({
      operation: 'mcp_server_status_changed',
      installationId: data.installation_id,
      newStatus: data.status
    }, 'Installation status updated successfully');
  }
}
