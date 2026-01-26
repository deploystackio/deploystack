/**
 * Deployment Notification Listener
 *
 * Listens to MCP_DEPLOYMENT_CREATED events and maintains an in-memory cache
 * of recent deployments to track which deployments should send emails.
 *
 * When a deployment is created, it's added to the cache with a 10-minute TTL.
 * The mcp-server-status-changed handler checks this cache to determine if
 * deployment success/failure emails should be sent.
 */

import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../../db';
import type { DeployStackEventBus } from '../eventBus';
import { EVENT_NAMES } from '../eventNames';

/**
 * Deployment information stored in cache
 */
export interface DeploymentInfo {
  installationId: string;
  serverId: string;
  userId: string; // Deploying user
  userEmail: string;
  userName: string;
  serverName: string;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
  teamId: string;
  deployedAt: Date;
  expiresAt: Date; // Auto-cleanup after 10 minutes
}

/**
 * In-memory cache of recent deployments
 * Key: `${installationId}:${userId}`
 * Value: DeploymentInfo
 *
 * TTL: 10 minutes (600000ms)
 */
const deploymentCache = new Map<string, DeploymentInfo>();

/**
 * Cache TTL in milliseconds (10 minutes)
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Get deployment from cache
 */
export function getDeploymentFromCache(
  installationId: string,
  userId: string
): DeploymentInfo | undefined {
  const key = `${installationId}:${userId}`;
  const deployment = deploymentCache.get(key);

  // Check if expired
  if (deployment && deployment.expiresAt < new Date()) {
    deploymentCache.delete(key);
    return undefined;
  }

  return deployment;
}

/**
 * Remove deployment from cache
 */
export function removeDeploymentFromCache(
  installationId: string,
  userId: string
): void {
  const key = `${installationId}:${userId}`;
  deploymentCache.delete(key);
}

/**
 * Clean up expired deployments from cache
 */
function cleanupExpiredDeployments(): void {
  const now = new Date();
  for (const [key, deployment] of deploymentCache.entries()) {
    if (deployment.expiresAt < now) {
      deploymentCache.delete(key);
    }
  }
}

/**
 * Handle MCP_DEPLOYMENT_CREATED event
 *
 * Extracts deployment information and stores it in cache for email notification.
 */
export async function handleDeploymentCreated(
  eventData: Record<string, unknown>,
  db: AnyDatabase,
  logger: FastifyBaseLogger
): Promise<void> {
  const data = eventData as {
    deployment: {
      installationId: string;
      serverId: string;
      commitSha?: string;
    };
    deployedBy: {
      id: string;
      email: string;
    };
    metadata?: {
      ip?: string;
    };
  };

  const installationId = data.deployment.installationId;
  const userId = data.deployedBy.id;
  const serverId = data.deployment.serverId;

  logger.info({
    operation: 'deployment_created',
    installationId,
    userId,
    serverId
  }, 'Processing MCP_DEPLOYMENT_CREATED event');

  try {
    // Get installation details
    const { getSchema } = await import('../../db');
    const schema = getSchema();
    const { eq } = await import('drizzle-orm');

    const installations = await db
      .select({
        installation_name: schema.mcpServerInstallations.installation_name,
        team_id: schema.mcpServerInstallations.team_id
      })
      .from(schema.mcpServerInstallations)
      .where(eq(schema.mcpServerInstallations.id, installationId))
      .limit(1);

    if (!installations || installations.length === 0) {
      logger.warn({ installationId }, 'Installation not found for deployment cache');
      return;
    }

    const installation = installations[0];

    // Get server details
    const servers = await db
      .select({
        name: schema.mcpServers.name,
        source: schema.mcpServers.source,
        repository_url: schema.mcpServers.repository_url,
        git_branch: schema.mcpServers.git_branch,
        git_commit_sha: schema.mcpServers.git_commit_sha
      })
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.id, serverId))
      .limit(1);

    if (!servers || servers.length === 0) {
      logger.warn({ serverId }, 'Server not found for deployment cache');
      return;
    }

    const server = servers[0];

    // Only cache GitHub deployments
    if (server.source !== 'github') {
      logger.debug({ serverId, source: server.source }, 'Not a GitHub deployment - skipping cache');
      return;
    }

    // Get user details
    const users = await db
      .select({
        username: schema.authUser.username
      })
      .from(schema.authUser)
      .where(eq(schema.authUser.id, userId))
      .limit(1);

    if (!users || users.length === 0) {
      logger.warn({ userId }, 'User not found for deployment cache');
      return;
    }

    const user = users[0];

    // Store in cache
    const now = new Date();
    const deploymentInfo: DeploymentInfo = {
      installationId,
      serverId,
      userId,
      userEmail: data.deployedBy.email,
      userName: user.username || data.deployedBy.email.split('@')[0],
      serverName: server.name,
      repositoryUrl: server.repository_url || 'Unknown',
      branch: server.git_branch || 'main',
      commitSha: server.git_commit_sha || data.deployment.commitSha || 'Unknown',
      teamId: installation.team_id,
      deployedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS)
    };

    const key = `${installationId}:${userId}`;
    deploymentCache.set(key, deploymentInfo);

    logger.info({
      installationId,
      userId,
      serverName: server.name,
      cacheKey: key,
      expiresAt: deploymentInfo.expiresAt
    }, 'Deployment added to cache for email notification');

    // Clean up expired deployments
    cleanupExpiredDeployments();
  } catch (error) {
    logger.error({
      installationId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to process deployment for cache');
    // Don't throw - cache failure shouldn't break deployment
  }
}

/**
 * Register deployment notification listener
 */
export function registerDeploymentListener(
  eventBus: DeployStackEventBus,
  db: AnyDatabase,
  logger: FastifyBaseLogger
): void {
  eventBus.on(EVENT_NAMES.MCP_DEPLOYMENT_CREATED, async (eventData: Record<string, unknown>) => {
    await handleDeploymentCreated(eventData, db, logger);
  });

  logger.info('Deployment notification listener registered');
}
