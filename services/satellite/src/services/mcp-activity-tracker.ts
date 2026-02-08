import type { FastifyBaseLogger } from 'fastify';

/**
 * Activity Record
 * 
 * Represents accumulated MCP client activity for a unique user/team/client combination.
 * Activity is tracked in memory and reset after each emission to the backend.
 */
export interface ActivityRecord {
  userId: string;
  teamId: string;
  oauthClientId: string;
  clientName: string;
  userAgent: string;
  ipAddress: string;
  sessionId?: string;
  requestCount: number;
  toolCallCount: number;
  lastActivityAt: Date;
  authType: 'oauth' | 'instance_token';
}

/**
 * MCP Activity Tracker
 * 
 * Tracks MCP client activity in memory for periodic emission to the backend.
 * Each unique (user, team, oauth_client) combination is tracked separately.
 * 
 * Activity is accumulated until retrieved by McpActivityReportJob, then reset.
 * This prevents double-counting and ensures accurate reporting.
 */
export class McpActivityTracker {
  private activities: Map<string, ActivityRecord> = new Map();
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Track a single MCP request
   * 
   * Updates the activity record for this user/team/client combination.
   * If the record doesn't exist, creates a new one.
   * If it exists, increments counters and updates timestamp.
   * 
   * @param userId - User making the request
   * @param teamId - Team context of the request
   * @param oauthClientId - OAuth client ID (from token introspection)
   * @param clientName - Human-readable client name (VS Code, Cursor, etc.)
   * @param userAgent - User-Agent header from request
   * @param ipAddress - IP address of the request
   * @param sessionId - Optional Mcp-Session-Id header (for debugging)
   * @param isToolCall - True if this request is a tool execution
   * @param authType - Authentication method: 'oauth' or 'instance_token'
   */
  trackRequest(
    userId: string,
    teamId: string,
    oauthClientId: string,
    clientName: string,
    userAgent: string,
    ipAddress: string,
    sessionId: string | undefined,
    isToolCall: boolean,
    authType: 'oauth' | 'instance_token' = 'oauth'
  ): void {
    const key = `${userId}:${teamId}:${oauthClientId}`;
    const existing = this.activities.get(key);

    if (existing) {
      // Update existing record
      existing.requestCount++;
      if (isToolCall) {
        existing.toolCallCount++;
      }
      existing.lastActivityAt = new Date();
      if (sessionId) {
        existing.sessionId = sessionId;
      }
      
      this.logger.debug({
        operation: 'activity_updated',
        userId,
        teamId,
        oauthClientId,
        requestCount: existing.requestCount,
        toolCallCount: existing.toolCallCount
      }, 'Activity record updated');
      
    } else {
      // Create new record
      const newRecord: ActivityRecord = {
        userId,
        teamId,
        oauthClientId,
        clientName,
        userAgent,
        ipAddress,
        sessionId,
        requestCount: 1,
        toolCallCount: isToolCall ? 1 : 0,
        lastActivityAt: new Date(),
        authType
      };
      
      this.activities.set(key, newRecord);
      
      this.logger.debug({
        operation: 'activity_created',
        userId,
        teamId,
        oauthClientId,
        clientName
      }, 'New activity record created');
    }
  }

  /**
   * Get all accumulated activities and reset the tracker
   * 
   * This method is called by McpActivityReportJob every 30 seconds.
   * It returns all accumulated activity records and clears the internal map.
   * 
   * Resetting after retrieval ensures activities are not double-counted
   * across multiple reporting cycles.
   * 
   * @returns Array of activity records accumulated since last call
   */
  getAndResetActivities(): ActivityRecord[] {
    const records = Array.from(this.activities.values());
    this.activities.clear();
    
    this.logger.debug({
      operation: 'activities_retrieved_and_reset',
      activity_count: records.length
    }, `Retrieved ${records.length} activity records`);
    
    return records;
  }

  /**
   * Get current activity count (without resetting)
   * 
   * Useful for monitoring and debugging.
   * 
   * @returns Number of unique activity records currently tracked
   */
  getActivityCount(): number {
    return this.activities.size;
  }

  /**
   * Clear all activities (emergency reset)
   * 
   * Should only be used in testing or emergency situations.
   * Normal operation should use getAndResetActivities() instead.
   */
  clear(): void {
    const count = this.activities.size;
    this.activities.clear();
    
    this.logger.warn({
      operation: 'activities_force_cleared',
      cleared_count: count
    }, `Force cleared ${count} activity records`);
  }
}
