import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import {
  BATCH_ID_PARAMS_SCHEMA,
  BATCH_STATUS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type BatchIdParams,
  type BatchStatusResponse,
  type BatchInfo,
  type ErrorResponse
} from './schemas';

export default async function getBatchStatusRoute(server: FastifyInstance) {
  server.get('/admin/jobs/batches/:batchId', {
    preValidation: requirePermission('jobs.monitor'),
    schema: {
      tags: ['Jobs'],
      summary: 'Get batch status',
      description:
        'Get progress and status of a job batch, including completion progress, estimated completion time, and recent jobs. Requires global_admin role with jobs.monitor permission.',
      security: [{ cookieAuth: [] }],

      params: BATCH_ID_PARAMS_SCHEMA,

      response: {
        200: {
          ...BATCH_STATUS_RESPONSE_SCHEMA,
          description: 'Batch status retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Requires global_admin role with jobs.monitor permission'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Batch not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { batchId } = request.params as BatchIdParams;

      const db = getDb();
      const jobQueueService = new JobQueueService(db, server.log);

      const batch = await jobQueueService.getBatchById(batchId);

      if (!batch) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Batch not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const recentJobs = await jobQueueService.listJobs({
        batchId,
        limit: 10,
        offset: 0
      });

      const progress = batch.total_jobs > 0 
        ? (batch.completed_jobs + batch.failed_jobs) / batch.total_jobs 
        : 0;

      let estimatedCompletion: string | null = null;
      if (batch.status === 'processing' && progress > 0 && progress < 1) {
        const completedJobs = batch.completed_jobs + batch.failed_jobs;
        const remainingJobs = batch.total_jobs - completedJobs;
        const avgJobTime = await jobQueueService.getAverageJobDuration(batch.type);
        
        if (avgJobTime > 0) {
          const estimatedMs = remainingJobs * avgJobTime;
          const minutes = Math.ceil(estimatedMs / 60000);
          estimatedCompletion = minutes < 60 
            ? `${minutes} minute${minutes !== 1 ? 's' : ''}`
            : `${Math.ceil(minutes / 60)} hour${Math.ceil(minutes / 60) !== 1 ? 's' : ''}`;
        }
      }

      const batchInfo: BatchInfo = {
        id: batch.id,
        type: batch.type,
        totalJobs: batch.total_jobs,
        completedJobs: batch.completed_jobs,
        failedJobs: batch.failed_jobs,
        status: batch.status,
        progress,
        estimatedCompletion,
        createdAt: batch.created_at,
        completedAt: batch.completed_at
      };

      const successResponse: BatchStatusResponse = {
        success: true,
        batch: batchInfo,
        recentJobs: recentJobs.jobs
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching batch status');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch batch status'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
