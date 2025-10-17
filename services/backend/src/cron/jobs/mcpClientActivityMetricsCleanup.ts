import type { CronJob } from '../cronManager';
import type { JobQueueService } from '../../services/jobQueueService';

/**
 * MCP Client Activity Metrics Cleanup Cron Job
 * 
 * Runs every 30 minutes to clean up old MCP client activity metrics data.
 * 
 * This job creates a background job in the queue that will delete all
 * metric buckets from the mcpClientActivityMetrics table that are older
 * than 3 days (hardcoded retention period).
 * 
 * Schedule: Every 30 minutes (*\/30 * * * *)
 * Job Type: cleanup_mcp_client_activity_metrics
 * Retention: 3 days (hardcoded)
 */
export function createMcpClientActivityMetricsCleanupJob(
  jobQueueService: JobQueueService
): CronJob {
  return {
    name: 'mcp-client-activity-metrics-cleanup',
    schedule: '*/30 * * * *', // Every 30 minutes
    
    task: async () => {
      // Create cleanup job in queue
      // Empty payload - retention period is hardcoded to 3 days in worker
      await jobQueueService.createJob('cleanup_mcp_client_activity_metrics', {});
    }
  };
}
