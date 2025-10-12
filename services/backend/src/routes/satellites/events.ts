/**
 * Satellite Events Endpoint
 * 
 * Receives batched events from satellites for real-time tracking and analytics
 */

import { type FastifyInstance } from 'fastify';
import { getDb } from '../../db';
import { requireSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';
import { processBatch } from '../../events/satellite';
import type { SatelliteEvent } from '../../events/satellite/types';

// Reusable Schema Constants
const SATELLITE_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    satelliteId: { 
      type: 'string', 
      minLength: 1,
      description: 'Unique satellite identifier'
    }
  },
  required: ['satelliteId'],
  additionalProperties: false
} as const;

const EVENT_BATCH_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            minLength: 1,
            description: 'Event type identifier (e.g., mcp.client.connected)'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Event timestamp in ISO 8601 format'
          },
          data: {
            type: 'object',
            description: 'Event-specific data payload'
          }
        },
        required: ['type', 'timestamp', 'data'],
        additionalProperties: false
      },
      description: 'Array of events to process (1-100 events per batch)'
    }
  },
  required: ['events'],
  additionalProperties: false
} as const;

const BATCH_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Overall batch processing success'
    },
    processed: { 
      type: 'number',
      description: 'Number of events successfully processed'
    },
    failed: { 
      type: 'number',
      description: 'Number of events that failed processing'
    },
    event_ids: {
      type: 'array',
      items: { type: 'string' },
      description: 'Generated event IDs for successfully processed events'
    },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { 
            type: 'number',
            description: 'Event index in the batch that failed'
          },
          type: { 
            type: 'string',
            description: 'Event type that failed'
          },
          error: { 
            type: 'string',
            description: 'Error message describing the failure'
          }
        },
        required: ['index', 'type', 'error']
      },
      description: 'Details of failed events (only present if failures occurred)'
    }
  },
  required: ['success', 'processed', 'failed', 'event_ids']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface SatelliteIdParams {
  satelliteId: string;
}

interface EventBatchRequest {
  events: SatelliteEvent[];
}

interface BatchSuccessResponse {
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

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function satelliteEventsRoute(server: FastifyInstance) {
  // POST /api/satellites/{satelliteId}/events - Receive batched events from satellite
  server.post('/satellites/:satelliteId/events', {
    preValidation: [requireSatelliteAuth()],
    schema: {
      tags: ['Satellite Events'],
      summary: 'Process batch of satellite events',
      description: 'Receives and processes batched events from satellites for real-time tracking and analytics. Satellites send 1-100 events per request. Requires Content-Type: application/json header when sending request body.',
      security: [{ bearerAuth: [] }],
      
      params: SATELLITE_ID_PARAM_SCHEMA,
      body: EVENT_BATCH_REQUEST_SCHEMA,
      
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: EVENT_BATCH_REQUEST_SCHEMA,
            examples: {
              'multiple-events': {
                summary: 'Batch with multiple event types',
                value: {
                  events: [
                    {
                      type: 'mcp.server.started',
                      timestamp: '2025-01-10T10:30:45.123Z',
                      data: {
                        processId: 'proc-123',
                        serverId: 'filesystem-team-xyz',
                        serverName: 'Filesystem MCP',
                        teamId: 'team-xyz',
                        pid: 12345,
                        localPort: 8080
                      }
                    },
                    {
                      type: 'mcp.tool.executed',
                      timestamp: '2025-01-10T10:30:46.456Z',
                      data: {
                        processId: 'proc-123',
                        toolName: 'filesystem/read_file',
                        serverId: 'filesystem-team-xyz',
                        teamId: 'team-xyz',
                        durationMs: 234,
                        statusCode: 200
                      }
                    },
                    {
                      type: 'mcp.server.crashed',
                      timestamp: '2025-01-10T10:30:47.789Z',
                      data: {
                        processId: 'proc-456',
                        serverId: 'github-team-xyz',
                        serverName: 'GitHub MCP',
                        teamId: 'team-xyz',
                        exitCode: 1,
                        errorMessage: 'Out of memory'
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      
      response: {
        200: {
          ...BATCH_SUCCESS_RESPONSE_SCHEMA,
          description: 'Batch processed (may include partial failures)'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid batch structure or size'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid satellite API key'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { satelliteId } = request.params as SatelliteIdParams;
    const { events } = request.body as EventBatchRequest;
    
    const db = getDb();
    
    try {
      // Validate batch size constraints
      if (!events || !Array.isArray(events)) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: "Invalid request: 'events' array required"
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
      
      if (events.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Empty event batch: at least 1 event required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
      
      if (events.length > 100) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Batch too large: maximum 100 events per request (received ${events.length})`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
      
      // Process batch using event dispatcher
      const startTime = Date.now();
      const results = await processBatch(satelliteId, events, db, request.log);
      const processingTime = Date.now() - startTime;
      
      request.log.info({
        operation: 'satellite_events_batch',
        satelliteId,
        batchSize: events.length,
        processed: results.processed,
        failed: results.failed,
        processingTimeMs: processingTime
      }, 'Event batch processed');
      
      // Return batch results
      const successResponse: BatchSuccessResponse = {
        success: true,
        processed: results.processed,
        failed: results.failed,
        event_ids: results.eventIds
      };
      
      // Include failures array only if there were failures
      if (results.failures.length > 0) {
        successResponse.failures = results.failures;
      }
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({
        operation: 'satellite_events_batch',
        satelliteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process event batch');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error while processing event batch'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
