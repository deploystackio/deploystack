import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../db';
import type { JobProcessorService } from '../services/jobProcessorService';
import { McpServerSyncWorker } from './mcpServerSyncWorker';
import { RegistryCoordinatorWorker } from './registryCoordinatorWorker';
import { EmailWorker } from './emailWorker';

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
  // Register Email Worker (sends emails via background jobs)
  processor.registerWorker(
    'send_email',
    new EmailWorker(db, logger)
  );

  // Register Registry Coordinator Worker (discovers which servers to sync)
  processor.registerWorker(
    'coordinate_registry_sync',
    new RegistryCoordinatorWorker(db, logger)
  );

  // Register MCP Server Sync Worker (syncs individual servers)
  processor.registerWorker(
    'sync_mcp_server',
    new McpServerSyncWorker(db, logger)
  );

  logger.info({
    workers: ['send_email', 'coordinate_registry_sync', 'sync_mcp_server']
  }, 'Job queue workers registered successfully');
}
