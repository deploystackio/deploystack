import { type FastifyInstance } from 'fastify';
import { JobQueueService } from '../../../services/jobQueueService';
import { getDb } from '../../../db';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { ERROR_RESPONSE_SCHEMA, type ErrorResponse } from './schemas';

const REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    maxServers: { 
      type: 'number', 
      minimum: 1, 
      maximum: 1000,
      description: 'Maximum number of servers to sync (for testing). Omit to sync all servers.'
    },
    skipExisting: { 
      type: 'boolean', 
      default: true,
      description: 'Skip servers that already exist in the database'
    },
    forceRefresh: { 
      type: 'boolean', 
      default: false,
      description: 'Force refresh of existing servers (overrides skipExisting)'
    },
    rateLimitDelay: { 
      type: 'number', 
      minimum: 1, 
      maximum: 120, 
      default: 2,
      description: 'Delay between jobs in seconds (default: 2)'
    }
  },
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        batchId: { type: 'string', description: 'Job batch ID for tracking progress' },
        coordinatorJobId: { type: 'string', description: 'Coordinator job ID' },
        status: { type: 'string', description: 'Current status' },
        message: { type: 'string', description: 'Status message' }
      },
      required: ['batchId', 'coordinatorJobId', 'status', 'message']
    }
  },
  required: ['success', 'data']
} as const;

interface RequestBody {
  maxServers?: number;
  skipExisting?: boolean;
  forceRefresh?: boolean;
  rateLimitDelay?: number;
}

interface SuccessResponse {
  success: boolean;
  data: {
    batchId: string;
    coordinatorJobId: string;
    status: string;
    message: string;
  };
}

/**
 * Trigger MCP Registry sync via background job coordination
 * 
 * This endpoint:
 * 1. Creates a job batch for tracking (total_jobs=0 initially)
 * 2. Creates a coordinator job that will discover servers to sync
 * 3. Returns immediately with batch ID (sub-second response)
 * 4. Coordinator job runs in background:
 *    - Fetches server list from registry.modelcontextprotocol.io
 *    - Filters out existing servers using in-memory optimization
 *    - Updates batch total_jobs count
 *    - Creates individual sync jobs for each new server
 * 
 * Progress can be monitored via: GET /api/admin/mcp-registry/progress/{batchId}
 */
export default async function syncRoute(server: FastifyInstance) {
  server.post('/admin/mcp-registry/sync', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Trigger MCP Registry sync via background coordination',
      description: 'Trigger synchronization with official MCP Registry using background job coordination. Returns immediately with batch ID. The coordinator job discovers servers and creates individual sync jobs. Progress can be monitored via GET /api/admin/mcp-registry/progress/{batchId}',
      security: [{ cookieAuth: [] }],
      
      body: REQUEST_SCHEMA,
      
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Sync triggered successfully'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const config = (request.body || {}) as RequestBody;
    
    request.log.info({
      operation: 'mcp_registry_sync_triggered',
      userId: request.user!.id,
      config,
    }, 'MCP Registry sync coordination triggered');
    
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, request.log);
      
      // Create batch with total_jobs=0 (will be updated by coordinator)
      const batch = await jobQueueService.createBatch(
        'mcp_registry_sync',
        0, // total_jobs unknown until coordinator discovers servers
        {
          syncedBy: request.user!.id,
          config: {
            maxServers: config.maxServers || null,
            skipExisting: config.skipExisting !== false,
            forceRefresh: config.forceRefresh || false,
            rateLimitDelay: config.rateLimitDelay || 2,
          },
          startedAt: new Date().toISOString(),
        }
      );
      
      // Create coordinator job that will discover and create sync jobs
      const coordinatorJob = await jobQueueService.createJob(
        'coordinate_registry_sync',
        {
          batchId: batch.id,
          maxServers: config.maxServers || null,
          skipExisting: config.skipExisting !== false,
          forceRefresh: config.forceRefresh || false,
          rateLimitDelay: config.rateLimitDelay || 2,
          syncedBy: request.user!.id,
        }
      );
      
      request.log.info({
        operation: 'mcp_registry_sync_coordination_created',
        batchId: batch.id,
        coordinatorJobId: coordinatorJob.id,
        userId: request.user!.id,
      }, 'Registry sync coordination job created');
      
      const responseData: SuccessResponse = {
        success: true,
        data: {
          batchId: batch.id,
          coordinatorJobId: coordinatorJob.id,
          status: 'coordinating',
          message: 'Registry sync coordination started. The system is discovering new servers to sync. Monitor progress at /api/admin/mcp-registry/progress/' + batch.id,
        },
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error }, 'Failed to create registry sync coordination job');
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start MCP Registry sync coordination'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
