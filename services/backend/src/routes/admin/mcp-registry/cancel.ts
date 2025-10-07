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
        cancelledJobs: { type: 'number' }
      }
    }
  }
} as const;

interface SuccessResponse {
  success: boolean;
  message: string;
  data: {
    batchId: string;
    cancelledJobs: number;
  };
}

/**
 * Cancel active sync batch
 * Cancels all pending jobs in a batch
 */
export default async function cancelRoute(server: FastifyInstance) {
  server.post('/admin/mcp-registry/cancel/:batchId', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Cancel active sync batch',
      description: 'Cancel an active MCP Registry sync batch and all pending jobs',
      security: [{ cookieAuth: [] }],
      
      params: BATCH_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Batch cancelled successfully'
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
      
      const cancelledJobs = await jobQueueService.cancelBatchJobs(batchId);
      
      request.log.info({
        batchId,
        cancelledJobs,
        userId: request.user!.id,
        operation: 'mcp_sync_batch_cancelled'
      }, 'MCP Registry sync batch cancelled');
      
      const responseData: SuccessResponse = {
        success: true,
        message: `Cancelled ${cancelledJobs} pending jobs in batch`,
        data: { batchId, cancelledJobs }
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error, batchId }, 'Failed to cancel sync batch');
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel sync batch'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
