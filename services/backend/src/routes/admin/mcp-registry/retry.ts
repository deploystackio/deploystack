import { type FastifyInstance } from 'fastify';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { ERROR_RESPONSE_SCHEMA, BATCH_ID_PARAM_SCHEMA, type ErrorResponse, type BatchIdParams } from './schemas';

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        batchId: { type: 'string' },
        retriedJobs: { type: 'number' }
      }
    }
  }
} as const;

interface SuccessResponse {
  success: boolean;
  message: string;
  data: {
    batchId: string;
    retriedJobs: number;
  };
}

/**
 * Retry failed jobs in batch
 * Resets and retries all failed jobs in a batch
 */
export default async function retryRoute(server: FastifyInstance) {
  server.post('/admin/mcp-registry/retry/:batchId', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Retry failed jobs in batch',
      description: 'Retry all failed jobs in an MCP Registry sync batch',
      security: [{ cookieAuth: [] }],
      
      params: BATCH_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Failed jobs retried successfully'
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
      
      const retriedJobs = await jobQueueService.retryFailedBatchJobs(batchId);
      
      request.log.info({
        batchId,
        retriedJobs,
        userId: request.user!.id,
        operation: 'mcp_sync_batch_retry'
      }, 'Retried failed jobs in MCP Registry sync batch');
      
      const responseData: SuccessResponse = {
        success: true,
        message: `Retried ${retriedJobs} failed jobs in batch`,
        data: { batchId, retriedJobs }
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error, batchId }, 'Failed to retry batch jobs');
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry batch jobs'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
