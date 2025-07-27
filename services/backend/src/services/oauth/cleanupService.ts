import { TokenService } from './tokenService';
import { AuthorizationService } from './authorizationService';
import type { FastifyBaseLogger } from 'fastify';

export class OAuthCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Start the OAuth2 cleanup service
   */
  static start(logger?: FastifyBaseLogger): void {
    if (this.cleanupInterval) {
      logger?.warn({
        operation: 'oauth_cleanup_start',
        warning: 'Cleanup service already running',
      }, 'OAuth2 cleanup service already started');
      return;
    }

    logger?.info({
      operation: 'oauth_cleanup_start',
      intervalMs: this.CLEANUP_INTERVAL_MS,
    }, 'Starting OAuth2 cleanup service');

    // Run cleanup immediately on start (with delay to allow DB initialization)
    setTimeout(() => {
      this.runCleanup(logger);
    }, 5000); // 5 second delay

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup(logger);
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the OAuth2 cleanup service
   */
  static stop(logger?: FastifyBaseLogger): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      
      logger?.info({
        operation: 'oauth_cleanup_stop',
      }, 'OAuth2 cleanup service stopped');
    }
  }

  /**
   * Run cleanup manually
   */
  static async runCleanup(logger?: FastifyBaseLogger): Promise<void> {
    try {
      logger?.debug({
        operation: 'oauth_cleanup_run',
      }, 'Running OAuth2 cleanup');

      // Clean up expired tokens
      await TokenService.cleanupExpiredTokens(logger);
      
      // Clean up expired authorization codes
      await AuthorizationService.cleanupExpiredAuthorizationCodes(logger);

      logger?.debug({
        operation: 'oauth_cleanup_run',
        result: 'success',
      }, 'OAuth2 cleanup completed successfully');

    } catch (error) {
      logger?.error({
        operation: 'oauth_cleanup_run',
        error,
      }, 'OAuth2 cleanup failed');
    }
  }
}
