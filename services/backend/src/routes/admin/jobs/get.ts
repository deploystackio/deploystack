import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import {
  JOB_ID_PARAMS_SCHEMA,
  JOB_DETAIL_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type JobIdParams,
  type JobDetailResponse,
  type ErrorResponse
} from './schemas';

export default async function getJobRoute(server: FastifyInstance) {
  server.get('/admin/jobs/:id', {
    preValidation: requirePermission('jobs.view'),
    schema: {
      tags: ['Jobs'],
      summary: 'Get job details',
      description:
        'Get detailed information about a specific job by its ID. Requires global_admin role with jobs.view permission.',
      security: [{ cookieAuth: [] }],

      params: JOB_ID_PARAMS_SCHEMA,

      response: {
        200: {
          ...JOB_DETAIL_RESPONSE_SCHEMA,
          description: 'Job details retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Requires global_admin role with jobs.view permission'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Job not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as JobIdParams;

      const db = getDb();
      const jobQueueService = new JobQueueService(db, server.log);

      const job = await jobQueueService.getJobById(id);

      if (!job) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Job not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: JobDetailResponse = {
        success: true,
        job
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching job details');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch job details'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
