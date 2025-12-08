import type { CronJob } from '../cronManager';

/**
 * OAuth Token Refresh Cron Job
 *
 * Runs every 5 minutes to refresh expiring OAuth tokens for MCP servers.
 *
 * The worker will:
 * - Find tokens expiring within next 10 minutes
 * - Refresh them using their refresh_token
 * - Update encrypted tokens in database
 *
 * Schedule: Every 5 minutes
 * Job Type: refresh_oauth_tokens
 * Threshold: 10 minutes before expiry
 */
export function createRefreshOAuthTokensJob(): CronJob {
  return {
    name: 'refresh-oauth-tokens',
    schedule: '*/5 * * * *',
    jobType: 'refresh_oauth_tokens',
    // Empty payload - worker handles token discovery
  };
}
