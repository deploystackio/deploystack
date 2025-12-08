import type { CronJob } from '../cronManager';

/**
 * Example Cron Job - Runs every 2 minutes
 *
 * This job demonstrates how to define a cron job that creates work
 * in the job queue system. Every 2 minutes, a job is created
 * which will be processed by the ExampleCronWorker.
 *
 * The worker will log: "hello from queue every 2min"
 *
 * To use this example:
 * 1. Uncomment the import and registration in cron/index.ts
 * 2. Uncomment the worker registration in workers/index.ts
 */
export function createExampleCronJob(): CronJob {
  return {
    name: 'example-every-2min',
    schedule: '*/2 * * * *',
    jobType: 'example_cron_job',
    payload: {
      message: 'hello from queue every 2min',
    },
  };
}
