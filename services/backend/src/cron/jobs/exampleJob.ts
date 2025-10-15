import type { CronJob } from '../cronManager';
import type { JobQueueService } from '../../services/jobQueueService';

/**
 * Example Cron Job - Runs every 2 minutes
 * 
 * This job demonstrates how to push work to the job queue system
 * from a cron schedule. Every 2 minutes, it creates a new job in
 * the queue which will be processed by the ExampleCronWorker.
 * 
 * The worker will log: "hello from queue every 2min"
 */
export function createExampleCronJob(jobQueueService: JobQueueService): CronJob {
  return {
    name: 'example-every-2min',
    schedule: '*/2 * * * *', // Every 2 minutes
    
    task: async () => {
      await jobQueueService.createJob('example_cron_job', {
        message: 'hello from queue every 2min'
      });
    }
  };
}
