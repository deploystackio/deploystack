import { type FastifyInstance } from 'fastify';
import syncRoute from './sync';
import progressRoute from './progress';
import cancelRoute from './cancel';
import retryRoute from './retry';
import batchesRoute from './batches';

/**
 * Admin routes for MCP Registry synchronization
 * 
 * These routes allow administrators to:
 * - Trigger sync from official MCP Registry
 * - Monitor sync progress via job queue
 * - Cancel active sync batches
 * - Retry failed sync jobs
 * - View recent sync operations
 */
export default async function mcpRegistryRoutes(server: FastifyInstance) {
  await server.register(syncRoute);
  await server.register(progressRoute);
  await server.register(cancelRoute);
  await server.register(retryRoute);
  await server.register(batchesRoute);
}
