import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { oauthPendingFlows } from '../db/schema';
import { lt } from 'drizzle-orm';

export class CleanupExpiredOAuthPendingFlowsWorker implements Worker {
	constructor(
		private readonly db: AnyDatabase,
		private readonly logger: FastifyBaseLogger
	) {}

	async execute(_payload: unknown, jobId: string): Promise<WorkerResult> {
		this.logger.debug({
			jobId,
			operation: 'cleanup_expired_oauth_pending_flows'
		}, 'Starting cleanup of expired OAuth pending flows');

		try {
			const now = new Date();

			// Delete expired flows
			const result = await this.db
				.delete(oauthPendingFlows)
				.where(lt(oauthPendingFlows.expires_at, now));

			const deletedCount = result.rowCount || 0;

			if (deletedCount > 0) {
				this.logger.info({
					jobId,
					deletedCount,
					operation: 'cleanup_expired_oauth_pending_flows'
				}, 'Cleaned up expired OAuth pending flows');
			} else {
				this.logger.debug({
					jobId,
					operation: 'cleanup_expired_oauth_pending_flows'
				}, 'No expired OAuth pending flows found');
			}

			return {
				success: true,
				message: `Deleted ${deletedCount} expired OAuth pending flows`,
				data: {
					deletedCount,
					timestamp: now.toISOString()
				}
			};
		} catch (error) {
			this.logger.error({
				jobId,
				error,
				operation: 'cleanup_expired_oauth_pending_flows'
			}, 'Cleanup job failed');

			throw error;
		}
	}
}
