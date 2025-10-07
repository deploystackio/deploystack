import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { queueJobs } from '../../../db/schema.sqlite';
import { and, eq, gte, lte, like, desc } from 'drizzle-orm';
import {
  ERROR_RESPONSE_SCHEMA,
  JOB_LIST_RESPONSE_SCHEMA,
  type JobListResponse,
  type ErrorResponse
} from './schemas';

const SEARCH_JOBS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Filter by job ID (partial match)'
    },
    type: {
      type: 'string',
      description: 'Filter by job type (exact match)'
    },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
      description: 'Filter by job status'
    },
    created_after: {
      type: 'string',
      format: 'date-time',
      description: 'Filter jobs created after this timestamp (ISO 8601)'
    },
    created_before: {
      type: 'string',
      format: 'date-time',
      description: 'Filter jobs created before this timestamp (ISO 8601)'
    },
    limit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum number of jobs to return (1-100, default: 50)'
    },
    offset: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Number of jobs to skip (≥0, default: 0)'
    }
  },
  additionalProperties: false
} as const;

interface SearchJobsQuery {
  id?: string;
  type?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  created_after?: string;
  created_before?: string;
  limit?: string;
  offset?: string;
}

export default async function searchJobsRoute(server: FastifyInstance) {
  server.get('/admin/jobs/search', {
    preValidation: requirePermission('jobs.view'),
    schema: {
      tags: ['Jobs'],
      summary: 'Search jobs with filters',
      description:
        'Search jobs with multiple filter criteria. Supports filtering by ID, type, status, and creation time range. Results are ordered by creation time (newest first). Requires global_admin role with jobs.view permission.',
      security: [{ cookieAuth: [] }],

      querystring: SEARCH_JOBS_QUERY_SCHEMA,

      response: {
        200: {
          ...JOB_LIST_RESPONSE_SCHEMA,
          description: 'Jobs retrieved successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid parameters'
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
      const query = request.query as SearchJobsQuery;

      // Parse and validate pagination parameters
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

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

      // Parse and validate datetime filters
      let createdAfter: Date | undefined;
      let createdBefore: Date | undefined;

      if (query.created_after) {
        createdAfter = new Date(query.created_after);
        if (isNaN(createdAfter.getTime())) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Invalid created_after date format. Use ISO 8601 format.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      if (query.created_before) {
        createdBefore = new Date(query.created_before);
        if (isNaN(createdBefore.getTime())) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Invalid created_before date format. Use ISO 8601 format.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      // Build filter conditions
      const conditions = [];

      if (query.id) {
        conditions.push(like(queueJobs.id, `%${query.id}%`));
      }

      if (query.type) {
        conditions.push(eq(queueJobs.type, query.type));
      }

      if (query.status) {
        conditions.push(eq(queueJobs.status, query.status));
      }

      if (createdAfter) {
        conditions.push(gte(queueJobs.created_at, createdAfter));
      }

      if (createdBefore) {
        conditions.push(lte(queueJobs.created_at, createdBefore));
      }

      const db = getDb();

      // Get total count with filters
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const allJobs = whereClause
        ? await db.select().from(queueJobs).where(whereClause)
        : await db.select().from(queueJobs);

      const total = allJobs.length;

      // Get paginated results with ordering
      const jobs = whereClause
        ? await db
            .select()
            .from(queueJobs)
            .where(whereClause)
            .orderBy(desc(queueJobs.created_at))
            .limit(limit)
            .offset(offset)
        : await db
            .select()
            .from(queueJobs)
            .orderBy(desc(queueJobs.created_at))
            .limit(limit)
            .offset(offset);

      const hasMore = offset + limit < total;

      server.log.info({
        operation: 'search_jobs',
        filters: {
          id: query.id,
          type: query.type,
          status: query.status,
          created_after: query.created_after,
          created_before: query.created_before
        },
        totalResults: total,
        returnedResults: jobs.length,
        pagination: { limit, offset }
      }, 'Jobs search completed');

      const successResponse: JobListResponse = {
        success: true,
        data: {
          jobs: jobs.map((job: typeof queueJobs.$inferSelect) => ({
            id: job.id,
            type: job.type,
            payload: JSON.parse(job.payload),
            status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
            scheduled_for: job.scheduled_for,
            attempts: job.attempts,
            max_attempts: job.max_attempts,
            error: job.error,
            batch_id: job.batch_id,
            created_at: job.created_at,
            updated_at: job.updated_at,
            completed_at: job.completed_at
          })),
          pagination: {
            total,
            limit,
            offset,
            has_more: hasMore
          }
        }
      };

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error, operation: 'search_jobs' }, 'Error searching jobs');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to search jobs'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
