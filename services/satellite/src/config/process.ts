/**
 * Process management configuration
 */

/**
 * Idle timeout for stdio MCP server processes
 * Processes inactive for longer than this will be terminated and marked dormant
 * They will be automatically respawned when needed
 * 
 * Default: 180 seconds (3 minutes)
 * Configure via: MCP_PROCESS_IDLE_TIMEOUT_SECONDS environment variable
 */
export const IDLE_TIMEOUT_MS = parseInt(
  process.env.MCP_PROCESS_IDLE_TIMEOUT_SECONDS || '180',
  10
) * 1000;

/**
 * Grace period after process spawn during which it cannot be marked idle
 * This prevents newly spawned processes from being terminated before they finish initialization
 * 
 * Default: 60 seconds
 * Configure via: MCP_PROCESS_SPAWN_GRACE_PERIOD_SECONDS environment variable
 */
export const SPAWN_GRACE_PERIOD_MS = parseInt(
  process.env.MCP_PROCESS_SPAWN_GRACE_PERIOD_SECONDS || '60',
  10
) * 1000;
