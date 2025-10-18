import type { CronJob } from '../cronManager';
import type { JobQueueService } from '../../services/jobQueueService';

export function createCleanupOldJobsJob(jobQueueService: JobQueueService): CronJob {
  return {
    name: 'cleanup-old-jobs',
    schedule: '0 */6 * * *', // Every 6 hours
    
    task: async () => {
      await jobQueueService.createJob('cleanup_old_jobs', {
        olderThanDays: 14
      });
    }
  };
}
