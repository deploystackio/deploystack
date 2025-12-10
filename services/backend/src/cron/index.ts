import type { FastifyBaseLogger } from 'fastify';
import type { JobQueueService } from '../services/jobQueueService';
import { CronManager } from './cronManager';
import { createMcpClientActivityMetricsCleanupJob } from './jobs/mcpClientActivityMetricsCleanup';
import { createCleanupOldJobsJob } from './jobs/cleanupOldJobs';
import { createRefreshOAuthTokensJob } from './jobs/refreshOAuthTokens';
import { createCleanupSatelliteHeartbeatsJob } from './jobs/cleanupSatelliteHeartbeats';
import { createCleanupMcpServerLogsJob } from './jobs/cleanupMcpServerLogs';
import { createMcpHealthCheckJob } from './jobs/mcpHealthCheck';
import { createMcpCredentialValidationJob } from './jobs/mcpCredentialValidation';
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
 * The CronManager handles job creation automatically when cron schedules fire.
 * Each cron job definition specifies the jobType and payload, and the CronManager
 * creates the job record in the queue immediately.
 *
 * @param jobQueueService - Job queue service for creating background jobs
 * @param logger - Logger instance
 * @returns CronManager instance
 */
export function initializeCronJobs(
  jobQueueService: JobQueueService,
  logger: FastifyBaseLogger
): CronManager {
  const cronManager = new CronManager(logger, jobQueueService);

  // MCP client activity metrics cleanup (every 30 minutes)
  cronManager.register(createMcpClientActivityMetricsCleanupJob());

  // Cleanup old queue jobs (every 6 hours)
  cronManager.register(createCleanupOldJobsJob());

  // Refresh expiring OAuth tokens for MCP servers (every 5 minutes)
  cronManager.register(createRefreshOAuthTokensJob());

  // Cleanup satellite heartbeats (every 3 minutes)
  cronManager.register(createCleanupSatelliteHeartbeatsJob());

  // Cleanup MCP server logs (every 10 minutes, 100-line limit per installation)
  cronManager.register(createCleanupMcpServerLogsJob());

  // MCP health check (every 3 minutes, cumulative at template level)
  cronManager.register(createMcpHealthCheckJob());

  // MCP credential validation (every 1 minute, per-installation 15-min interval)
  cronManager.register(createMcpCredentialValidationJob());

  // Example cron job - commented out, uncomment to test
  // cronManager.register(createExampleCronJob());

  // Add your cron jobs here
  // Example:
  // cronManager.register(createDailyBackupJob());
  // cronManager.register(createHourlyCleanupJob());

  return cronManager;
}
