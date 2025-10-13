/**
 * EventBus Service
 * 
 * Manages event emission, batching, and delivery to the backend.
 * Provides a simple emit() API for components to send events without
 * worrying about batching, retries, or backend communication.
 * 
 * Key Features:
 * - Type-safe event emission
 * - Automatic 3-second batching
 * - Max 100 events per batch
 * - Max 10,000 events in queue (drops oldest on overflow)
 * - Graceful shutdown with 5-second flush timeout
 * - Exponential backoff for rate limiting (429)
 * - Automatic retry for failed batches
 */

import { FastifyBaseLogger } from 'fastify';
import { BackendClient } from './backend-client';
import { SatelliteEvent, EventType, EventDataMap, isValidEventType } from '../events/registry';

export interface EventBusConfig {
  batchIntervalMs?: number;
  maxBatchSize?: number;
  maxQueueSize?: number;
  flushTimeoutMs?: number;
}

export interface EventBusStats {
  queueSize: number;
  totalEmitted: number;
  totalSent: number;
  totalFailed: number;
  totalDropped: number;
  lastBatchSentAt?: string;
  lastErrorAt?: string;
  isShuttingDown: boolean;
}

export class EventBus {
  private logger: FastifyBaseLogger;
  private backendClient: BackendClient;
  private satelliteId: string;
  private config: Required<EventBusConfig>;
  
  private eventQueue: SatelliteEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  private isShuttingDown = false;
  private backoffMs = 0;
  private lastBackoffTime?: Date;
  
  private stats = {
    totalEmitted: 0,
    totalSent: 0,
    totalFailed: 0,
    totalDropped: 0,
    lastBatchSentAt: undefined as string | undefined,
    lastErrorAt: undefined as string | undefined
  };

  constructor(
    satelliteId: string,
    backendClient: BackendClient,
    logger: FastifyBaseLogger,
    config: EventBusConfig = {}
  ) {
    this.satelliteId = satelliteId;
    this.backendClient = backendClient;
    this.logger = logger;
    
    this.config = {
      batchIntervalMs: config.batchIntervalMs || 3000,
      maxBatchSize: config.maxBatchSize || 100,
      maxQueueSize: config.maxQueueSize || 10000,
      flushTimeoutMs: config.flushTimeoutMs || 5000
    };

    this.logger.info({
      operation: 'event_bus_initialized',
      batch_interval_ms: this.config.batchIntervalMs,
      max_batch_size: this.config.maxBatchSize,
      max_queue_size: this.config.maxQueueSize
    }, 'Event bus initialized');
  }

  /**
   * Start the event bus batching timer
   */
  start(): void {
    if (this.batchTimer) {
      this.logger.warn({
        operation: 'event_bus_already_started'
      }, 'Event bus already started');
      return;
    }

    this.batchTimer = setInterval(() => {
      void this.processBatch();
    }, this.config.batchIntervalMs);

    this.logger.info({
      operation: 'event_bus_started',
      batch_interval_ms: this.config.batchIntervalMs
    }, 'Event bus started');
  }

  /**
   * Stop the event bus and flush remaining events
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    
    this.logger.info({
      operation: 'event_bus_stopping',
      queue_size: this.eventQueue.length
    }, 'Event bus stopping, flushing remaining events');

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }

    await this.flushWithTimeout();
  }

  /**
   * Emit an event with type-safe data
   */
  emit<T extends EventType>(type: T, data: EventDataMap[T]): void {
    if (this.isShuttingDown) {
      this.logger.warn({
        operation: 'event_emit_during_shutdown',
        event_type: type
      }, 'Cannot emit event during shutdown');
      return;
    }

    if (!isValidEventType(type)) {
      this.logger.error({
        operation: 'event_emit_invalid_type',
        event_type: type
      }, 'Invalid event type');
      return;
    }

    const event: SatelliteEvent<T> = {
      type,
      timestamp: new Date().toISOString(),
      data
    };

    if (this.eventQueue.length >= this.config.maxQueueSize) {
      const droppedEvent = this.eventQueue.shift();
      this.stats.totalDropped++;
      
      this.logger.warn({
        operation: 'event_queue_overflow',
        queue_size: this.eventQueue.length,
        dropped_event_type: droppedEvent?.type,
        total_dropped: this.stats.totalDropped
      }, 'Event queue full, dropped oldest event');
    }

    this.eventQueue.push(event);
    this.stats.totalEmitted++;

    this.logger.debug({
      operation: 'event_emitted',
      event_type: type,
      queue_size: this.eventQueue.length
    }, 'Event emitted');
  }

