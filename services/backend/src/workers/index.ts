import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../db';
import type { JobProcessorService } from '../services/jobProcessorService';
import { McpServerSyncWorker } from './mcpServerSyncWorker';

/**
 * Register all workers with the job processor
 * 
 * This function is called during server startup to register all available
 * workers with the job processor. Each worker handles a specific job type.
 * 
 * To add a new worker:
 * 1. Create a new worker class implementing the Worker interface
 * 2. Import it in this file
 * 3. Register it with processor.registerWorker()
 * 
 * Example:
 * ```typescript
 * import { MyCustomWorker } from './myCustomWorker';
 * 
 * export function registerWorkers(processor: JobProcessorService, db: AnyDatabase, logger: FastifyBaseLogger) {
 *   processor.registerWorker('my_custom_job', new MyCustomWorker(db, logger));
 *   logger.info('Workers registered successfully');
 * }
 * ```
 */
export function registerWorkers(
  processor: JobProcessorService,
  db: AnyDatabase,
  logger: FastifyBaseLogger
): void {
  // Register MCP Server Sync Worker
  processor.registerWorker(
    'sync_mcp_server',
    new McpServerSyncWorker(db, logger)
  );

  logger.info({
    workers: ['sync_mcp_server']
  }, 'Job queue workers registered successfully');
}
