import type { FastifyBaseLogger } from 'fastify';
import type { JobProcessorService } from '../services/jobProcessorService';

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
 * export function registerWorkers(processor: JobProcessorService, logger: FastifyBaseLogger) {
 *   processor.registerWorker('my_custom_job', new MyCustomWorker());
 *   logger.info('Workers registered successfully');
 * }
 * ```
 */
export function registerWorkers(
  processor: JobProcessorService,
  logger: FastifyBaseLogger
): void {
  // Future workers will be registered here
  // Example:
  // processor.registerWorker('send_email', new EmailWorker(db, logger));
  // processor.registerWorker('process_csv', new CsvProcessorWorker(db, logger));
  // processor.registerWorker('mcp_registry_sync', new McpRegistrySyncWorker(db, logger));

  logger.info('Job queue workers registered (no workers yet - Phase 3)');
}
