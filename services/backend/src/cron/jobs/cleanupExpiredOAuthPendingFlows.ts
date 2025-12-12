import type { CronJob } from '../cronManager';

/**
 * OAuth Pending Flows Cleanup Cron Job
 *
 * Runs every 3 minutes to clean up expired OAuth pending flows.
 * This prevents stale pending flows from accumulating and ensures
 * users cannot complete OAuth flows with expired state parameters.
 *
 * Schedule: Every 3 minutes
 * Job Type: cleanup_expired_oauth_pending_flows
 */
export function createCleanupExpiredOAuthPendingFlowsJob(): CronJob {
	return {
		name: 'cleanup-expired-oauth-pending-flows',
		schedule: '*/3 * * * *', // Every 3 minutes
		jobType: 'cleanup_expired_oauth_pending_flows',
		payload: {},
	};
}
