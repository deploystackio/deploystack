import { SatelliteTokenService } from './satelliteTokenService';

/**
 * Background service for cleaning up expired satellite registration tokens
 * Runs periodically to remove tokens that have passed their expiration time
 */
export class TokenCleanupService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Start periodic cleanup of expired tokens
   * Runs every hour by default
   */
  static start(intervalMs: number = this.DEFAULT_CLEANUP_INTERVAL_MS) {
    if (this.intervalId) {
      console.log('🧹 Token cleanup service already running');
      return;
    }

    // Run cleanup immediately on start
    this.runCleanup().catch(error => {
      console.error('Initial token cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.intervalId = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('Token cleanup failed:', error);
      }
    }, intervalMs);

    const intervalHours = Math.round(intervalMs / (60 * 60 * 1000));
    console.log(`🕒 Token cleanup service started (runs every ${intervalHours} hour${intervalHours !== 1 ? 's' : ''})`);
  }

  /**
   * Stop the cleanup service
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Token cleanup service stopped');
    }
  }

  /**
   * Run cleanup manually (for testing or immediate cleanup)
   */
  static async runCleanup(): Promise<number> {
    try {
      const deletedCount = await SatelliteTokenService.cleanupExpiredTokens();
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired satellite registration token${deletedCount !== 1 ? 's' : ''}`);
      }
      return deletedCount;
    } catch (error) {
      console.error('Token cleanup failed:', error);
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
  static restart(intervalMs?: number) {
    this.stop();
    this.start(intervalMs);
  }
}
