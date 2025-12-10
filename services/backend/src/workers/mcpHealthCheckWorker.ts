import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { McpHealthCheckService } from '../services/mcpHealthCheckService';

/**
 * MCP Health Check Worker
 *
 * Runs cumulative health checks at the template level.
 * Only checks HTTP/SSE servers with active installations.
 *
 * Logic:
 * 1. Query templates with active installations (HTTP/SSE only)
 * 2. Check each template's URL health
 * 3. Distribute health status to all installations
 */
export class McpHealthCheckWorker implements Worker {
  private healthCheckService: McpHealthCheckService;

  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {
    this.healthCheckService = new McpHealthCheckService(db, logger);
  }

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    this.logger.info({
      jobId,
      operation: 'mcp_health_check'
    }, 'Starting MCP health check job');

    try {
      const result = await this.healthCheckService.runHealthChecks();

      this.logger.info({
        jobId,
        operation: 'mcp_health_check',
        ...result
      }, 'MCP health check job completed');

      return {
        success: true,
        message: `Checked ${result.templatesChecked} templates (${result.online} online, ${result.offline} offline), updated ${result.installationsUpdated} installations`,
        data: result
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        jobId,
        operation: 'mcp_health_check',
        error: errorMessage
      }, 'MCP health check job failed');

      throw error;
    }
  }
}
