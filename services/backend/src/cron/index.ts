import type { FastifyBaseLogger } from 'fastify';
import type { JobQueueService } from '../services/jobQueueService';
import { CronManager } from './cronManager';
import { createMcpClientActivityMetricsCleanupJob } from './jobs/mcpClientActivityMetricsCleanup';
// import { createExampleCronJob } from './jobs/exampleJob';

/**
 * Initialize and register all cron jobs
 * 
 * This function is called during server startup to set up all cron jobs.
 * Add new cron jobs by:
 * 1. Creating a job file in the jobs/ directory
 * 2. Importing it here
 * 3. Registering it with the CronManager
 * 
 * @param jobQueueService - Job queue service for creating background jobs
 * @param logger - Logger instance
 * @returns CronManager instance
 */
export function initializeCronJobs(
  jobQueueService: JobQueueService,
  logger: FastifyBaseLogger
): CronManager {
  const cronManager = new CronManager(logger);

  // MCP client activity metrics cleanup (every 30 minutes)
  cronManager.register(createMcpClientActivityMetricsCleanupJob(jobQueueService));

  // Example cron job - commented out, uncomment to test
  // cronManager.register(createExampleCronJob(jobQueueService));

  // Add your cron jobs here
  // Example:
  // cronManager.register(createDailyBackupJob(jobQueueService));
  // cronManager.register(createHourlyCleanupJob(jobQueueService));

  return cronManager;
}
