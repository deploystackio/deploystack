import type { CronJob } from '../cronManager';

/**
 * MCP Health Check Cron Job
 *
 * Runs cumulative health checks at the template level every 3 minutes.
 * Only checks HTTP/SSE servers with active installations to avoid
 * hammering remote servers with redundant checks.
 *
 * Schedule: Every 3 minutes
 * Job Type: mcp_health_check
 */
export function createMcpHealthCheckJob(): CronJob {
  return {
    name: 'mcp-health-check',
    schedule: '*/3 * * * *',
    jobType: 'mcp_health_check',
    payload: {},
  };
}
