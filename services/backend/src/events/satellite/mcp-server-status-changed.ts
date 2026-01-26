/**
 * MCP Server Status Changed Event Handler
 *
 * Updates mcpServerInstances table when satellite reports status changes
 * during MCP server installation, discovery, or health check processes.
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';

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
    user_id: {
      type: 'string',
      minLength: 1,
      description: 'User identifier for per-instance tracking'
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
  required: ['installation_id', 'team_id', 'user_id', 'status', 'timestamp'],
  additionalProperties: true
} as const;

// TypeScript interface for type safety
interface StatusChangedData {
  installation_id: string;
  team_id: string;
  user_id: string; // Required for per-user instance tracking
  status: typeof VALID_STATUSES[number];
  status_message?: string;
  timestamp: string;
}

/**
 * Handle mcp.server.status_changed event
 *
 * Updates the mcpServerInstances table with new status from satellite.
 * Each team member has their own instance with independent status tracking.
 *
 * Event lifecycle:
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
    userId: data.user_id,
    newStatus: data.status,
    statusMessage: data.status_message
  }, 'Processing MCP server status change for INSTANCE');

  // Import McpInstanceService
  const { McpInstanceService } = await import('../../services/mcpInstanceService');
  const instanceService = new McpInstanceService(db, logger);

  // Update instance status (strict validation - instance must exist)
  const updated = await instanceService.updateInstanceStatus(
    data.installation_id,
    data.user_id,
    data.status,
    data.status_message
  );

  if (!updated) {
    logger.error({
      operation: 'mcp_server_status_changed',
      installationId: data.installation_id,
      userId: data.user_id,
      teamId: data.team_id,
      status: data.status
    }, 'CRITICAL: Instance not found for status update - no auto-creation');
    return; // FAIL FAST
  }

  logger.info({
    operation: 'mcp_server_status_changed_instance',
    installationId: data.installation_id,
    userId: data.user_id,
    newStatus: data.status
  }, 'Instance status updated successfully');

  // Check if deployment email should be sent (GitHub deployments only)
  await handleDeploymentEmail(
    data.installation_id,
    data.user_id,
    data.status,
    db,
    logger
  );
}

/**
 * Handle deployment success/failure email notifications
 *
 * Only sends emails for deployments tracked in cache (GitHub deployments).
 * The cache is populated by the deployment listener when MCP_DEPLOYMENT_CREATED fires.
 *
 * Status triggers:
 * - 'online' → Success email
 * - 'error' or 'permanently_failed' → Failure email
 */
async function handleDeploymentEmail(
  installationId: string,
  userId: string,
  status: string,
  db: AnyDatabase,
  logger: FastifyBaseLogger
): Promise<void> {
  // Only process success or failure statuses
  if (status !== 'online' && status !== 'error' && status !== 'permanently_failed') {
    return;
  }

  // Check if this is a tracked deployment (from cache)
  const { getDeploymentFromCache, removeDeploymentFromCache } = await import('../listeners/deploymentNotificationListener');
  const deploymentInfo = getDeploymentFromCache(installationId, userId);

  if (!deploymentInfo) {
    // Not a tracked deployment (either not GitHub, or cache expired, or status already processed)
    return;
  }

  logger.info({
    installationId,
    userId,
    status,
    serverName: deploymentInfo.serverName
  }, 'Deployment found in cache - sending email');

  // Determine email template and subject based on status
  const isSuccess = status === 'online';
  const template = isSuccess ? 'deployment-success' : 'deployment-failure';
  const subject = isSuccess
    ? `GitHub Deployment Successful - ${deploymentInfo.serverName}`
    : `GitHub Deployment Failed - ${deploymentInfo.serverName}`;

  // Queue deployment email
  try {
    // Get frontend URL from global settings
    const { GlobalSettings } = await import('../../global-settings/helpers');
    const frontendUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173');
    const installationUrl = `${frontendUrl}/mcp-server/installation/${installationId}/general`;

    // Import JobQueueService
    const { JobQueueService } = await import('../../services/jobQueueService');
    const jobQueueService = new JobQueueService(db, logger);

    await jobQueueService.createJob('send_email', {
      to: deploymentInfo.userEmail,
      subject,
      template,
      variables: {
        userName: deploymentInfo.userName,
        serverName: deploymentInfo.serverName,
        repositoryUrl: deploymentInfo.repositoryUrl,
        branch: deploymentInfo.branch,
        commitSha: deploymentInfo.commitSha.substring(0, 7),
        deployedAt: deploymentInfo.deployedAt.toISOString(),
        installationUrl
      }
    });

    // Remove from cache (email sent)
    removeDeploymentFromCache(installationId, userId);

    logger.info({
      installationId,
      userId,
      status,
      template,
      email: deploymentInfo.userEmail
    }, 'Deployment email queued successfully');
  } catch (error) {
    logger.error({
      installationId,
      userId,
      status,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to queue deployment email');
    // Don't throw - email failure shouldn't break status update
    // Note: deployment stays in cache and will expire after TTL
  }
}
