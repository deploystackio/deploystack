import { eq, and, lte, asc, sql } from 'drizzle-orm';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Job, JobBatch, JobOptions, JobStatus, JobStats } from '../types/jobs';
import { nanoid } from 'nanoid';
import { getSchema, getDbStatus } from '../db';

export class JobQueueService {
  private readonly db: AnyDatabase;
  private readonly logger: FastifyBaseLogger;
  private readonly queueJobs: ReturnType<typeof getSchema>['queueJobs'];
  private readonly queueJobBatches: ReturnType<typeof getSchema>['queueJobBatches'];
  private readonly dbType: 'postgresql';

  constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
    this.db = db;
    this.logger = logger;

    // Get schema dynamically based on database type
    const schema = getSchema();
    this.queueJobs = schema.queueJobs;
    this.queueJobBatches = schema.queueJobBatches;

    // Store database type for SQL query generation (PostgreSQL only)
    const dbStatus = getDbStatus();
    this.dbType = 'postgresql';
    if (dbStatus.type !== 'postgresql') {
      throw new Error('Only PostgreSQL is supported');
    }
  }

  /**
   * Create a new job
   */
  async createJob(type: string, payload: unknown, options?: JobOptions): Promise<Job> {
    try {
      const jobId = nanoid();
      const now = new Date();
      const scheduledFor = options?.scheduledFor || now;
      const maxAttempts = options?.maxAttempts || 3;
      const batchId = options?.batchId || null;

      const jobData = {
        id: jobId,
        type,
        payload: JSON.stringify(payload),
        status: 'pending' as JobStatus,
        scheduled_for: scheduledFor,
        attempts: 0,
        max_attempts: maxAttempts,
        error: null,
        batch_id: batchId,
        created_at: now,
        updated_at: now,
        completed_at: null,
      };

      await this.db.insert(this.queueJobs).values(jobData);
      
      this.logger.info({ jobId, type, scheduledFor, batchId }, 'Job created');
      
      return jobData as Job;
    } catch (error) {
      this.logger.error({ error, type }, 'Failed to create job');
      throw error;
    }
  }

  /**
   * Get the next pending job that's ready to be processed
   */
  async getNextPendingJob(): Promise<Job | null> {
    try {
      const now = new Date();
      
      const result = await this.db
        .select()
        .from(this.queueJobs)
        .where(
          and(
            eq(this.queueJobs.status, 'pending'),
            lte(this.queueJobs.scheduled_for, now)
          )
        )
        .orderBy(asc(this.queueJobs.scheduled_for))
        .limit(1);

      return result.length > 0 ? (result[0] as Job) : null;
    } catch (error) {
      this.logger.error({
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to get next pending job');
      throw error;
    }
  }

  /**
   * Mark a job as processing
   */
  async markJobProcessing(jobId: string): Promise<void> {
    try {
      await this.db
        .update(this.queueJobs)
        .set({
          status: 'processing',
          attempts: sql`${this.queueJobs.attempts} + 1`,
          updated_at: new Date(),
        })
        .where(eq(this.queueJobs.id, jobId));

      this.logger.debug({ jobId }, 'Job marked as processing');
    } catch (error) {
      this.logger.error({ error, jobId }, 'Failed to mark job as processing');
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: JobStatus, error?: string, result?: unknown): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        status,
        updated_at: new Date(),
      };

      if (status === 'completed') {
        updateData.completed_at = new Date();
      }

      if (status === 'failed' && error) {
        updateData.error = error;
      }

      if (result !== undefined) {
        updateData.result = JSON.stringify(result);
      }

      await this.db
        .update(this.queueJobs)
        .set(updateData)
        .where(eq(this.queueJobs.id, jobId));

      this.logger.info({ jobId, status, error }, 'Job status updated');
    } catch (error) {
      this.logger.error({ error, jobId, status }, 'Failed to update job status');
      throw error;
    }
  }

  /**
   * Requeue a failed job with a delay for retry
   */
  async requeueJob(jobId: string, delayMs: number): Promise<void> {
    try {
      const scheduledFor = new Date(Date.now() + delayMs);

      await this.db
        .update(this.queueJobs)
        .set({
          status: 'pending',
          scheduled_for: scheduledFor,
          updated_at: new Date(),
        })
        .where(eq(this.queueJobs.id, jobId));

      this.logger.info({ jobId, delayMs, scheduledFor }, 'Job requeued for retry');
    } catch (error) {
      this.logger.error({ error, jobId, delayMs }, 'Failed to requeue job');
      throw error;
    }
  }

  /**
   * Get a job by ID
   */
  async getJobById(jobId: string): Promise<Job | null> {
    try {
      const result = await this.db
        .select()
        .from(this.queueJobs)
        .where(eq(this.queueJobs.id, jobId))
        .limit(1);

      return result.length > 0 ? (result[0] as Job) : null;
    } catch (error) {
      this.logger.error({ error, jobId }, 'Failed to get job by ID');
      throw error;
    }
  }

  /**
   * Get all jobs for a batch
   */
  async getJobsByBatchId(batchId: string): Promise<Job[]> {
    try {
      const result = await this.db
        .select()
        .from(this.queueJobs)
        .where(eq(this.queueJobs.batch_id, batchId))
        .orderBy(asc(this.queueJobs.created_at));

      return result as Job[];
    } catch (error) {
      this.logger.error({ error, batchId }, 'Failed to get jobs by batch ID');
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<JobStats> {
    try {
      const result = await this.db
        .select({
          status: this.queueJobs.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(this.queueJobs)
        .groupBy(this.queueJobs.status);

      const stats: JobStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalToday: 0,
        averageDuration: 0,
      };

      for (const row of result) {
        const status = row.status as JobStatus;
        stats[status] = Number(row.count);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // PostgreSQL: use timestamp directly with Drizzle's gte operator
      const { gte } = await import('drizzle-orm');
      const todayResult = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(this.queueJobs)
        .where(gte(this.queueJobs.created_at, today));

      stats.totalToday = todayResult.length > 0 ? Number(todayResult[0].count) : 0;

      const avgDuration = await this.getAverageJobDuration();
      stats.averageDuration = avgDuration;

      return stats;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get job stats');
      throw error;
    }
  }

  /**
   * Create a new job batch
   */
  async createBatch(type: string, totalJobs: number, metadata?: unknown): Promise<JobBatch> {
    try {
      const batchId = nanoid();
      const now = new Date();

      const batchData = {
        id: batchId,
        type,
        total_jobs: totalJobs,
        completed_jobs: 0,
        failed_jobs: 0,
        status: 'pending' as JobStatus,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: now,
        completed_at: null,
      };

      await this.db.insert(this.queueJobBatches).values(batchData);

      this.logger.info({ batchId, type, totalJobs }, 'Job batch created');

      return batchData as JobBatch;
    } catch (error) {
      this.logger.error({ error, type, totalJobs }, 'Failed to create job batch');
      throw error;
    }
  }

  /**
   * Update batch total jobs count
   * Used when the actual number of jobs is determined after batch creation
   */
  async updateBatchTotalJobs(batchId: string, totalJobs: number): Promise<void> {
    try {
      await this.db
        .update(this.queueJobBatches)
        .set({
          total_jobs: totalJobs,
        })
        .where(eq(this.queueJobBatches.id, batchId));

      this.logger.info({ batchId, totalJobs }, 'Batch total_jobs updated');
    } catch (error) {
      this.logger.error({ error, batchId, totalJobs }, 'Failed to update batch total_jobs');
      throw error;
    }
  }

  /**
   * Update batch progress
   */
  async updateBatchProgress(batchId: string, completed: number, failed: number): Promise<void> {
    try {
      const batch = await this.db
        .select()
        .from(this.queueJobBatches)
        .where(eq(this.queueJobBatches.id, batchId))
        .limit(1);

      if (batch.length === 0) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const batchData = batch[0];
      const totalJobs = batchData.total_jobs;
      const isComplete = (completed + failed) >= totalJobs;
      const status = isComplete ? (failed > 0 ? 'failed' : 'completed') : 'processing';

      await this.db
        .update(this.queueJobBatches)
        .set({
          completed_jobs: completed,
          failed_jobs: failed,
          status,
          completed_at: isComplete ? new Date() : null,
        })
        .where(eq(this.queueJobBatches.id, batchId));

      this.logger.debug({ batchId, completed, failed, status }, 'Batch progress updated');
    } catch (error) {
      this.logger.error({ error, batchId, completed, failed }, 'Failed to update batch progress');
      throw error;
    }
  }

  /**
   * Get batch by ID
   */
  async getBatchById(batchId: string): Promise<JobBatch | null> {
    try {
      const result = await this.db
        .select()
        .from(this.queueJobBatches)
        .where(eq(this.queueJobBatches.id, batchId))
        .limit(1);

      return result.length > 0 ? (result[0] as JobBatch) : null;
    } catch (error) {
      this.logger.error({ error, batchId }, 'Failed to get batch by ID');
      throw error;
    }
  }

  /**
   * List jobs with filtering and pagination
   */
  async listJobs(options: {
    status?: JobStatus;
    type?: string;
    batchId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    try {
      const conditions = [];
      if (options.status) {
        conditions.push(eq(this.queueJobs.status, options.status));
      }
      if (options.type) {
        conditions.push(eq(this.queueJobs.type, options.type));
      }
      if (options.batchId) {
        conditions.push(eq(this.queueJobs.batch_id, options.batchId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [jobs, countResult] = await Promise.all([
        this.db
          .select()
          .from(this.queueJobs)
          .where(whereClause)
          .orderBy(sql`${this.queueJobs.created_at} DESC`)
          .limit(options.limit || 50)
          .offset(options.offset || 0),
        this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(this.queueJobs)
          .where(whereClause),
      ]);

      const total = countResult.length > 0 ? Number(countResult[0].count) : 0;

      return {
        jobs: jobs as Job[],
        total,
      };
    } catch (error) {
      this.logger.error({ error, options }, 'Failed to list jobs');
      throw error;
    }
  }

  /**
   * Get average job duration in milliseconds
   */
  async getAverageJobDuration(jobType?: string): Promise<number> {
    try {
      const conditions = [eq(this.queueJobs.status, 'completed')];
      if (jobType) {
        conditions.push(eq(this.queueJobs.type, jobType));
      }

      // PostgreSQL: EXTRACT(EPOCH FROM timestamp) returns seconds as decimal
      const avgDurationSQL = sql<number>`AVG(
        EXTRACT(EPOCH FROM ${this.queueJobs.completed_at} - ${this.queueJobs.created_at}) * 1000
      )`;

      const result = await this.db
        .select({
          avgDuration: avgDurationSQL,
        })
        .from(this.queueJobs)
        .where(and(...conditions, sql`${this.queueJobs.completed_at} IS NOT NULL`));

      return result.length > 0 && result[0].avgDuration !== null
        ? Number(result[0].avgDuration)
        : 0;
    } catch (error) {
      this.logger.error({ error, jobType }, 'Failed to get average job duration');
      throw error;
    }
  }

  /**
   * Get detailed batch progress with job breakdown
   */
  async getBatchProgress(batchId: string): Promise<{
    batch: JobBatch;
    progress: {
      total: number;
      completed: number;
      failed: number;
      pending: number;
      processing: number;
      percentage: number;
    };
    recentJobs: Job[];
    errors: Array<{
      jobId: string;
      error: string | null;
      attempts: number;
      createdAt: Date;
    }>;
    estimatedTimeRemaining: number | null;
  }> {
    try {
      // Get batch info
      const batchResult = await this.db
        .select()
        .from(this.queueJobBatches)
        .where(eq(this.queueJobBatches.id, batchId))
        .limit(1);
      
      if (batchResult.length === 0) {
        throw new Error(`Batch not found: ${batchId}`);
      }
      
      const batch = batchResult[0] as JobBatch;
      
      // Get job counts by status
      const jobCounts = await this.db
        .select({
          status: this.queueJobs.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(this.queueJobs)
        .where(eq(this.queueJobs.batch_id, batchId))
        .groupBy(this.queueJobs.status);
      
      // Calculate progress
      const statusCounts: Record<string, number> = {};
      for (const row of jobCounts) {
        statusCounts[row.status] = Number(row.count);
      }
      
      const total = batch.total_jobs;
      const completed = statusCounts.completed || 0;
      const failed = statusCounts.failed || 0;
      const pending = statusCounts.pending || 0;
      const processing = statusCounts.processing || 0;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Get recent jobs (last 10)
      const recentJobs = await this.db
        .select()
        .from(this.queueJobs)
        .where(eq(this.queueJobs.batch_id, batchId))
        .orderBy(sql`${this.queueJobs.created_at} DESC`)
        .limit(10);
      
      // Get failed jobs for error analysis
      const failedJobs = await this.db
        .select()
        .from(this.queueJobs)
        .where(
          and(
            eq(this.queueJobs.batch_id, batchId),
            eq(this.queueJobs.status, 'failed')
          )
        )
        .limit(20);
      
      // Estimate time remaining
      let estimatedTimeRemaining: number | null = null;
      if (pending > 0) {
        const avgDuration = await this.getAverageJobDuration(batch.type);
        if (avgDuration > 0) {
          estimatedTimeRemaining = pending * avgDuration;
        }
      }
      
      return {
        batch,
        progress: {
          total,
          completed,
          failed,
          pending,
          processing,
          percentage,
        },
        recentJobs: recentJobs as Job[],
        errors: failedJobs.map((job: Job) => ({
          jobId: job.id,
          error: job.error,
          attempts: job.attempts,
          createdAt: job.created_at,
        })),
        estimatedTimeRemaining,
      };
      
    } catch (error) {
      this.logger.error({ error, batchId }, 'Failed to get batch progress');
      throw error;
    }
  }

  /**
   * Get recent batches with metadata
   */
  async getRecentBatches(batchType: string, limit: number = 10): Promise<JobBatch[]> {
    try {
      const batches = await this.db
        .select()
        .from(this.queueJobBatches)
        .where(eq(this.queueJobBatches.type, batchType))
        .orderBy(sql`${this.queueJobBatches.created_at} DESC`)
        .limit(limit);
      
      return batches as JobBatch[];
    } catch (error) {
      this.logger.error({ error, batchType }, 'Failed to get recent batches');
      throw error;
    }
  }

  /**
   * Cancel all pending jobs in a batch
   */
  async cancelBatchJobs(batchId: string): Promise<number> {
    try {
      await this.db
        .update(this.queueJobs)
        .set({
          status: 'failed',
          error: 'Cancelled by administrator',
          updated_at: new Date(),
        })
        .where(
          and(
            eq(this.queueJobs.batch_id, batchId),
            eq(this.queueJobs.status, 'pending')
          )
        );
      
      // Count the cancelled jobs
      const cancelledJobs = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(this.queueJobs)
        .where(
          and(
            eq(this.queueJobs.batch_id, batchId),
            eq(this.queueJobs.status, 'failed'),
            eq(this.queueJobs.error, 'Cancelled by administrator')
          )
        );
      
      const count = cancelledJobs.length > 0 ? Number(cancelledJobs[0].count) : 0;
      
      this.logger.info({ batchId, count }, 'Cancelled batch jobs');
      
      return count;
    } catch (error) {
      this.logger.error({ error, batchId }, 'Failed to cancel batch jobs');
      throw error;
    }
  }

  /**
   * Retry all failed jobs in a batch
   */
  async retryFailedBatchJobs(batchId: string): Promise<number> {
    try {
      const now = new Date();
      
      await this.db
        .update(this.queueJobs)
        .set({
          status: 'pending',
          scheduled_for: now,
          attempts: 0,
          error: null,
          updated_at: now,
        })
        .where(
          and(
            eq(this.queueJobs.batch_id, batchId),
            eq(this.queueJobs.status, 'failed')
          )
        );
      
      // Count retried jobs
      const retriedJobs = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(this.queueJobs)
        .where(
          and(
            eq(this.queueJobs.batch_id, batchId),
            eq(this.queueJobs.status, 'pending'),
            eq(this.queueJobs.attempts, 0)
          )
        );
      
      const count = retriedJobs.length > 0 ? Number(retriedJobs[0].count) : 0;
      
      this.logger.info({ batchId, count }, 'Retried failed batch jobs');
      
      return count;
    } catch (error) {
      this.logger.error({ error, batchId }, 'Failed to retry batch jobs');
      throw error;
    }
  }
}
