import type { CronJob } from '../cronManager';

/**
 * Cleanup MCP Server Logs Cron Job
 *
 * Runs every 10 minutes to enforce the 100-line limit per installation
 * for both mcpServerLogs and mcpRequestLogs tables.
 *
 * Schedule: Every 10 minutes
 * Job Type: cleanup_mcp_server_logs
 * Limit: 100 logs per installation per table
 */
export function createCleanupMcpServerLogsJob(): CronJob {
  return {
    name: 'cleanup-mcp-server-logs',
    schedule: '*/10 * * * *',
    jobType: 'cleanup_mcp_server_logs',
    payload: {
      maxLogsPerInstallation: 100,
    },
  };
}
