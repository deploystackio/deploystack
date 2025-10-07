import { type FastifyInstance } from 'fastify';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { ERROR_RESPONSE_SCHEMA, type ErrorResponse } from './schemas';

const QUERYSTRING_SCHEMA = {
  type: 'object',
  properties: {
    limit: { 
      type: 'number', 
      minimum: 1, 
      maximum: 50,
      default: 10,
      description: 'Number of batches to return'
    }
  }
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Batch information with progress'
      }
    }
  }
} as const;

interface QueryString {
  limit?: number;
}

interface SuccessResponse {
  success: boolean;
  data: unknown[];
}

/**
 * Get recent sync batches
 * Returns recent MCP registry sync operations for monitoring
 */
export default async function batchesRoute(server: FastifyInstance) {
  server.get('/admin/mcp-registry/batches', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Get recent sync batches',
      description: 'Get recent MCP Registry sync operations with progress information',
      security: [{ cookieAuth: [] }],
      
      querystring: QUERYSTRING_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Recent batches retrieved successfully'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { limit } = (request.query || {}) as QueryString;
    
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, request.log);
      
      const recentBatches = await jobQueueService.getRecentBatches(
        'mcp_registry_sync',
        limit || 10
      );
      
      const responseData: SuccessResponse = {
        success: true,
        data: recentBatches
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error }, 'Failed to get recent batches');
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent batches'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
