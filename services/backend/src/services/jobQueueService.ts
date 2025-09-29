import { eq, and, lte, asc, sql } from 'drizzle-orm';
import { queueJobs, queueJobBatches } from '../db/schema.sqlite';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Job, JobBatch, JobOptions, JobStatus, JobStats } from '../types/jobs';
import { nanoid } from 'nanoid';

export class JobQueueService {
  private readonly db: AnyDatabase;
  private readonly logger: FastifyBaseLogger;

  constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
    this.db = db;
    this.logger = logger;
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

      await this.db.insert(queueJobs).values(jobData);
      
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
        .from(queueJobs)
        .where(
          and(
            eq(queueJobs.status, 'pending'),
            lte(queueJobs.scheduled_for, now)
          )
        )
        .orderBy(asc(queueJobs.scheduled_for))
        .limit(1);

      return result.length > 0 ? (result[0] as Job) : null;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get next pending job');
      throw error;
    }
  }

  /**
   * Mark a job as processing
   */
  async markJobProcessing(jobId: string): Promise<void> {
    try {
      await this.db
        .update(queueJobs)
        .set({
          status: 'processing',
          attempts: sql`${queueJobs.attempts} + 1`,
          updated_at: new Date(),
        })
        .where(eq(queueJobs.id, jobId));

      this.logger.debug({ jobId }, 'Job marked as processing');
    } catch (error) {
      this.logger.error({ error, jobId }, 'Failed to mark job as processing');
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: JobStatus, error?: string): Promise<void> {
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

      await this.db
        .update(queueJobs)
        .set(updateData)
        .where(eq(queueJobs.id, jobId));

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
        .update(queueJobs)
        .set({
          status: 'pending',
          scheduled_for: scheduledFor,
          updated_at: new Date(),
        })
        .where(eq(queueJobs.id, jobId));

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
        .from(queueJobs)
        .where(eq(queueJobs.id, jobId))
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
        .from(queueJobs)
        .where(eq(queueJobs.batch_id, batchId))
        .orderBy(asc(queueJobs.created_at));

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
          status: queueJobs.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(queueJobs)
        .groupBy(queueJobs.status);

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
      const todayTimestamp = Math.floor(today.getTime() / 1000); // Convert to Unix timestamp
      const todayResult = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(queueJobs)
        .where(sql`${queueJobs.created_at} >= ${todayTimestamp}`);
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

      await this.db.insert(queueJobBatches).values(batchData);

      this.logger.info({ batchId, type, totalJobs }, 'Job batch created');

      return batchData as JobBatch;
    } catch (error) {
      this.logger.error({ error, type, totalJobs }, 'Failed to create job batch');
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
        .from(queueJobBatches)
        .where(eq(queueJobBatches.id, batchId))
        .limit(1);

      if (batch.length === 0) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const batchData = batch[0];
      const totalJobs = batchData.total_jobs;
      const isComplete = (completed + failed) >= totalJobs;
      const status = isComplete ? (failed > 0 ? 'failed' : 'completed') : 'processing';

      await this.db
        .update(queueJobBatches)
        .set({
          completed_jobs: completed,
          failed_jobs: failed,
          status,
          completed_at: isComplete ? new Date() : null,
        })
        .where(eq(queueJobBatches.id, batchId));

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
        .from(queueJobBatches)
        .where(eq(queueJobBatches.id, batchId))
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
        conditions.push(eq(queueJobs.status, options.status));
      }
      if (options.type) {
        conditions.push(eq(queueJobs.type, options.type));
      }
      if (options.batchId) {
        conditions.push(eq(queueJobs.batch_id, options.batchId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [jobs, countResult] = await Promise.all([
        this.db
          .select()
          .from(queueJobs)
          .where(whereClause)
          .orderBy(sql`${queueJobs.created_at} DESC`)
          .limit(options.limit || 50)
          .offset(options.offset || 0),
        this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(queueJobs)
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
      const conditions = [eq(queueJobs.status, 'completed')];
      if (jobType) {
        conditions.push(eq(queueJobs.type, jobType));
      }

      const result = await this.db
        .select({
          avgDuration: sql<number>`AVG(
            CAST((julianday(${queueJobs.completed_at}) - julianday(${queueJobs.created_at})) * 86400000 AS INTEGER)
          )`,
        })
        .from(queueJobs)
        .where(and(...conditions, sql`${queueJobs.completed_at} IS NOT NULL`));

      return result.length > 0 && result[0].avgDuration !== null
        ? Number(result[0].avgDuration)
        : 0;
    } catch (error) {
      this.logger.error({ error, jobType }, 'Failed to get average job duration');
      throw error;
    }
  }
}
