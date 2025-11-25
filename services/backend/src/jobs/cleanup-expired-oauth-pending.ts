import type { FastifyBaseLogger } from 'fastify';
import { getDb, mcpServerInstallations } from '../db';
import { and, eq, lt } from 'drizzle-orm';

/**
 * Cleans up expired OAuth pending installations
 *
 * Runs every 3 minutes, deletes installations where:
 * - oauth_pending = true
 * - oauth_pending_expires_at < now
 *
 * This prevents stale pending installations from accumulating and ensures
 * users cannot complete OAuth flows with expired state parameters.
 */
export async function cleanupExpiredOAuthPending(logger: FastifyBaseLogger) {
  try {
    const db = getDb();
    const now = new Date();

    logger.debug(
      { operation: 'cleanup_expired_oauth_pending', timestamp: now },
      'Starting cleanup of expired OAuth pending installations'
    );

    const result = await db
      .delete(mcpServerInstallations)
      .where(
        and(
          eq(mcpServerInstallations.oauth_pending, true),
          lt(mcpServerInstallations.oauth_pending_expires_at, now)
        )
      );

    // PostgreSQL returns rowCount
    const deletedCount = result.rowCount || 0;

    if (deletedCount > 0) {
      logger.info(
        { deletedCount, operation: 'cleanup_expired_oauth_pending' },
        'Cleaned up expired OAuth pending installations'
      );
    } else {
      logger.debug(
        { operation: 'cleanup_expired_oauth_pending' },
        'No expired OAuth pending installations found'
      );
    }

    return deletedCount;
  } catch (error) {
    logger.error(
      {
        operation: 'cleanup_expired_oauth_pending',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      'Failed to cleanup expired OAuth pending installations'
    );
    throw error;
  }
}
