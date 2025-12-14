import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq, and, desc } from 'drizzle-orm';
import { requireSatelliteAuth, requireUserOrSatelliteAuth } from '../../middleware/satelliteAuthMiddleware';

/**
 * Auto-detect satellite URL from request context
 * Uses X-Forwarded-* headers if available (reverse proxy support)
 * Falls back to request.protocol and request.hostname
 */
function detectSatelliteUrl(request: FastifyRequest): string {
  // Check for reverse proxy headers first
  const forwardedProto = request.headers['x-forwarded-proto'] as string | undefined;
  const forwardedHost = request.headers['x-forwarded-host'] as string | undefined;

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Fallback to direct request properties
  const protocol = request.protocol || 'http';
  const hostname = request.hostname;

  return `${protocol}://${hostname}`;
}

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

const HEARTBEAT_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['active', 'degraded', 'error'],
      description: 'Current satellite status'
    },
    system_metrics: {
      type: 'object',
      properties: {
        cpu_usage_percent: { type: 'number', minimum: 0, maximum: 100 },
        memory_usage_mb: { type: 'number', minimum: 0 },
        disk_usage_percent: { type: 'number', minimum: 0, maximum: 100 },
        uptime_seconds: { type: 'number', minimum: 0 },
        network_rx_bytes: { type: 'number', minimum: 0 },
        network_tx_bytes: { type: 'number', minimum: 0 }
      },
      required: ['cpu_usage_percent', 'memory_usage_mb'],
      description: 'System resource metrics'
    },
    processes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Process ID' },
          server_name: { type: 'string', description: 'MCP server name' },
          status: {
            type: 'string',
            enum: ['pending', 'starting', 'running', 'stopping', 'stopped', 'failed'],
            description: 'Process status'
          },
          health_status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'unknown'],
            description: 'Process health status'
          },
          performance_metrics: {
            type: 'object',
            properties: {
              total_requests: { type: 'number', minimum: 0 },
              avg_response_time_ms: { type: 'number', minimum: 0 },
              error_count: { type: 'number', minimum: 0 },
              memory_usage_mb: { type: 'number', minimum: 0 }
            },
            description: 'Process performance metrics'
          }
        },
        required: ['id', 'server_name', 'status', 'health_status']
      },
      description: 'List of running MCP server processes'
    },
    error_count: {
      type: 'integer',
      minimum: 0,
      description: 'Recent error count'
    },
    version: {
      type: 'string',
      description: 'Satellite software version'
    },
    satellite_url: {
      type: 'string',
      description: 'Publicly accessible satellite URL (optional - only sent on first heartbeat after startup)'
    }
  },
  required: ['status', 'system_metrics'],
  additionalProperties: false
} as const;

const STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    satellite: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Satellite ID' },
        name: { type: 'string', description: 'Satellite name' },
        status: { 
          type: 'string', 
          enum: ['active', 'inactive', 'maintenance', 'error'],
          description: 'Satellite status'
        },
        last_heartbeat: { 
          type: 'string', 
          format: 'date-time',
          description: 'Last heartbeat timestamp'
        }
      },
      required: ['id', 'name', 'status']
    },
    processes: {
      type: 'object',
      properties: {
        total: { type: 'integer', description: 'Total process count' },
        healthy: { type: 'integer', description: 'Healthy process count' },
        unhealthy: { type: 'integer', description: 'Unhealthy process count' }
      },
      required: ['total', 'healthy', 'unhealthy']
    },
    system_metrics: {
      type: 'object',
      properties: {
        cpu_usage_percent: { type: 'number' },
        memory_usage_mb: { type: 'number' },
        disk_usage_percent: { type: 'number' },
        uptime_seconds: { type: 'number' }
      },
      description: 'Latest system metrics'
    }
  },
  required: ['satellite', 'processes']
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
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

interface HeartbeatRequest {
  status: 'active' | 'degraded' | 'error';
  system_metrics: {
    cpu_usage_percent: number;
    memory_usage_mb: number;
    disk_usage_percent?: number;
    uptime_seconds?: number;
    network_rx_bytes?: number;
    network_tx_bytes?: number;
  };
  processes?: Array<{
    id: string;
    server_name: string;
    status: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
    health_status: 'healthy' | 'unhealthy' | 'unknown';
    performance_metrics?: {
      total_requests?: number;
      avg_response_time_ms?: number;
      error_count?: number;
      memory_usage_mb?: number;
    };
  }>;
  error_count?: number;
  version?: string;
  satellite_url?: string; // Optional - only sent on first heartbeat after startup
}

