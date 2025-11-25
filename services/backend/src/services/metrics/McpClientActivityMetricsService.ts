import { eq, and, gte, lte, desc, sum } from 'drizzle-orm';
import { mcpClientActivityMetrics } from '../../db/schema';
import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';
import { 
  TimeSeriesMetricsService, 
  type QueryParams, 
  type BucketData 
} from './TimeSeriesMetricsService';

export interface McpActivityQueryParams extends QueryParams {
  filters: {
    user_id: string;
    team_id: string;
    satellite_id?: string;
    auth_identifier?: string;
  };
}

export class McpClientActivityMetricsService extends TimeSeriesMetricsService {
  constructor(
    db: AnyDatabase,
    logger: FastifyBaseLogger
  ) {
    super(db, logger);
  }

  getMetricType(): string {
    return 'mcp_client_activity';
  }

  getDefaultMetricFields(): Record<string, number> {
    return {
      request_count: 0,
      tool_call_count: 0,
      active_client_count: 0
    };
  }

  async queryBuckets(params: McpActivityQueryParams): Promise<BucketData[]> {
    this.logger.debug({
      operation: 'query_buckets',
      metricType: this.getMetricType(),
      filters: params.filters,
      startTime: params.startTime.toISOString(),
      endTime: params.endTime.toISOString(),
      interval: params.interval
    }, 'Querying MCP client activity buckets');

    const startTimestamp = Math.floor(params.startTime.getTime() / 1000);
    const endTimestamp = Math.floor(params.endTime.getTime() / 1000);

    const whereConditions = [
      eq(mcpClientActivityMetrics.user_id, params.filters.user_id),
      eq(mcpClientActivityMetrics.team_id, params.filters.team_id),
      eq(mcpClientActivityMetrics.bucket_interval, params.interval as '15m' | '1h'),
      gte(mcpClientActivityMetrics.bucket_timestamp, startTimestamp),
      lte(mcpClientActivityMetrics.bucket_timestamp, endTimestamp)
    ];

    if (params.filters.satellite_id) {
      whereConditions.push(
        eq(mcpClientActivityMetrics.satellite_id, params.filters.satellite_id)
      );
    }

    if (params.filters.auth_identifier) {
      whereConditions.push(
        eq(mcpClientActivityMetrics.auth_identifier, params.filters.auth_identifier)
      );
    }

    const results = await this.db
      .select({
        bucket_timestamp: mcpClientActivityMetrics.bucket_timestamp,
        request_count: sum(mcpClientActivityMetrics.request_count).mapWith(Number),
        tool_call_count: sum(mcpClientActivityMetrics.tool_call_count).mapWith(Number),
        active_client_count: sum(mcpClientActivityMetrics.active_client_count).mapWith(Number)
      })
      .from(mcpClientActivityMetrics)
      .where(and(...whereConditions))
      .groupBy(mcpClientActivityMetrics.bucket_timestamp)
      .orderBy(desc(mcpClientActivityMetrics.bucket_timestamp));

    this.logger.info({
      operation: 'query_buckets',
      metricType: this.getMetricType(),
      bucketsFound: results.length,
      filters: params.filters
    }, 'Retrieved and aggregated MCP client activity buckets');

    return results.map((row: { bucket_timestamp: number; request_count: number; tool_call_count: number; active_client_count: number }) => ({
      timestamp: row.bucket_timestamp,
      request_count: row.request_count,
      tool_call_count: row.tool_call_count,
      active_client_count: row.active_client_count
    }));
  }

  async getMetrics(
    userId: string,
    teamId: string,
    timeRange: string,
    interval: string,
    satelliteId?: string,
    authIdentifier?: string
  ) {
    this.logger.debug({
      operation: 'get_metrics',
      userId,
      teamId,
      timeRange,
      interval,
      satelliteId,
      authIdentifier
    }, 'Getting MCP client activity metrics');

    // MCP client activity specific validation: only 15m interval supported
    if (interval !== '15m') {
      throw new Error(
        `Invalid interval for MCP client activity: '${interval}'. Only '15m' is supported.`
      );
    }

    const { start, end } = this.parseTimeRange(timeRange);
    
    // MCP client activity specific validation: maximum 3 days retention
    const maxRetentionMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    const requestedRangeMs = end.getTime() - start.getTime();
    if (requestedRangeMs > maxRetentionMs) {
      throw new Error(
        `Time range exceeds maximum retention for MCP client activity (3 days). Requested: ${Math.ceil(requestedRangeMs / (24 * 60 * 60 * 1000))} days.`
      );
    }
    
    this.validateInterval(interval);

    const queryParams: McpActivityQueryParams = {
      startTime: start,
      endTime: end,
      interval,
      filters: {
        user_id: userId,
        team_id: teamId,
        satellite_id: satelliteId,
        auth_identifier: authIdentifier
      }
    };

    const buckets = await this.queryBuckets(queryParams);

    const expectedTimestamps = this.generateBucketTimestamps(start, end, interval);

    const filledBuckets = this.fillMissingBuckets(
      buckets,
      expectedTimestamps,
      this.getDefaultMetricFields()
    );

    const summary = this.calculateSummary(filledBuckets);

    const responseData = {
      metricType: this.getMetricType(),
      timeRange: {
        start,
        end,
        interval
      },
      filters: {
        user_id: userId,
        team_id: teamId,
        ...(satelliteId && { satellite_id: satelliteId }),
        ...(authIdentifier && { auth_identifier: authIdentifier })
      },
      buckets: filledBuckets,
      summary
    };

    return this.formatResponse(responseData);
  }
}
