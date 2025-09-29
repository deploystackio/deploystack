import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import {
  LIST_JOBS_QUERY_SCHEMA,
  JOB_LIST_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ListJobsQuery,
  type JobListResponse,
  type ErrorResponse
} from './schemas';

export default async function listJobsRoute(server: FastifyInstance) {
  server.get('/admin/jobs', {
    preValidation: requirePermission('jobs.view'),
    schema: {
      tags: ['Jobs'],
      summary: 'List all jobs',
      description:
        'List jobs with filtering and pagination. Supports filtering by status and job type. Requires global_admin role with jobs.view permission.',
      security: [{ cookieAuth: [] }],

      querystring: LIST_JOBS_QUERY_SCHEMA,

      response: {
        200: {
          ...JOB_LIST_RESPONSE_SCHEMA,
          description: 'Jobs retrieved successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid pagination parameters'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Requires global_admin role with jobs.view permission'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as ListJobsQuery;
      
      // Parse and validate pagination parameters (query params are strings)
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      // Validate parsed parameters
      if (isNaN(limit) || limit < 1 || limit > 100) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Limit must be between 1 and 100'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      if (isNaN(offset) || offset < 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Offset must be non-negative'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      const db = getDb();
      const jobQueueService = new JobQueueService(db, server.log);

      const result = await jobQueueService.listJobs({
        status: query.status,
        type: query.type,
        limit,
        offset
      });

      // Calculate has_more
      const hasMore = offset + limit < result.total;

      const successResponse: JobListResponse = {
        success: true,
        data: {
          jobs: result.jobs,
          pagination: {
            total: result.total,
            limit,
            offset,
            has_more: hasMore
          }
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error listing jobs');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to list jobs'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