interface StatusResponse {
  satellite: {
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'maintenance' | 'error';
    last_heartbeat?: string;
  };
  processes: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  system_metrics?: {
    cpu_usage_percent?: number;
    memory_usage_mb?: number;
    disk_usage_percent?: number;
    uptime_seconds?: number;
  };
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function satelliteHeartbeatRoute(server: FastifyInstance) {
  // POST /api/satellites/{satelliteId}/heartbeat - Satellite health and metrics reporting
  server.post('/satellites/:satelliteId/heartbeat', {
    preValidation: [requireSatelliteAuth()], // Satellite API key authentication
    schema: {
      tags: ['Satellite Health'],
      summary: 'Report satellite health and metrics',
      description: 'Satellite reports health status and system metrics. Requires Content-Type: application/json header when sending request body.',
      security: [{ bearerAuth: [] }],
      
      params: SATELLITE_ID_PARAM_SCHEMA,
      body: HEARTBEAT_REQUEST_SCHEMA,
      
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: HEARTBEAT_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Heartbeat recorded successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid heartbeat data'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Invalid satellite API key'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Satellite not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { satelliteId } = request.params as SatelliteIdParams;
    const { status, system_metrics, processes = [], error_count = 0, version, satellite_url } = request.body as HeartbeatRequest;

    const db = getDb();
    const { satellites, satelliteHeartbeats, satelliteProcesses } = getSchema();

    try {
      // Verify satellite exists
      const satellite = await db
        .select()
        .from(satellites)
        .where(eq(satellites.id, satelliteId))
        .limit(1);

      if (satellite.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Satellite not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const now = new Date();

      // Prepare update data
      const updateData: {
        last_heartbeat: Date;
        status: 'active';
        updated_at: Date;
        satellite_url?: string;
      } = {
        last_heartbeat: now,
        status: 'active', // Automatically activate satellite when it sends heartbeat
        updated_at: now
      };

      // Update satellite URL if provided in heartbeat (first heartbeat after startup)
      // satellite_url field is only present on first heartbeat after satellite restart
      if (satellite_url !== undefined) {
        let finalSatelliteUrl: string;

        if (satellite_url === '') {
          // Empty string signals auto-detect from request headers
          finalSatelliteUrl = detectSatelliteUrl(request);
          request.log.info({
            operation: 'satellite_url_update_autodetect',
            satelliteId,
            satellite_url: finalSatelliteUrl,
            headers: {
              'x-forwarded-proto': request.headers['x-forwarded-proto'],
              'x-forwarded-host': request.headers['x-forwarded-host']
            }
          }, 'Auto-detected satellite URL from request headers (first heartbeat after startup)');
        } else {
          // Explicit URL from DEPLOYSTACK_SATELLITE_URL env var
          finalSatelliteUrl = satellite_url;
          request.log.info({
            operation: 'satellite_url_update_explicit',
            satelliteId,
            satellite_url: finalSatelliteUrl
          }, 'Updating satellite URL from explicit configuration (first heartbeat after startup)');
        }

        updateData.satellite_url = finalSatelliteUrl;
      }

      // Update satellite last_heartbeat, status, and optionally satellite_url
      await db
        .update(satellites)
        .set(updateData)
        .where(eq(satellites.id, satelliteId));
      
      // Count healthy and total processes
      const healthyProcessCount = processes.filter(p => p.health_status === 'healthy').length;
      const totalProcessCount = processes.length;
      
      // Record heartbeat (cleanup is handled by background cron job)
      await db
        .insert(satelliteHeartbeats)
        .values({
          id: `hb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          satellite_id: satelliteId,
          status,
          system_metrics: JSON.stringify(system_metrics),
          process_count: totalProcessCount,
          healthy_process_count: healthyProcessCount,
          error_count,
          response_time_ms: null, // Will be calculated by backend if needed
          uptime_seconds: system_metrics.uptime_seconds || null,
          version,
          timestamp: now
        });
      
      // Update process statuses if provided
      if (processes.length > 0) {
        for (const processInfo of processes) {
          // Update existing process or create new one
          const existingProcess = await db
            .select()
            .from(satelliteProcesses)
            .where(and(
              eq(satelliteProcesses.satellite_id, satelliteId),
              eq(satelliteProcesses.id, processInfo.id)
            ))
            .limit(1);
          
          const updateData = {
            status: processInfo.status,
            health_status: processInfo.health_status,
            performance_metrics: processInfo.performance_metrics ? JSON.stringify(processInfo.performance_metrics) : null,
            updated_at: now
          };
          
          if (existingProcess.length > 0) {
            // Update existing process
            await db
              .update(satelliteProcesses)
              .set(updateData)
              .where(eq(satelliteProcesses.id, processInfo.id));
          } else {
            // Create new process record (this might happen if process was started outside of command system)
            await db
              .insert(satelliteProcesses)
              .values({
                id: processInfo.id,
                satellite_id: satelliteId,
                server_name: processInfo.server_name,
                team_id: satellite[0].team_id || 'global', // Use satellite's team or 'global'
                ...updateData,
                created_at: now
              });
          }
        }
      }
      
      request.log.info({
        operation: 'satellite_heartbeat',
        satelliteId,
        status,
        processCount: totalProcessCount,
        healthyProcesses: healthyProcessCount,
        errorCount: error_count,
        version
      }, 'Satellite heartbeat recorded');
      
      const successResponse: SuccessResponse = {
        success: true,
        message: `Heartbeat recorded for satellite ${satelliteId}`
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({
        operation: 'satellite_heartbeat',
        satelliteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to record satellite heartbeat');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error while recording heartbeat'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
  
  // GET /api/satellites/{satelliteId}/status - Real-time satellite status for user interfaces
  server.get('/satellites/:satelliteId/status', {
    preValidation: [requireUserOrSatelliteAuth()], // User or satellite authentication
    schema: {
      tags: ['Satellite Health'],
      summary: 'Get satellite status',
      description: 'Get real-time satellite status and metrics for user interfaces.',
      security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      
      params: SATELLITE_ID_PARAM_SCHEMA,
      
      response: {
        200: {
          ...STATUS_RESPONSE_SCHEMA,
          description: 'Satellite status information'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Satellite not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    const { satelliteId } = request.params as SatelliteIdParams;

    const db = getDb();
    const { satellites, satelliteHeartbeats, satelliteProcesses } = getSchema();

    try {
      // Get satellite info
      const satellite = await db
        .select({
          id: satellites.id,
          name: satellites.name,
          status: satellites.status,
          last_heartbeat: satellites.last_heartbeat
        })
        .from(satellites)
        .where(eq(satellites.id, satelliteId))
        .limit(1);
      
      if (satellite.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Satellite not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }
      
      // Get process counts
      const processes = await db
        .select({
          status: satelliteProcesses.status,
          health_status: satelliteProcesses.health_status
        })
        .from(satelliteProcesses)
        .where(eq(satelliteProcesses.satellite_id, satelliteId));
      
      const totalProcesses = processes.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const healthyProcesses = processes.filter((p: any) => p.health_status === 'healthy').length;
      const unhealthyProcesses = totalProcesses - healthyProcesses;
      
      // Get latest system metrics
      const latestHeartbeat = await db
        .select({
          system_metrics: satelliteHeartbeats.system_metrics
        })
        .from(satelliteHeartbeats)
        .where(eq(satelliteHeartbeats.satellite_id, satelliteId))
        .orderBy(desc(satelliteHeartbeats.timestamp))
        .limit(1);
      
      let systemMetrics = undefined;
      if (latestHeartbeat.length > 0) {
        try {
          systemMetrics = JSON.parse(latestHeartbeat[0].system_metrics);
        } catch {
          // Ignore JSON parse errors
        }
      }
      
      const response: StatusResponse = {
        satellite: {
          id: satellite[0].id,
          name: satellite[0].name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: satellite[0].status as any,
          last_heartbeat: satellite[0].last_heartbeat?.toISOString()
        },
        processes: {
          total: totalProcesses,
          healthy: healthyProcesses,
          unhealthy: unhealthyProcesses
        },
        system_metrics: systemMetrics
      };
      
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
      
    } catch (error) {
      request.log.error({
        operation: 'satellite_status',
        satelliteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get satellite status');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Internal server error while getting satellite status'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
