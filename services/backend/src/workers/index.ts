import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../db';
import type { JobProcessorService } from '../services/jobProcessorService';
import type { DeployStackEventBus } from '../events/eventBus';
import { McpServerSyncWorker } from './mcpServerSyncWorker';
import { RegistryCoordinatorWorker } from './registryCoordinatorWorker';
import { EmailWorker } from './emailWorker';
import { McpClientActivityMetricsCleanupWorker } from './mcpClientActivityMetricsCleanupWorker';
import { CleanupOldJobsWorker } from './cleanupOldJobsWorker';
import { RefreshOAuthTokensWorker } from './refreshOAuthTokensWorker';
import { CleanupSatelliteHeartbeatsWorker } from './cleanupSatelliteHeartbeatsWorker';
import { McpServerCascadeDeletionWorker } from './mcpServerCascadeDeletionWorker';

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
 * export function registerWorkers(processor: JobProcessorService, db: AnyDatabase, logger: FastifyBaseLogger, eventBus?: DeployStackEventBus) {
 *   processor.registerWorker('my_custom_job', new MyCustomWorker(db, logger));
 *   logger.info('Workers registered successfully');
 * }
 * ```
 */
export function registerWorkers(
  processor: JobProcessorService,
  db: AnyDatabase,
  logger: FastifyBaseLogger,
  eventBus?: DeployStackEventBus
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

  // Register MCP Client Activity Metrics Cleanup Worker
  processor.registerWorker(
    'cleanup_mcp_client_activity_metrics',
    new McpClientActivityMetricsCleanupWorker(db, logger)
  );

  // Register Cleanup Old Jobs Worker
  processor.registerWorker(
    'cleanup_old_jobs',
    new CleanupOldJobsWorker(db, logger)
  );

  // Register OAuth Token Refresh Worker
  processor.registerWorker(
    'refresh_oauth_tokens',
    new RefreshOAuthTokensWorker(db, logger)
  );

  // Register Satellite Heartbeat Cleanup Worker
  processor.registerWorker(
    'cleanup_satellite_heartbeats',
    new CleanupSatelliteHeartbeatsWorker(db, logger)
  );

  // Register MCP Server Cascade Deletion Worker (requires eventBus)
  if (eventBus) {
    processor.registerWorker(
      'mcp_server_cascade_delete',
      new McpServerCascadeDeletionWorker(db, logger, eventBus)
    );
  } else {
    logger.warn('EventBus not provided - MCP Server Cascade Deletion Worker not registered');
  }

  // Log all registered workers dynamically
  const registeredWorkers = processor.getRegisteredWorkerTypes();
  logger.info({
    workers: registeredWorkers,
    count: registeredWorkers.length
  }, 'Job queue workers registered successfully');
}
