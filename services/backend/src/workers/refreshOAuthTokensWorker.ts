import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { refreshExpiringOAuthTokens } from '../jobs/refresh-oauth-tokens';

/**
 * OAuth Token Refresh Worker
 *
 * Refreshes expiring OAuth tokens for MCP server installations.
 *
 * Triggered by cron job every 5 minutes. This worker:
 * - Finds tokens expiring within 10 minutes
 * - Refreshes them using OAuth refresh_token grant
 * - Updates encrypted tokens in database
 * - Handles refresh token rotation
 *
 * Performance:
 * - Typical execution: < 2 seconds for small batches
 * - Each token refresh: ~500ms (network latency)
 * - Uses PostgreSQL for data storage
 */
export class RefreshOAuthTokensWorker implements Worker {
	constructor(
		private readonly db: AnyDatabase,
		private readonly logger: FastifyBaseLogger
	) {}

	async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
		const startTime = Date.now();

		this.logger.info(
			{
				jobId,
				operation: 'refresh_oauth_tokens',
			},
			'Starting OAuth token refresh worker'
		);

		try {
			// Call the refresh job function
			const refreshedCount = await refreshExpiringOAuthTokens(this.logger);

			const durationMs = Date.now() - startTime;

			this.logger.info(
				{
					jobId,
					operation: 'refresh_oauth_tokens',
					refreshed_count: refreshedCount,
					duration_ms: durationMs,
				},
				'OAuth token refresh worker completed successfully'
			);

			return {
				success: true,
				message: `Refreshed ${refreshedCount} expiring OAuth tokens`,
				data: {
					refreshedCount,
					durationMs,
				},
			};
		} catch (error) {
			const durationMs = Date.now() - startTime;

			this.logger.error(
				{
					jobId,
					error,
					duration_ms: durationMs,
					operation: 'refresh_oauth_tokens',
				},
				'OAuth token refresh worker failed'
			);

			// Throw error to trigger job queue retry logic
			throw error;
		}
	}
}
