import type { Logger } from 'pino';
import type { EventBus } from '../services/event-bus';

export interface LogRateLimiterConfig {
  maxLogsPerSecond: number;      // Default: 20
  maxLineLengthBytes: number;    // Default: 1024 (1KB)
  warningIntervalMs: number;     // Default: 60000 (1 minute)
}

export interface LogRateLimitResult {
  accept: boolean;
  truncated: boolean;
  truncatedMessage?: string;
}

/**
 * Per-process log rate limiter to prevent stderr flooding attacks.
 *
 * Implements sliding window rate limiting with line length truncation.
 * Drops excess logs silently and emits periodic warnings.
 */
export class LogRateLimiter {
  private logTimestamps: number[] = [];
  private droppedCount: number = 0;
  private lastWarningTime: number = 0;

  constructor(
    private processId: string,
    private config: LogRateLimiterConfig,
    private logger: Logger,
    private eventBus?: EventBus
  ) {}

  /**
   * Check if a log message should be accepted based on rate limit.
   *
   * @param message - The log message to check
   * @param currentTime - Current timestamp in milliseconds
   * @returns Result indicating if log should be accepted and if it was truncated
   */
  shouldAcceptLog(message: string, currentTime: number): LogRateLimitResult {
    // Step 1: Truncate if message exceeds max length
    let truncated = false;
    let finalMessage = message;
    if (message.length > this.config.maxLineLengthBytes) {
      finalMessage = message.substring(0, this.config.maxLineLengthBytes) + '... [truncated]';
      truncated = true;
    }

    // Step 2: Remove timestamps older than 1 second (sliding window)
    const oneSecondAgo = currentTime - 1000;
    this.logTimestamps = this.logTimestamps.filter(ts => ts > oneSecondAgo);

    // Step 3: Check if under rate limit
    if (this.logTimestamps.length >= this.config.maxLogsPerSecond) {
      this.droppedCount++;

      // Emit warning if interval elapsed
      if (currentTime - this.lastWarningTime >= this.config.warningIntervalMs) {
        const elapsedSeconds = Math.floor((currentTime - this.lastWarningTime) / 1000);

        this.logger.warn({
          operation: 'log_rate_limit_exceeded',
          process_id: this.processId,
          dropped_count: this.droppedCount,
          rate_limit: this.config.maxLogsPerSecond,
          window_seconds: 1,
          elapsed_seconds: elapsedSeconds
        }, `Process ${this.processId} exceeded log rate limit (${this.droppedCount} logs dropped in last ${elapsedSeconds}s)`);

        // Emit event for backend monitoring
        if (this.eventBus) {
          this.eventBus.emit('mcp.server.log_rate_limit_exceeded', {
            installation_id: this.processId,
            dropped_count: this.droppedCount,
            time_window_seconds: elapsedSeconds,
            rate_limit: this.config.maxLogsPerSecond
          });
        }

        this.lastWarningTime = currentTime;
        this.droppedCount = 0;
      }

      return { accept: false, truncated: false };
    }

    // Step 4: Accept the log
    this.logTimestamps.push(currentTime);
    return {
      accept: true,
      truncated,
      truncatedMessage: truncated ? finalMessage : undefined
    };
  }

  /**
   * Reset the rate limiter state (useful for testing or process restart).
   */
  reset(): void {
    this.logTimestamps = [];
    this.droppedCount = 0;
    this.lastWarningTime = 0;
  }

  /**
   * Get current rate limiter statistics.
   */
  getStats(): { currentRate: number; droppedSinceLastWarning: number } {
    return {
      currentRate: this.logTimestamps.length,
      droppedSinceLastWarning: this.droppedCount
    };
  }
}
