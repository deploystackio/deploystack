import type { CronJob } from '../cronManager';
import type { JobQueueService } from '../../services/jobQueueService';

/**
 * OAuth Token Refresh Cron Job
 *
 * Runs every 5 minutes to refresh expiring OAuth tokens for MCP servers.
 *
 * This job creates a background job in the queue that will:
 * - Find tokens expiring within next 10 minutes
 * - Refresh them using their refresh_token
 * - Update encrypted tokens in database
 *
 * Schedule: Every 5 minutes (*\/5 * * * *)
 * Job Type: refresh_oauth_tokens
 * Threshold: 10 minutes before expiry
 */
export function createRefreshOAuthTokensJob(jobQueueService: JobQueueService): CronJob {
	return {
		name: 'refresh-oauth-tokens',
		schedule: '*/5 * * * *', // Every 5 minutes

		task: async () => {
			// Create refresh job in queue
			// Worker will call refreshExpiringOAuthTokens() to process
			await jobQueueService.createJob('refresh_oauth_tokens', {});
		},
	};
}
