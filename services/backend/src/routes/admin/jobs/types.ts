import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { queueJobs } from '../../../db/schema.sqlite';
import { ERROR_RESPONSE_SCHEMA } from './schemas';

const JOB_TYPES_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    types: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of unique job types found in the queue'
    },
    count: {
      type: 'number',
      description: 'Total number of unique job types'
    }
  },
  required: ['success', 'types', 'count']
} as const;

interface JobTypesResponse {
  success: boolean;
  types: string[];
  count: number;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function getJobTypesRoute(server: FastifyInstance) {
  server.get('/admin/jobs/types', {
    preValidation: requirePermission('jobs.view'),
    schema: {
      tags: ['Jobs'],
      summary: 'Get all unique job types',
      description:
        'Returns an array of all unique job types currently in the queue. Requires global_admin role with jobs.view permission.',
      security: [{ cookieAuth: [] }],

      response: {
        200: {
          ...JOB_TYPES_RESPONSE_SCHEMA,
          description: 'Job types retrieved successfully'
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
      const db = getDb();

      // Efficient query: DISTINCT + ORDER BY uses the type_idx index
      // Database returns only unique types (not 10,000 rows, maybe 5-20 unique types)
      const result = await db
        .selectDistinct({ type: queueJobs.type })
        .from(queueJobs)
        .orderBy(queueJobs.type);

      const types = result.map((row: { type: string }) => row.type);

      const successResponse: JobTypesResponse = {
        success: true,
        types,
        count: types.length
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching job types');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch job types'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