  /**
   * Get current event bus statistics
   */
  getStats(): EventBusStats {
    return {
      queueSize: this.eventQueue.length,
      totalEmitted: this.stats.totalEmitted,
      totalSent: this.stats.totalSent,
      totalFailed: this.stats.totalFailed,
      totalDropped: this.stats.totalDropped,
      lastBatchSentAt: this.stats.lastBatchSentAt,
      lastErrorAt: this.stats.lastErrorAt,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Process a batch of events
   */
  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    if (this.backoffMs > 0) {
      const now = Date.now();
      const backoffEnd = this.lastBackoffTime ? this.lastBackoffTime.getTime() + this.backoffMs : now;
      
      if (now < backoffEnd) {
        this.logger.debug({
          operation: 'event_batch_backoff',
          backoff_ms: this.backoffMs,
          remaining_ms: backoffEnd - now,
          queue_size: this.eventQueue.length
        }, 'Skipping batch due to backoff');
        return;
      }
      
      this.backoffMs = 0;
      this.lastBackoffTime = undefined;
    }

    const batchSize = Math.min(this.eventQueue.length, this.config.maxBatchSize);
    const batch = this.eventQueue.slice(0, batchSize);

    this.logger.info({
      operation: 'event_batch_sending',
      event_count: batch.length,
      queue_size: this.eventQueue.length
    }, 'Sending event batch to backend');

    try {
      const result = await this.backendClient.sendEvents(this.satelliteId, batch);

      if (result.success) {
        this.eventQueue.splice(0, batchSize);
        this.stats.totalSent += result.processed || batch.length;
        this.stats.totalFailed += result.failed || 0;
        this.stats.lastBatchSentAt = new Date().toISOString();

        this.logger.info({
          operation: 'event_batch_success',
          sent_count: result.processed || batch.length,
          failed_count: result.failed || 0,
          queue_size: this.eventQueue.length,
          response_time_ms: result.response_time_ms
        }, 'Event batch sent successfully');

        if (result.failures && result.failures.length > 0) {
          this.logger.warn({
            operation: 'event_batch_partial_failure',
            failures: result.failures
          }, 'Some events failed validation');
        }
      } else {
        this.handleBatchError(result.error || 'Unknown error', batch.length);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.handleBatchError(errorMessage, batch.length);
    }
  }

  /**
   * Handle batch send errors with appropriate retry strategy
   */
  private handleBatchError(errorMessage: string, batchSize: number): void {
    this.stats.lastErrorAt = new Date().toISOString();

    if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('validation')) {
      const droppedBatch = this.eventQueue.splice(0, batchSize);
      this.stats.totalDropped += droppedBatch.length;
      
      this.logger.error({
        operation: 'event_batch_validation_error',
        error: errorMessage,
        dropped_count: droppedBatch.length,
        total_dropped: this.stats.totalDropped
      }, 'Dropped batch due to validation error (400)');
      
    } else if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
      this.logger.error({
        operation: 'event_batch_auth_error',
        error: errorMessage,
        queue_size: this.eventQueue.length
      }, 'Authentication failed - events kept in queue');
      
    } else if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
      this.backoffMs = Math.min(this.backoffMs === 0 ? 3000 : this.backoffMs * 2, 48000);
      this.lastBackoffTime = new Date();
      
      this.logger.warn({
        operation: 'event_batch_rate_limited',
        error: errorMessage,
        backoff_ms: this.backoffMs,
        queue_size: this.eventQueue.length
      }, 'Rate limited - applying exponential backoff');
      
    } else {
      this.logger.error({
        operation: 'event_batch_error',
        error: errorMessage,
        queue_size: this.eventQueue.length
      }, 'Event batch failed - will retry in next cycle');
    }
  }

  /**
   * Flush remaining events with timeout
   */
  private async flushWithTimeout(): Promise<void> {
    if (this.eventQueue.length === 0) {
      this.logger.info({
        operation: 'event_bus_flush_empty'
      }, 'No events to flush');
      return;
    }

    const flushPromise = this.processBatch();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, this.config.flushTimeoutMs);
    });

    await Promise.race([flushPromise, timeoutPromise]);

    if (this.eventQueue.length > 0) {
      this.logger.warn({
        operation: 'event_bus_flush_timeout',
        lost_events: this.eventQueue.length
      }, 'Flush timeout - some events lost');
    } else {
      this.logger.info({
        operation: 'event_bus_flush_success'
      }, 'All events flushed successfully');
    }
  }
}
