import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Job, WorkerResult } from '../types/jobs';
import { JobQueueService } from './jobQueueService';
import type { Worker } from '../workers/types';

export class JobProcessorService {
  private readonly db: AnyDatabase;
  private readonly logger: FastifyBaseLogger;
  private readonly jobQueueService: JobQueueService;
  private readonly workers: Map<string, Worker>;
  
  private isRunning: boolean = false;
  private currentJobId: string | null = null;
  private readonly pollInterval: number = 1000; // 1 second

  constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
    this.db = db;
    this.logger = logger;
    this.jobQueueService = new JobQueueService(db, logger);
    this.workers = new Map();
  }

  /**
   * Start the background job processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Job processor is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Job processor started');

    // Start the polling loop
    this.pollLoop().catch((error) => {
      this.logger.error({ error }, 'Fatal error in job processor poll loop');
      this.isRunning = false;
    });
  }

  /**
   * Stop the background job processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Job processor is not running');
      return;
    }

    this.logger.info('Stopping job processor...');
    this.isRunning = false;

    // Wait for current job to complete (with timeout)
    if (this.currentJobId) {
      this.logger.info({ jobId: this.currentJobId }, 'Waiting for current job to complete');
      await this.waitForCurrentJob(30000); // 30 second timeout
    }

    this.logger.info('Job processor stopped');
  }

  /**
   * Register a worker for a specific job type
   */
  registerWorker(jobType: string, worker: Worker): void {
    if (this.workers.has(jobType)) {
      this.logger.warn({ jobType }, 'Worker already registered, replacing');
    }

    this.workers.set(jobType, worker);
    this.logger.info({ jobType }, 'Worker registered');
  }

  /**
   * Main polling loop - runs continuously while isRunning is true
   */
  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processNextJob();
      } catch (error) {
        this.logger.error({ error }, 'Error processing job');
      }

      // Sleep before next poll
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Process the next pending job
   */
  private async processNextJob(): Promise<void> {
    try {
      const job = await this.jobQueueService.getNextPendingJob();

      if (!job) {
        return; // No jobs to process
      }

      this.currentJobId = job.id;

      try {
        await this.executeJob(job);
      } finally {
        this.currentJobId = null;
      }
    } catch (error) {
      this.logger.error({
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Error in processNextJob');
    }
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: Job): Promise<void> {
    try {
      // Mark job as processing
      await this.jobQueueService.markJobProcessing(job.id);

      // Get the worker for this job type
      const worker = this.workers.get(job.type);

      if (!worker) {
        const error = `No worker registered for job type: ${job.type}`;
        this.logger.error({ jobId: job.id, jobType: job.type }, error);
        await this.jobQueueService.updateJobStatus(job.id, 'failed', error);
        return;
      }

      // Parse payload
      let payload: unknown;
      try {
        payload = JSON.parse(job.payload);
      } catch (error) {
        const errorMsg = `Invalid JSON payload: ${error}`;
        this.logger.error({ jobId: job.id, error }, errorMsg);
        await this.jobQueueService.updateJobStatus(job.id, 'failed', errorMsg);
        return;
      }

      // Execute the worker
      this.logger.trace({ jobId: job.id, jobType: job.type, attempt: job.attempts + 1 }, 'Executing job');

      const result: WorkerResult = await worker.execute(payload, job.id);

      if (result.success) {
        await this.jobQueueService.updateJobStatus(job.id, 'completed', undefined, result.data);
        this.logger.trace({ jobId: job.id, jobType: job.type }, 'Job completed successfully');

        // Update batch progress if job is part of a batch
        if (job.batch_id) {
          await this.updateBatchProgress(job.batch_id);
        }
      } else {
        throw new Error(result.message || 'Worker execution failed');
      }
    } catch (error) {
      await this.handleJobFailure(job, error as Error);
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: Job, error: Error): Promise<void> {
    const attempts = job.attempts + 1; // +1 because we just incremented it in markJobProcessing
    const maxAttempts = job.max_attempts;

    this.logger.error({
      jobId: job.id,
      jobType: job.type,
      error: error.message,
      attempt: attempts,
      maxAttempts,
    }, 'Job execution failed');

    if (attempts < maxAttempts) {
      // Calculate exponential backoff delay: 2^attempts * 1000ms
      const delayMs = Math.pow(2, attempts) * 1000;
      
      await this.jobQueueService.requeueJob(job.id, delayMs);
      
      this.logger.info({
        jobId: job.id,
        attempt: attempts,
        maxAttempts,
        delayMs,
        nextRetry: new Date(Date.now() + delayMs),
      }, 'Job requeued for retry');
    } else {
      await this.jobQueueService.updateJobStatus(job.id, 'failed', error.message);
      
      this.logger.error({
        jobId: job.id,
        jobType: job.type,
        attempts,
      }, 'Job failed after max attempts');

      // Update batch progress if job is part of a batch
      if (job.batch_id) {
        await this.updateBatchProgress(job.batch_id);
      }
    }
  }

  /**
   * Update batch progress after a job completes or fails
   */
  private async updateBatchProgress(batchId: string): Promise<void> {
    try {
      const jobs = await this.jobQueueService.getJobsByBatchId(batchId);
      
      const completed = jobs.filter(j => j.status === 'completed').length;
      const failed = jobs.filter(j => j.status === 'failed').length;

      await this.jobQueueService.updateBatchProgress(batchId, completed, failed);
    } catch (error) {
      this.logger.error({ error, batchId }, 'Failed to update batch progress');
    }
  }

  /**
   * Wait for the current job to complete (with timeout)
   */
  private async waitForCurrentJob(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (this.currentJobId !== null) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Timeout waiting for current job to complete');
      }

      await this.sleep(100); // Check every 100ms
    }
  }

  /**
   * Sleep helper function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the current state of the processor
   */
  getState(): { isRunning: boolean; currentJobId: string | null; workerCount: number } {
    return {
      isRunning: this.isRunning,
      currentJobId: this.currentJobId,
      workerCount: this.workers.size,
    };
  }

  /**
   * Get list of registered worker types
   */
  getRegisteredWorkerTypes(): string[] {
    return Array.from(this.workers.keys());
  }
}
