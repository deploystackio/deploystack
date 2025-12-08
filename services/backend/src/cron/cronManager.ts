import * as cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import type { JobQueueService } from '../services/jobQueueService';

/**
 * CronJob interface - each cron job file must export this structure
 *
 * The CronManager will automatically create a job in the queue when the cron fires.
 * This ensures job records exist immediately for visibility in the admin panel,
 * even if something fails during job creation or execution.
 */
export interface CronJob {
  /** Cron schedule expression (e.g., every 2 minutes, hourly, daily) */
  schedule: string;

  /** Job name for logging and identification (required) */
  name: string;

  /** The job type that will be created in the queue (must match a registered worker) */
  jobType: string;

  /**
   * Payload to pass to the worker. Can be a static object or a function that returns an object.
   * Use a function when payload needs to be computed at cron fire time.
   */
  payload?: Record<string, unknown> | (() => Record<string, unknown>);

  /** Maximum retry attempts for this job (default: 3) */
  maxAttempts?: number;
}

/**
 * CronManager - Manages all cron jobs in the application
 *
 * This class discovers, registers, and manages all cron jobs.
 * It provides lifecycle management including graceful shutdown.
 *
 * Key design: When a cron schedule fires, the CronManager immediately creates
 * a job record in the database queue. This ensures visibility in the admin panel
 * even if something fails during job creation or worker execution.
 */
export class CronManager {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private readonly logger: FastifyBaseLogger;
  private readonly jobQueueService: JobQueueService;

  constructor(logger: FastifyBaseLogger, jobQueueService: JobQueueService) {
    this.logger = logger;
    this.jobQueueService = jobQueueService;
  }

  /**
   * Register a new cron job
   *
   * When the cron schedule fires, this method immediately creates a job record
   * in the database queue. The job is then processed by the JobProcessorService.
   *
   * @param jobDefinition - The cron job definition
   */
  register(jobDefinition: CronJob): void {
    const { name: jobName, schedule, jobType, payload, maxAttempts } = jobDefinition;

    try {
      const task = cron.schedule(schedule, async () => {
        this.logger.info({
          job: jobName,
          jobType,
          schedule,
        }, 'Cron triggered, creating job in queue');

        try {
          // Calculate payload - can be static object or function
          const resolvedPayload = typeof payload === 'function'
            ? payload()
            : payload ?? {};

          // Create job in queue immediately - this is the key change
          const job = await this.jobQueueService.createJob(
            jobType,
            resolvedPayload,
            maxAttempts ? { maxAttempts } : undefined
          );

          this.logger.info({
            job: jobName,
            jobId: job.id,
            jobType,
          }, 'Cron job queued successfully');
        } catch (error) {
          this.logger.error({
            job: jobName,
            jobType,
            error,
          }, 'Failed to queue cron job');
        }
      });

      this.jobs.set(jobName, task);
      this.logger.info({
        job: jobName,
        jobType,
        schedule,
      }, 'Cron job registered');
    } catch (error) {
      this.logger.error({
        job: jobName,
        jobType,
        schedule,
        error,
      }, 'Failed to register cron job');
    }
  }

  /**
   * Start all registered cron jobs
   */
  start(): void {
    this.logger.info({ count: this.jobs.size }, 'Cron jobs are running (auto-started on schedule)');
  }

  /**
   * Stop all cron jobs gracefully
   */
  stop(): void {
    this.logger.info({ count: this.jobs.size }, 'Stopping cron jobs');
    
    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      this.logger.debug({ job: name }, 'Cron job stopped');
    }

    this.jobs.clear();
    this.logger.info('All cron jobs stopped successfully');
  }

  /**
   * Get list of registered job names
   */
  getJobNames(): string[] {
    return Array.from(this.jobs.keys());
  }
}
