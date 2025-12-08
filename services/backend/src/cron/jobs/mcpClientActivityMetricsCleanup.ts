import type { CronJob } from '../cronManager';

/**
 * MCP Client Activity Metrics Cleanup Cron Job
 *
 * Runs every 30 minutes to clean up old MCP client activity metrics data.
 *
 * This job deletes all metric buckets from the mcpClientActivityMetrics table
 * that are older than 3 days (hardcoded retention period in worker).
 *
 * Schedule: Every 30 minutes
 * Job Type: cleanup_mcp_client_activity_metrics
 * Retention: 3 days (hardcoded in worker)
 */
export function createMcpClientActivityMetricsCleanupJob(): CronJob {
  return {
    name: 'mcp-client-activity-metrics-cleanup',
    schedule: '*/30 * * * *',
    jobType: 'cleanup_mcp_client_activity_metrics',
    // Empty payload - retention period is hardcoded in worker
  };
}
