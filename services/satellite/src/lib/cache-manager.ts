import { rm } from 'fs/promises';
import { Logger } from 'pino';
import { mcpCacheBaseDir } from '../config/nsjail';

export interface CacheCleanupResult {
  cleaned: boolean;
  cacheDir: string;
  reason?: string;
}

/**
 * Manage runtime cache directories for MCP server processes
 * Cache directories are shared per team+runtime:
 * - /opt/deploystack/mcp-cache/node/{team_id}
 * - /opt/deploystack/mcp-cache/python/{team_id}
 */
export class CacheManager {
  constructor(private logger: Logger) {}

  /**
   * Get cache directory path for a team+runtime combination
   */
  getCacheDir(teamId: string, runtime: string): string {
    return `${mcpCacheBaseDir}/mcp-cache/${runtime}/${teamId}`;
  }

  /**
   * Clean up team's runtime cache directory
   * Should only be called after verifying no other processes use this cache
   *
   * @param teamId - Team identifier
   * @param runtime - Runtime type ('node' or 'python')
   * @returns Cleanup result with success status
   */
  async cleanupTeamRuntimeCache(
    teamId: string,
    runtime: string
  ): Promise<CacheCleanupResult> {
    const cacheDir = this.getCacheDir(teamId, runtime);

    this.logger.info({
      operation: 'cleanup_team_runtime_cache_start',
      team_id: teamId,
      runtime: runtime,
      cache_dir: cacheDir
    }, `Starting cleanup of ${runtime} cache for team: ${cacheDir}`);

    try {
      await rm(cacheDir, { recursive: true, force: true });

      this.logger.info({
        operation: 'cleanup_team_runtime_cache_success',
        team_id: teamId,
        runtime: runtime,
        cache_dir: cacheDir
      }, `Successfully cleaned up ${runtime} cache for team`);

      return { cleaned: true, cacheDir };
    } catch (error) {
      this.logger.error({
        operation: 'cleanup_team_runtime_cache_failed',
        team_id: teamId,
        runtime: runtime,
        cache_dir: cacheDir,
        error: error instanceof Error ? error.message : String(error)
      }, `Failed to cleanup team runtime cache`);

      return {
        cleaned: false,
        cacheDir,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
