import { FastifyBaseLogger } from 'fastify';
import { Job, JobStats } from './base-job';

/**
 * Job Manager
 * 
 * Manages the lifecycle of all recurring jobs in the satellite.
 * Provides centralized control for starting, stopping, and monitoring jobs.
 */
export class JobManager {
  private jobs: Map<string, Job> = new Map();
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Register a job with the manager
   */
  register(job: Job): void {
    if (this.jobs.has(job.name)) {
      this.logger.warn({
        operation: 'job_already_registered',
        job_name: job.name
      }, `Job "${job.name}" is already registered - replacing existing job`);
    }

    this.jobs.set(job.name, job);

    this.logger.info({
      operation: 'job_registered',
      job_name: job.name,
      interval_ms: job.interval,
      interval_seconds: Math.round(job.interval / 1000)
    }, `Registered job "${job.name}" (${Math.round(job.interval / 1000)}s interval)`);
  }

  /**
   * Start all registered jobs
   */
  async startAll(): Promise<void> {
    this.logger.info({
      operation: 'jobs_start_all',
      job_count: this.jobs.size
    }, `Starting ${this.jobs.size} registered jobs...`);

    for (const [name, job] of this.jobs) {
      try {
        job.start();
        
        this.logger.info({
          operation: 'job_started',
          job_name: name
        }, `Job "${name}" started successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error({
          operation: 'job_start_failed',
          job_name: name,
          error: errorMessage
        }, `Failed to start job "${name}": ${errorMessage}`);
      }
    }

    this.logger.info({
      operation: 'jobs_started',
      job_count: this.jobs.size,
      running_jobs: this.getRunningCount()
    }, `Started ${this.getRunningCount()}/${this.jobs.size} jobs successfully`);
  }

  /**
   * Stop all running jobs
   */
  async stopAll(): Promise<void> {
    this.logger.info({
      operation: 'jobs_stop_all',
      job_count: this.jobs.size,
      running_jobs: this.getRunningCount()
    }, `Stopping ${this.getRunningCount()} running jobs...`);

    for (const [name, job] of this.jobs) {
      try {
        if (job.isRunning()) {
          job.stop();
          
          this.logger.info({
            operation: 'job_stopped',
            job_name: name
          }, `Job "${name}" stopped successfully`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error({
          operation: 'job_stop_failed',
          job_name: name,
          error: errorMessage
        }, `Failed to stop job "${name}": ${errorMessage}`);
      }
    }

    this.logger.info({
      operation: 'jobs_stopped',
      job_count: this.jobs.size
    }, 'All jobs stopped');
  }

  /**
   * Start a specific job by name
   */
  start(jobName: string): void {
    const job = this.jobs.get(jobName);
    
    if (!job) {
      this.logger.error({
        operation: 'job_not_found',
        job_name: jobName
      }, `Cannot start job "${jobName}" - not registered`);
      return;
    }

    job.start();
  }

  /**
   * Stop a specific job by name
   */
  stop(jobName: string): void {
    const job = this.jobs.get(jobName);
    
    if (!job) {
      this.logger.error({
        operation: 'job_not_found',
        job_name: jobName
      }, `Cannot stop job "${jobName}" - not registered`);
      return;
    }

    job.stop();
  }

  /**
   * Get statistics for all jobs
   */
  getAllStats(): JobStats[] {
    const stats: JobStats[] = [];
    
    for (const job of this.jobs.values()) {
      stats.push(job.getStats());
    }

    return stats;
  }

  /**
   * Get statistics for a specific job
   */
  getStats(jobName: string): JobStats | undefined {
    const job = this.jobs.get(jobName);
    return job ? job.getStats() : undefined;
  }

  /**
   * Get count of running jobs
   */
  private getRunningCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.isRunning()) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get list of all registered job names
   */
  getRegisteredJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  /**
   * Check if a specific job is registered
   */
  hasJob(jobName: string): boolean {
    return this.jobs.has(jobName);
  }

  /**
   * Remove a job from the manager (stops it first if running)
   */
  unregister(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    
    if (!job) {
      return false;
    }

    if (job.isRunning()) {
      job.stop();
    }

    this.jobs.delete(jobName);

    this.logger.info({
      operation: 'job_unregistered',
      job_name: jobName
    }, `Unregistered job "${jobName}"`);

    return true;
  }
}

// Export job types for convenience
export { Job, JobStats } from './base-job';
export { BaseJob } from './base-job';
export { HeartbeatJob } from './heartbeat-job';
export { McpActivityReportJob } from './mcp-activity-report-job';
export { IdleProcessCleanupJob } from './idle-process-cleanup-job';
