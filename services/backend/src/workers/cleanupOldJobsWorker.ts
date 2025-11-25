import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { queueJobs, queueJobBatches } from '../db/schema';
import { lt, sql } from 'drizzle-orm';

interface CleanupPayload {
  olderThanDays: number;
}

export class CleanupOldJobsWorker implements Worker {
  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {}

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    if (!this.isValidPayload(payload)) {
      return {
        success: false,
        message: 'Invalid payload format'
      };
    }

    const { olderThanDays } = payload as CleanupPayload;

    this.logger.info({ 
      jobId, 
      olderThanDays,
      operation: 'cleanup_old_jobs'
    }, 'Starting cleanup of old queue jobs');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Delete old jobs
      const jobsResult = await this.db
        .delete(queueJobs)
        .where(lt(queueJobs.created_at, cutoffDate));

      const jobsDeleted = (jobsResult.rowCount || 0);

      // Delete orphaned batches (batches with no jobs)
      const batchesResult = await this.db
        .delete(queueJobBatches)
        .where(
          sql`${queueJobBatches.id} NOT IN (SELECT DISTINCT ${queueJobs.batch_id} FROM ${queueJobs} WHERE ${queueJobs.batch_id} IS NOT NULL)`
        );

      const batchesDeleted = (batchesResult.rowCount || 0);

      this.logger.info({ 
        jobId,
        jobsDeleted,
        batchesDeleted,
        cutoffDate: cutoffDate.toISOString(),
        operation: 'cleanup_old_jobs'
      }, 'Cleanup completed successfully');

      return {
        success: true,
        message: `Deleted ${jobsDeleted} jobs and ${batchesDeleted} orphaned batches older than ${olderThanDays} days`,
        data: {
          jobsDeleted,
          batchesDeleted,
          cutoffDate: cutoffDate.toISOString()
        }
      };
    } catch (error) {
      this.logger.error({ 
        jobId, 
        error,
        operation: 'cleanup_old_jobs'
      }, 'Cleanup job failed');
      
      throw error;
    }
  }

  private isValidPayload(payload: unknown): payload is CleanupPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any;
    return typeof p.olderThanDays === 'number' && p.olderThanDays > 0;
  }
}
