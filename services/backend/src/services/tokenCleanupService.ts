import { SatelliteTokenService } from './satelliteTokenService';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Background service for cleaning up expired satellite registration tokens
 * Runs periodically to remove tokens that have passed their expiration time
 */
export class TokenCleanupService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private static logger: FastifyBaseLogger | null = null;

  /**
   * Start periodic cleanup of expired tokens
   * Runs every hour by default
   */
  static start(logger: FastifyBaseLogger, intervalMs: number = this.DEFAULT_CLEANUP_INTERVAL_MS) {
    if (this.intervalId) {
      logger.warn({
        operation: 'token_cleanup_start',
        status: 'already_running'
      }, '🧹 Token cleanup service already running');
      return;
    }

    this.logger = logger;

    // Run cleanup immediately on start
    this.runCleanup().catch(error => {
      logger.error({
        operation: 'token_cleanup_initial',
        error
      }, 'Initial token cleanup failed');
    });

    // Schedule periodic cleanup
    this.intervalId = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        logger.error({
          operation: 'token_cleanup_periodic',
          error
        }, 'Token cleanup failed');
      }
    }, intervalMs);

    const intervalHours = Math.round(intervalMs / (60 * 60 * 1000));
    logger.info({
      operation: 'token_cleanup_start',
      intervalMs,
      intervalHours
    }, `🕒 Token cleanup service started (runs every ${intervalHours} hour${intervalHours !== 1 ? 's' : ''})`);
  }

  /**
   * Stop the cleanup service
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      
      if (this.logger) {
        this.logger.info({
          operation: 'token_cleanup_stop'
        }, '🛑 Token cleanup service stopped');
      }
    }
  }

  /**
   * Run cleanup manually (for testing or immediate cleanup)
   */
  static async runCleanup(): Promise<number> {
    try {
      const deletedCount = await SatelliteTokenService.cleanupExpiredTokens();
      if (deletedCount > 0 && this.logger) {
        this.logger.info({
          operation: 'token_cleanup_run',
          deletedCount
        }, `🧹 Cleaned up ${deletedCount} expired satellite registration token${deletedCount !== 1 ? 's' : ''}`);
      }
      return deletedCount;
    } catch (error) {
      if (this.logger) {
        this.logger.error({
          operation: 'token_cleanup_run',
          error
        }, 'Token cleanup failed');
      }
      throw error;
    }
  }

  /**
   * Get cleanup service status
   */
  static getStatus() {
    return {
      running: this.intervalId !== null,
      intervalMs: this.DEFAULT_CLEANUP_INTERVAL_MS
    };
  }

  /**
   * Restart the cleanup service with new interval
   */
  static restart(logger: FastifyBaseLogger, intervalMs?: number) {
    this.stop();
    this.start(logger, intervalMs);
  }
}
