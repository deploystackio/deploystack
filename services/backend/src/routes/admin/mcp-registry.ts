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
}
