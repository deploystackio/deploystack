import type { CronJob } from '../cronManager';

/**
 * Cleanup Old Jobs Cron Job
 *
 * Runs every 6 hours to clean up old completed/failed jobs from the queue.
 *
 * Schedule: Every 6 hours
 * Job Type: cleanup_old_jobs
 * Retention: 14 days
 */
export function createCleanupOldJobsJob(): CronJob {
  return {
    name: 'cleanup-old-jobs',
    schedule: '0 */6 * * *',
    jobType: 'cleanup_old_jobs',
    payload: {
      olderThanDays: 14,
    },
  };
}
