import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { mcpClientActivityMetrics } from '../db/schema.sqlite';
import { lt } from 'drizzle-orm';

/**
 * MCP Client Activity Metrics Cleanup Worker
 * 
 * Deletes old metric buckets from the mcpClientActivityMetrics table.
 * 
 * Retention Policy (Hardcoded):
 * - 15-minute buckets: Keep for 3 days
 * - Deletes all buckets older than the cutoff timestamp
 * 
 * This worker is triggered by the cron job that runs every 30 minutes.
 * It calculates the cutoff timestamp (3 days ago) and deletes all
 * bucket_timestamp records older than that cutoff.
 * 
 * Performance:
 * - Uses indexed query on bucket_timestamp column
 * - Expected execution time: < 500ms for typical datasets
 * - Handles both SQLite and Turso database drivers
 */
export class McpClientActivityMetricsCleanupWorker implements Worker {
  // Hardcoded retention period: 3 days
  private readonly RETENTION_DAYS = 3;

  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {}

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    const startTime = Date.now();

    this.logger.info({ 
      jobId,
      retention_days: this.RETENTION_DAYS,
      operation: 'cleanup_mcp_client_activity_metrics'
    }, 'Starting MCP client activity metrics cleanup job');

    try {
      // Calculate cutoff timestamp (3 days ago, in Unix seconds)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
      const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

      this.logger.debug({
        jobId,
        retention_days: this.RETENTION_DAYS,
        cutoff_timestamp: cutoffTimestamp,
        cutoff_date: cutoffDate.toISOString(),
        table: 'mcpClientActivityMetrics'
      }, 'Calculated cleanup cutoff');

      // Delete old buckets using time-based index
      const result = await this.db
        .delete(mcpClientActivityMetrics)
        .where(lt(mcpClientActivityMetrics.bucket_timestamp, cutoffTimestamp));

      // Handle both SQLite (changes) and Turso (rowsAffected) drivers
      const deletedCount = (result.changes || result.rowsAffected || 0);

      const durationMs = Date.now() - startTime;

      this.logger.info({
        jobId,
        operation: 'cleanup_mcp_client_activity_metrics',
        deleted_count: deletedCount,
        retention_days: this.RETENTION_DAYS,
        cutoff_timestamp: cutoffTimestamp,
        duration_ms: durationMs,
        table: 'mcpClientActivityMetrics'
      }, 'MCP client activity metrics cleanup completed successfully');

      return {
        success: true,
        message: `Deleted ${deletedCount} old metric buckets (retention: ${this.RETENTION_DAYS} days)`,
        data: {
          deletedCount,
          retentionDays: this.RETENTION_DAYS,
          cutoffTimestamp,
          durationMs
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      this.logger.error({
        jobId,
        error,
        duration_ms: durationMs,
        operation: 'cleanup_mcp_client_activity_metrics',
        table: 'mcpClientActivityMetrics'
      }, 'MCP client activity metrics cleanup job failed');

      // Throw error to trigger job queue retry logic
      throw error;
    }
  }
}
