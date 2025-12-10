import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { mcpServerLogs, mcpRequestLogs } from '../db/schema';
import { eq, sql, desc, notInArray, and } from 'drizzle-orm';

interface CleanupPayload {
  maxLogsPerInstallation: number;
}

/**
 * Cleanup MCP Server Logs Worker
 *
 * Enforces the log limit per installation for both log tables:
 * - mcpServerLogs: Internal server logs (stderr, startup, errors)
 * - mcpRequestLogs: Client request logs (tool calls)
 *
 * For each installation with more than the limit, deletes oldest logs
 * keeping only the most recent entries.
 */
export class CleanupMcpServerLogsWorker implements Worker {
  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {}

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    if (!this.isValidPayload(payload)) {
      return {
        success: false,
        message: 'Invalid payload format'
      };
    }

    const { maxLogsPerInstallation } = payload as CleanupPayload;

    this.logger.info({
      jobId,
      maxLogsPerInstallation,
      operation: 'cleanup_mcp_server_logs'
    }, 'Starting cleanup of MCP server logs');

    try {
      // Clean up server logs
      const serverLogsDeleted = await this.cleanupTable(
        'mcpServerLogs',
        mcpServerLogs,
        maxLogsPerInstallation,
        jobId
      );

      // Clean up request logs
      const requestLogsDeleted = await this.cleanupTable(
        'mcpRequestLogs',
        mcpRequestLogs,
        maxLogsPerInstallation,
        jobId
      );

      const totalDeleted = serverLogsDeleted + requestLogsDeleted;

      this.logger.info({
        jobId,
        serverLogsDeleted,
        requestLogsDeleted,
        totalDeleted,
        operation: 'cleanup_mcp_server_logs'
      }, 'MCP server logs cleanup completed');

      return {
        success: true,
        message: `Deleted ${totalDeleted} logs (${serverLogsDeleted} server logs, ${requestLogsDeleted} request logs)`,
        data: {
          serverLogsDeleted,
          requestLogsDeleted,
          totalDeleted,
          maxLogsPerInstallation
        }
      };
    } catch (error) {
      this.logger.error({
        jobId,
        error,
        operation: 'cleanup_mcp_server_logs'
      }, 'MCP server logs cleanup failed');

      throw error;
    }
  }

  /**
   * Clean up a specific log table, keeping only maxLogs per installation
   */
  private async cleanupTable(
    tableName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    maxLogs: number,
    jobId: string
  ): Promise<number> {
    // Find installations with more than maxLogs entries
    const overLimit = await this.db
      .select({
        installation_id: table.installation_id,
        count: sql<number>`count(*)`.as('count')
      })
      .from(table)
      .groupBy(table.installation_id)
      .having(sql`count(*) > ${maxLogs}`);

    if (overLimit.length === 0) {
      this.logger.debug({
        jobId,
        tableName,
        operation: 'cleanup_mcp_server_logs'
      }, `No installations over limit in ${tableName}`);
      return 0;
    }

    this.logger.debug({
      jobId,
      tableName,
      installationsOverLimit: overLimit.length,
      operation: 'cleanup_mcp_server_logs'
    }, `Found ${overLimit.length} installations over limit in ${tableName}`);

    let totalDeleted = 0;

    // For each installation over the limit, delete oldest logs
    for (const { installation_id } of overLimit) {
      // Get IDs of logs to keep (most recent maxLogs entries)
      const toKeep = await this.db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.installation_id, installation_id))
        .orderBy(desc(table.created_at))
        .limit(maxLogs);

      const keepIds = toKeep.map(r => r.id);

      if (keepIds.length === 0) {
        continue;
      }

      // Delete all logs for this installation except the ones to keep
      const result = await this.db
        .delete(table)
        .where(
          and(
            eq(table.installation_id, installation_id),
            notInArray(table.id, keepIds)
          )
        );

      const deleted = (result.rowCount || 0);
      totalDeleted += deleted;

      this.logger.debug({
        jobId,
        tableName,
        installationId: installation_id,
        deleted,
        operation: 'cleanup_mcp_server_logs'
      }, `Deleted ${deleted} old logs from ${tableName} for installation ${installation_id}`);
    }

    return totalDeleted;
  }

  private isValidPayload(payload: unknown): payload is CleanupPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any;
    return typeof p.maxLogsPerInstallation === 'number' && p.maxLogsPerInstallation > 0;
  }
}
