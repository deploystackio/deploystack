import type { CronJob } from '../cronManager';

/**
 * MCP Credential Validation Cron Job
 *
 * Runs every minute to check installations that need credential validation.
 * Each installation is checked every 15 minutes based on last_credential_check_at.
 *
 * For OAuth-based installations:
 * - Validates token exists and is not expired
 * - Sets status to 'requires_reauth' if token missing/expired without refresh
 *
 * For API key-based HTTP/SSE installations:
 * - Sends health_check command to satellite for credential validation
 * - Satellite reports back via status events
 *
 * Schedule: Every 1 minute
 * Job Type: mcp_credential_validation
 * Batch Size: 50 installations per run
 */
export function createMcpCredentialValidationJob(): CronJob {
  return {
    name: 'mcp-credential-validation',
    schedule: '* * * * *',
    jobType: 'mcp_credential_validation',
    payload: {},
  };
}
