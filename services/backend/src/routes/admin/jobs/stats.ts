import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import {
  JOB_STATS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type JobStatsResponse,
  type ErrorResponse
} from './schemas';

export default async function getJobStatsRoute(server: FastifyInstance) {
  server.get('/admin/jobs/stats', {
    preValidation: requirePermission('jobs.monitor'),
    schema: {
      tags: ['Jobs'],
      summary: 'Get job statistics',
      description:
        'Get aggregate statistics about the job queue, including counts by status, daily totals, and average processing duration. Requires global_admin role with jobs.monitor permission.',
      security: [{ cookieAuth: [] }],

      response: {
        200: {
          ...JOB_STATS_RESPONSE_SCHEMA,
          description: 'Job statistics retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Requires global_admin role with jobs.monitor permission'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, server.log);

      const stats = await jobQueueService.getJobStats();

      const successResponse: JobStatsResponse = {
        success: true,
        stats
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching job statistics');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch job statistics'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
