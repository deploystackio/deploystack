import { type FastifyInstance } from 'fastify';
import { RegistrySyncService } from '../../services/registrySyncService';
import { JobQueueService } from '../../services/jobQueueService';
import { getDb } from '../../db';
import { requirePermission } from '../../middleware/roleMiddleware';

/**
 * Admin routes for MCP Registry synchronization
 * 
 * These routes allow administrators to:
 * - Trigger sync from official MCP Registry
 * - Monitor sync progress via existing job queue APIs
 */

export default async function mcpRegistryRoutes(server: FastifyInstance) {
  /**
   * Trigger MCP Registry sync via job queue
   * 
   * This endpoint:
   * 1. Fetches server list from registry.modelcontextprotocol.io
   * 2. Creates a job batch for tracking
   * 3. Creates individual jobs for each server with rate-limited scheduling
   * 4. Returns batch ID for progress monitoring
   * 
   * Progress can be monitored via: GET /api/admin/jobs/batches/{batchId}
   */
  server.post('/admin/mcp-registry/sync', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Trigger MCP Registry sync via job queue',
      description: 'Trigger synchronization with official MCP Registry using background jobs for rate limiting. Progress can be monitored via GET /api/admin/jobs/batches/{batchId}',
      security: [{ cookieAuth: [] }],
      
      body: {
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
            maximum: 10, 
            default: 2,
            description: 'Delay between jobs in seconds (default: 2)'
          }
        },
        additionalProperties: false
      },
      
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                batchId: { type: 'string', description: 'Job batch ID for tracking progress' },
                totalServers: { type: 'number', description: 'Total servers to sync' },
                jobsCreated: { type: 'number', description: 'Number of jobs created' },
                estimatedCompletion: { type: 'string', description: 'Estimated completion time (ISO 8601)' },
                rateLimitDelay: { type: 'number', description: 'Delay between jobs in seconds' }
              },
              required: ['batchId', 'totalServers', 'jobsCreated', 'estimatedCompletion']
            }
          },
          required: ['success', 'data']
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          },
          required: ['success', 'error']
        }
      }
    }
  }, async (request, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (request.body || {}) as any;
    
    request.log.info({
      operation: 'mcp_registry_sync_triggered',
      userId: request.user!.id,
      config,
    }, 'MCP Registry sync via job queue triggered');
    
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, request.log);
      const syncService = new RegistrySyncService(db, request.log, jobQueueService);
      
      const stats = await syncService.syncAllServersViaJobQueue({
        maxServers: config.maxServers || null,
        skipExisting: config.skipExisting !== false,
        forceRefresh: config.forceRefresh || false,
        rateLimitDelay: config.rateLimitDelay || 2,
      }, request.user!.id);
      
      const responseData = {
        success: true,
        data: {
          batchId: stats.batchId,
          totalServers: stats.totalServers,
          jobsCreated: stats.jobsCreated,
          estimatedCompletion: stats.estimatedCompletion.toISOString(),
          rateLimitDelay: config.rateLimitDelay || 2,
        },
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error }, 'MCP Registry sync via job queue failed');
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start MCP Registry sync'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  /**
   * Get detailed batch progress
   * Provides real-time progress, job status, and error details for a sync batch
   */
  server.get('/admin/mcp-registry/progress/:batchId', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Get detailed sync progress for batch',
      description: 'Get real-time progress, job status, and error details for MCP Registry sync batch',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          batchId: { type: 'string', description: 'Job batch ID' }
        },
        required: ['batchId']
      },
      
      response: {
        200: {
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
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, request.log);
      
      const batchProgress = await jobQueueService.getBatchProgress(batchId);
      
      const responseData = {
        success: true,
        data: batchProgress
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error, batchId }, 'Failed to get batch progress');
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get batch progress'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  /**
   * Cancel active sync batch
   * Cancels all pending jobs in a batch
   */
  server.post('/admin/mcp-registry/cancel/:batchId', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Cancel active sync batch',
      description: 'Cancel an active MCP Registry sync batch and all pending jobs',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          batchId: { type: 'string', description: 'Job batch ID to cancel' }
        },
        required: ['batchId']
      },
      
      response: {
        200: {
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
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    
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
      
      const responseData = {
        success: true,
        message: `Cancelled ${cancelledJobs} pending jobs in batch`,
        data: { batchId, cancelledJobs }
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error, batchId }, 'Failed to cancel sync batch');
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel sync batch'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  /**
   * Retry failed jobs in batch
   * Resets and retries all failed jobs in a batch
   */
  server.post('/admin/mcp-registry/retry/:batchId', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Retry failed jobs in batch',
      description: 'Retry all failed jobs in an MCP Registry sync batch',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          batchId: { type: 'string', description: 'Job batch ID to retry failed jobs' }
        },
        required: ['batchId']
      },
      
      response: {
        200: {
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
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    
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
      
      const responseData = {
        success: true,
        message: `Retried ${retriedJobs} failed jobs in batch`,
        data: { batchId, retriedJobs }
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error, batchId }, 'Failed to retry batch jobs');
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry batch jobs'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  /**
   * Get recent sync batches
   * Returns recent MCP registry sync operations for monitoring
   */
  server.get('/admin/mcp-registry/batches', {
    preValidation: requirePermission('mcp.registry.sync'),
    schema: {
      tags: ['Admin - MCP Registry'],
      summary: 'Get recent sync batches',
      description: 'Get recent MCP Registry sync operations with progress information',
      security: [{ cookieAuth: [] }],
      
      querystring: {
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
      },
      
      response: {
        200: {
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
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { limit } = (request.query || {}) as any;
    
    try {
      const db = getDb();
      const jobQueueService = new JobQueueService(db, request.log);
      
      const recentBatches = await jobQueueService.getRecentBatches(
        'mcp_registry_sync',
        limit || 10
      );
      
      const responseData = {
        success: true,
        data: recentBatches
      };
      const jsonString = JSON.stringify(responseData);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({ error }, 'Failed to get recent batches');
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent batches'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
