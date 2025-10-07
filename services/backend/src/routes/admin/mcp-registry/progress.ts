import { type FastifyInstance } from 'fastify';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { ERROR_RESPONSE_SCHEMA, BATCH_ID_PARAM_SCHEMA, type ErrorResponse, type BatchIdParams } from './schemas';

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        batch: {
          type: 'object',
          description: 'Batch information'
        },
        progress: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
            pending: { type: 'number' },
            processing: { type: 'number' },
            percentage: { type: 'number' }
          }
        },
        recentJobs: {
          type: 'array',
          description: 'Recent jobs in batch (last 10)'
        },
        errors: {
          type: 'array',
          description: 'Failed jobs with error details'
        },
        estimatedTimeRemaining: {
          type: 'number',
          nullable: true,
          description: 'Estimated milliseconds until completion'
        }
      }
    }
  }
} as const;

interface SuccessResponse {
  success: boolean;
  data: {
    batch: unknown;
    progress: {
      total: number;
      completed: number;
      failed: number;
      pending: number;
      processing: number;
      percentage: number;
    };
    recentJobs: unknown[];
    errors: unknown[];
    estimatedTimeRemaining: number | null;
  };
}

/**
 * Get detailed batch progress
 * Provides real-time progress, job status, and error details for a sync batch
 */
export default async function progressRoute(server: FastifyInstance) {
  server.get('/admin/mcp-registry/progress/:batchId', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Get detailed sync progress for batch',
      description: 'Get real-time progress, job status, and error details for MCP Registry sync batch',
      security: [{ cookieAuth: [] }],
      
      params: BATCH_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Batch progress retrieved successfully'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { batchId } = request.params as BatchIdParams;
    
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, request.log);
      
      const batchProgress = await jobQueueService.getBatchProgress(batchId);
      
      const responseData: SuccessResponse = {
        success: true,
        data: batchProgress
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error, batchId }, 'Failed to get batch progress');
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get batch progress'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
