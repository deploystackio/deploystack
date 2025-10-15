import * as cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';

/**
 * CronJob interface - each cron job file must export this structure
 */
export interface CronJob {
  /** Cron schedule expression (e.g., every 2 minutes, hourly, daily) */
  schedule: string;
  
  /** Optional job name for logging */
  name?: string;
  
  /** The task function to execute */
  task: () => void | Promise<void>;
}

/**
 * CronManager - Manages all cron jobs in the application
 * 
 * This class discovers, registers, and manages all cron jobs.
 * It provides lifecycle management including graceful shutdown.
 */
export class CronManager {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Register a new cron job
   * 
   * @param jobDefinition - The cron job definition
   */
  register(jobDefinition: CronJob): void {
    const jobName = jobDefinition.name || 'unnamed-job';

    try {
      const task = cron.schedule(jobDefinition.schedule, async () => {
        this.logger.info({ 
          job: jobName, 
          schedule: jobDefinition.schedule 
        }, 'Executing cron job');

        try {
          await jobDefinition.task();
          this.logger.debug({ job: jobName }, 'Cron job completed successfully');
        } catch (error) {
          this.logger.error({ 
            job: jobName, 
            error 
          }, 'Cron job execution failed');
        }
      });

      this.jobs.set(jobName, task);
      this.logger.info({ 
        job: jobName, 
        schedule: jobDefinition.schedule 
      }, 'Cron job registered');

    } catch (error) {
      this.logger.error({ 
        job: jobName, 
        schedule: jobDefinition.schedule, 
        error 
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
