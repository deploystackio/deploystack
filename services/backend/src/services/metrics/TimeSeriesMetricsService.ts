import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';

export interface QueryParams {
  startTime: Date;
  endTime: Date;
  interval: string;
  filters: Record<string, string>;
}

export interface BucketData {
  timestamp: number;
  [key: string]: number;
}

export interface SummaryStats {
  total_buckets: number;
  [key: string]: number | string;
}

export interface ResponseData {
  metricType: string;
  timeRange: {
    start: Date;
    end: Date;
    interval: string;
  };
  filters: Record<string, string>;
  buckets: BucketData[];
  summary: SummaryStats;
}

export interface StandardResponse {
  success: boolean;
  data: {
    metric_type: string;
    time_range: {
      start: string;
      end: string;
      interval: string;
    };
    filters: Record<string, string>;
    buckets: Array<{
      timestamp: string;
      [key: string]: number | string;
    }>;
    summary: SummaryStats;
  };
}

const VALID_INTERVALS = ['15m', '1h'] as const;
const INTERVAL_SECONDS: Record<string, number> = {
  '15m': 900,
  '1h': 3600
};

const MAX_TIME_RANGE_DAYS = 30;

export abstract class TimeSeriesMetricsService {
  constructor(
    protected db: AnyDatabase,
    protected logger: FastifyBaseLogger
  ) {}

  abstract getMetricType(): string;
  abstract queryBuckets(params: QueryParams): Promise<BucketData[]>;

  parseTimeRange(range: string): { start: Date; end: Date } {
    const match = range.match(/^(\d+)(h|d)$/);
    
    if (!match) {
      throw new Error(
        `Invalid time range format: '${range}'. Expected format: '3h', '24h', '7d'`
      );
    }

    const [, numStr, unit] = match;
    const num = parseInt(numStr, 10);

    if (isNaN(num) || num <= 0) {
      throw new Error(`Invalid time range value: '${range}'. Value must be positive`);
    }

    const now = new Date();
    let milliseconds: number;

    switch (unit) {
      case 'h':
        milliseconds = num * 60 * 60 * 1000;
        break;
      case 'd':
        milliseconds = num * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error(
          `Unsupported time unit: '${unit}'. Supported: 'h' (hours), 'd' (days)`
        );
    }

    const maxMilliseconds = MAX_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (milliseconds > maxMilliseconds) {
      throw new Error(`Time range exceeds maximum (${MAX_TIME_RANGE_DAYS} days)`);
    }

    const start = new Date(now.getTime() - milliseconds);
    const end = now;

    this.logger.debug({
      operation: 'parse_time_range',
      input: range,
      start: start.toISOString(),
      end: end.toISOString()
    }, 'Parsed time range');

    return { start, end };
  }

  validateInterval(interval: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!VALID_INTERVALS.includes(interval as any)) {
      throw new Error(
        `Invalid interval: '${interval}'. Supported: ${VALID_INTERVALS.join(', ')}`
      );
    }
  }

  generateBucketTimestamps(start: Date, end: Date, interval: string): number[] {
    this.validateInterval(interval);

    const intervalSeconds = INTERVAL_SECONDS[interval];
    
    const startSeconds = Math.floor(start.getTime() / 1000);
    const endSeconds = Math.floor(end.getTime() / 1000);

    const roundedStartSeconds = Math.floor(startSeconds / intervalSeconds) * intervalSeconds;

    const timestamps: number[] = [];
    let currentSeconds = roundedStartSeconds;

    while (currentSeconds < endSeconds) {
      timestamps.push(currentSeconds);
      currentSeconds += intervalSeconds;
    }

    this.logger.debug({
      operation: 'generate_bucket_timestamps',
      interval,
      start: start.toISOString(),
      end: end.toISOString(),
      roundedStart: new Date(roundedStartSeconds * 1000).toISOString(),
      bucketCount: timestamps.length
    }, 'Generated bucket timestamps');

    return timestamps;
  }

  fillMissingBuckets(buckets: BucketData[], timestamps: number[]): BucketData[] {
    const bucketMap = new Map<number, BucketData>();
    
    for (const bucket of buckets) {
      bucketMap.set(bucket.timestamp, bucket);
    }

    const filledBuckets: BucketData[] = [];
    
    for (const timestamp of timestamps) {
      if (bucketMap.has(timestamp)) {
        filledBuckets.push(bucketMap.get(timestamp)!);
      } else {
        const zeroBucket: BucketData = { timestamp };
        
        if (buckets.length > 0) {
          const sampleBucket = buckets[0];
          for (const key of Object.keys(sampleBucket)) {
            if (key !== 'timestamp') {
              zeroBucket[key] = 0;
            }
          }
        }
        
        filledBuckets.push(zeroBucket);
      }
    }

    this.logger.debug({
      operation: 'fill_missing_buckets',
      expectedBuckets: timestamps.length,
      actualBuckets: buckets.length,
      filledBuckets: filledBuckets.length
    }, 'Filled missing buckets');

    return filledBuckets;
  }

  calculateSummary(buckets: BucketData[]): SummaryStats {
    const summary: SummaryStats = {
      total_buckets: buckets.length
    };

    if (buckets.length === 0) {
      return summary;
    }

    const metricKeys = Object.keys(buckets[0]).filter(k => k !== 'timestamp');
    
    for (const key of metricKeys) {
      let total = 0;
      let peak = 0;
      let peakTimestamp: number | null = null;

      for (const bucket of buckets) {
        const value = bucket[key] || 0;
        total += value;
        
        if (value > peak) {
          peak = value;
          peakTimestamp = bucket.timestamp;
        }
      }

      const average = total / buckets.length;

      summary[`total_${key}`] = total;
      summary[`average_${key}`] = Math.round(average * 100) / 100;
      summary[`peak_${key}`] = peak;
      
      if (peakTimestamp !== null) {
        summary[`peak_${key}_timestamp`] = new Date(peakTimestamp * 1000).toISOString();
      }
    }

    this.logger.debug({
      operation: 'calculate_summary',
      bucketCount: buckets.length,
      metricKeys,
      summary
    }, 'Calculated summary statistics');

    return summary;
  }

  formatResponse(data: ResponseData): StandardResponse {
    const formattedBuckets = data.buckets.map(bucket => {
      const formatted: { timestamp: string; [key: string]: number | string } = {
        timestamp: new Date(bucket.timestamp * 1000).toISOString()
      };

      for (const [key, value] of Object.entries(bucket)) {
        if (key !== 'timestamp') {
          formatted[key] = value;
        }
      }

      return formatted;
    });

    return {
      success: true,
      data: {
        metric_type: data.metricType,
        time_range: {
          start: data.timeRange.start.toISOString(),
          end: data.timeRange.end.toISOString(),
          interval: data.timeRange.interval
        },
        filters: data.filters,
        buckets: formattedBuckets,
        summary: data.summary
      }
    };
  }
}
