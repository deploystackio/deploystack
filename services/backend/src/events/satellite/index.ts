/**
 * Satellite Event Dispatcher
 * 
 * Convention-based event handler system that auto-discovers and routes events
 * to appropriate handlers based on event type.
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type {
  EventHandlerRegistry, 
  SatelliteEvent,
  EventProcessingResult 
} from './types';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { FastifyBaseLogger } from 'fastify';

// Auto-discover event handlers from this directory
// Convention: Each handler exports EVENT_TYPE, SCHEMA, and handle()
const handlerModules = [
  () => import('./mcp-server-started'),
  () => import('./mcp-tool-executed'),
  () => import('./mcp-server-crashed'),
  () => import('./mcp-client-activity'),
  // Add new handlers here - they will be automatically registered
];

// Initialize AJV validator
const ajv = new Ajv({ 
  allErrors: true,
  strict: false,
  strictTypes: false 
});
addFormats(ajv);

/**
 * Build event handler registry by loading all handler modules
 */
async function buildEventRegistry(): Promise<EventHandlerRegistry> {
  const registry: EventHandlerRegistry = {};
  
  for (const loadHandler of handlerModules) {
    try {
      const handler = await loadHandler();
      
      // Validate handler exports required fields
      if (!handler.EVENT_TYPE || !handler.SCHEMA || !handler.handle) {
        console.error('Invalid event handler - missing required exports:', handler);
        continue;
      }
      
      registry[handler.EVENT_TYPE] = {
        EVENT_TYPE: handler.EVENT_TYPE,
        SCHEMA: handler.SCHEMA,
        handle: handler.handle
      };
    } catch (error) {
      console.error('Failed to load event handler:', error);
    }
  }
  
  return registry;
}

// Singleton registry instance
let eventRegistry: EventHandlerRegistry | null = null;

/**
 * Get or initialize event handler registry
 */
async function getEventRegistry(): Promise<EventHandlerRegistry> {
  if (!eventRegistry) {
    eventRegistry = await buildEventRegistry();
  }
  return eventRegistry;
}

/**
 * Process a single event
 */
async function processEvent(
  satelliteId: string,
  event: SatelliteEvent,
  db: LibSQLDatabase,
  logger: FastifyBaseLogger
): Promise<EventProcessingResult> {
  try {
    const registry = await getEventRegistry();
    
    // Check if event type is registered
    const handler = registry[event.type];
    if (!handler) {
      logger.warn({ eventType: event.type }, 'Unknown event type');
      return {
        success: false,
        error: `Unknown event type: ${event.type}`
      };
    }
    
    // Validate event data against handler schema
    const validate = ajv.compile(handler.SCHEMA);
    const valid = validate(event.data);
    
    if (!valid) {
      const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ');
      logger.warn({ 
        eventType: event.type, 
        validationErrors: errors 
      }, 'Event validation failed');
      return {
        success: false,
        error: `Validation failed: ${errors}`
      };
    }
    
    // Parse event timestamp
    const eventTimestamp = new Date(event.timestamp);
    if (isNaN(eventTimestamp.getTime())) {
      return {
        success: false,
        error: 'Invalid timestamp format'
      };
    }
    
    // Execute handler
    await handler.handle(satelliteId, event.data, db, eventTimestamp);
    
    logger.info({ 
      satelliteId, 
      eventType: event.type 
    }, 'Event processed successfully');
    
    return {
      success: true,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
  } catch (error) {
    logger.error({ 
      satelliteId, 
      eventType: event.type, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Event processing failed');
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process batch of events from satellite
 * 
 * @param satelliteId - Satellite identifier
 * @param events - Array of events to process
 * @param db - Database instance
 * @param logger - Fastify logger
 * @returns Batch processing results
 */
export async function processBatch(
  satelliteId: string,
  events: SatelliteEvent[],
  db: LibSQLDatabase,
  logger: FastifyBaseLogger
): Promise<{
  processed: number;
  failed: number;
  eventIds: string[];
  failures: Array<{ index: number; type: string; error: string; }>;
}> {
  const results = {
    processed: 0,
    failed: 0,
    eventIds: [] as string[],
    failures: [] as Array<{ index: number; type: string; error: string; }>
  };
  
  // Process each event individually
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const result = await processEvent(satelliteId, event, db, logger);
    
    if (result.success && result.eventId) {
      results.processed++;
      results.eventIds.push(result.eventId);
    } else {
      results.failed++;
      results.failures.push({
        index: i,
        type: event.type,
        error: result.error || 'Unknown error'
      });
    }
  }
  
  logger.info({
    satelliteId,
    batchSize: events.length,
    processed: results.processed,
    failed: results.failed
  }, 'Batch processing complete');
  
  return results;
}

/**
 * Get list of registered event types
 * Useful for debugging and documentation
 */
export async function getRegisteredEventTypes(): Promise<string[]> {
  const registry = await getEventRegistry();
  return Object.keys(registry);
}
