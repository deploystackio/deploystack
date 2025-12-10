import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { McpHealthCheckService } from '../services/mcpHealthCheckService';
import { SatelliteCommandService } from '../services/satelliteCommandService';

/**
 * MCP Credential Validation Worker
 *
 * Validates credentials for MCP server installations.
 * Runs every minute but only checks installations whose last_credential_check_at
 * is more than 15 minutes ago (or null).
 *
 * Two-level validation:
 * 1. OAuth-based: Check token validity directly in database
 * 2. API key-based: Request satellite to validate via tools/list call
 */
export class McpCredentialValidationWorker implements Worker {
  private healthCheckService: McpHealthCheckService;
  private satelliteCommandService: SatelliteCommandService;

  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {
    this.healthCheckService = new McpHealthCheckService(db, logger);
    this.satelliteCommandService = new SatelliteCommandService(db, logger);

    // Wire up satellite command service for API key validation
    this.healthCheckService.setSatelliteCommandService(this.satelliteCommandService);
  }

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    this.logger.info({
      jobId,
      operation: 'mcp_credential_validation'
    }, 'Starting MCP credential validation job');

    try {
      const result = await this.healthCheckService.runCredentialValidation();

      this.logger.info({
        jobId,
        operation: 'mcp_credential_validation',
        ...result
      }, 'MCP credential validation job completed');

      return {
        success: true,
        message: `Checked ${result.installationsChecked} installations (${result.oauthValidated} OAuth valid, ${result.oauthFailed} OAuth failed, ${result.apiKeyRequested} API key requests sent)`,
        data: result
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        jobId,
        operation: 'mcp_credential_validation',
        error: errorMessage
      }, 'MCP credential validation job failed');

      throw error;
    }
  }
}
