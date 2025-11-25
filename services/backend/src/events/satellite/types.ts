/**
 * Shared TypeScript interfaces for satellite event system
 */

import type { AnyDatabase } from '../../db';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Base event structure that all events must conform to
 */
export interface SatelliteEvent {
  type: string;
  timestamp: string; // ISO 8601 format
  data: Record<string, unknown>;
}

/**
 * Batched events request structure
 */
export interface EventBatchRequest {
  events: SatelliteEvent[];
}

/**
 * Event processing result for single event
 */
export interface EventProcessingResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Batch processing response structure
 */
export interface EventBatchResponse {
  success: boolean;
  processed: number;
  failed: number;
  event_ids: string[];
  failures?: Array<{
    index: number;
    type: string;
    error: string;
  }>;
}

/**
 * Event handler interface that all handlers must implement
 */
export interface EventHandler {
  EVENT_TYPE: string;
  SCHEMA: Record<string, unknown>;
  handle: (
    satelliteId: string,
    eventData: Record<string, unknown>,
    db: AnyDatabase,
    eventTimestamp: Date,
    logger: FastifyBaseLogger
  ) => Promise<void>;
}

/**
 * Event handler registry mapping event types to handlers
 */
export interface EventHandlerRegistry {
  [eventType: string]: EventHandler;
}
