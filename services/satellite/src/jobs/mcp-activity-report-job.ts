import { BaseJob } from './base-job';
import { FastifyBaseLogger } from 'fastify';
import { EventBus } from '../services/event-bus';
import { McpActivityTracker } from '../services/mcp-activity-tracker';

/**
 * MCP Activity Report Job
 * 
 * Background job that emits MCP client activity events every 30 seconds.
 * 
 * This job:
 * 1. Retrieves accumulated activity from McpActivityTracker
 * 2. Emits mcp.client.activity events for each user/team/client
 * 3. EventBus automatically batches events and sends to backend
 * 
 * The 30-second interval balances real-time visibility with efficiency:
 * - Fast enough: Users see "active clients" with acceptable latency
 * - Efficient: Reduces network overhead compared to per-request reporting
 * - Consistent: Matches heartbeat interval for operational consistency
 */
export class McpActivityReportJob extends BaseJob {
  constructor(
    logger: FastifyBaseLogger,
    private eventBus: EventBus,
    private activityTracker: McpActivityTracker
  ) {
    super('mcp-activity-report', 30000, logger); // 30 seconds
  }

  /**
   * Execute job - retrieve activities and emit events
   * 
   * Called automatically by BaseJob every 30 seconds.
   * 
   * Flow:
   * 1. Get all accumulated activities and reset tracker
   * 2. If no activities, log and return early (no network call)
   * 3. For each activity, emit mcp.client.activity event
   * 4. EventBus queues events (3s batching)
   * 5. EventBus sends batch to backend (automatic)
   */
  protected async execute(): Promise<void> {
    const activities = this.activityTracker.getAndResetActivities();
    
    if (activities.length === 0) {
      this.logger.debug({
        operation: 'mcp_activity_report_empty'
      }, 'No MCP activity to report');
      return;
    }

    this.logger.info({
      operation: 'mcp_activity_report_start',
      activity_count: activities.length
    }, `Emitting ${activities.length} MCP client activity events`);

    let successCount = 0;
    let errorCount = 0;

    for (const activity of activities) {
      try {
        this.eventBus.emit('mcp.client.activity', {
          user_id: activity.userId,
          team_id: activity.teamId,
          oauth_client_id: activity.oauthClientId,
          auth_type: activity.authType,
          auth_identifier: activity.authType === 'instance_token'
            ? `instance:${activity.oauthClientId}`
            : undefined,
          client_name: activity.clientName,
          user_agent: activity.userAgent,
          ip_address: activity.ipAddress,
          session_id: activity.sessionId,
          request_count: activity.requestCount,
          tool_call_count: activity.toolCallCount,
          last_activity_at: activity.lastActivityAt.toISOString()
        });
        successCount++;
      } catch (error) {
        this.logger.warn({
          error: error instanceof Error ? error.message : String(error),
          user_id: activity.userId,
          team_id: activity.teamId
        }, 'Failed to emit activity event (non-fatal)');
        errorCount++;
      }
    }

    this.logger.info({
      operation: 'mcp_activity_report_complete',
      success_count: successCount,
      error_count: errorCount
    }, `MCP client activity events emitted: ${successCount} succeeded, ${errorCount} failed`);
  }
}
