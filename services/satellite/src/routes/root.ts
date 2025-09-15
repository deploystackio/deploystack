/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSatelliteVersion } from '../config/version';

// Environment variables for controlling status display
const SHOW_UPTIME = process.env.DEPLOYSTACK_STATUS_SHOW_UPTIME !== 'false';
const SHOW_VERSION = process.env.DEPLOYSTACK_STATUS_SHOW_VERSION !== 'false';

// Build dynamic schema based on environment variables
function buildSatelliteStatusSchema() {
  const properties: Record<string, any> = {
    service: { type: 'string' },
    status: { type: 'string', enum: ['healthy', 'degraded', 'error'] },
    timestamp: { type: 'string', format: 'date-time' }
  };

  const required = ['service', 'status', 'timestamp'];

  if (SHOW_VERSION) {
    properties.version = { type: 'string' };
    properties.buildTime = { type: 'string', format: 'date-time' };
    properties.source = { type: 'string' };
    required.push('version', 'buildTime', 'source');
  }

  if (SHOW_UPTIME) {
    properties.uptime = { type: 'number' };
    required.push('uptime');
  }

  return {
    tags: ['Status'],
    summary: 'Get satellite service status',
    description: 'Get the current satellite service version and status information',
    response: {
      200: {
        type: 'object',
        properties,
        required
      }
    }
  };
}

export async function registerSatelliteStatusRoutes(server: FastifyInstance) {
  const startTime = Date.now();

  server.get('/', {
    schema: buildSatelliteStatusSchema()
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({
      operation: 'satellite_status_check',
      endpoint: '/'
    }, 'Satellite status check requested');

    try {
      const status: Record<string, any> = {
        service: 'satellite',
        status: 'healthy' as const,
        timestamp: new Date().toISOString()
      };

      if (SHOW_VERSION) {
        const versionInfo = getSatelliteVersion();
        status.version = versionInfo.version;
        status.buildTime = versionInfo.buildTime;
        status.source = versionInfo.source;
      }

      if (SHOW_UPTIME) {
        const uptime = Math.round((Date.now() - startTime) / 1000);
        status.uptime = uptime;
      }

      const logData: Record<string, any> = { operation: 'satellite_status_response' };
      if (SHOW_VERSION) {
        const versionInfo = getSatelliteVersion();
        logData.version = versionInfo.version;
      }
      if (SHOW_UPTIME) {
        logData.uptime = status.uptime;
      }

      request.log.info(logData, 'Satellite status check completed');

      return reply.code(200).send(status);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      request.log.error({
        operation: 'satellite_status_error',
        error: errorMessage
      }, 'Satellite status check failed');

      // Return error status
      const errorStatus: Record<string, any> = {
        service: 'satellite',
        status: 'error' as const,
        timestamp: new Date().toISOString()
      };

      if (SHOW_VERSION) {
        errorStatus.version = 'unknown';
        errorStatus.buildTime = new Date().toISOString();
        errorStatus.source = 'error';
      }

      if (SHOW_UPTIME) {
        errorStatus.uptime = Math.round((Date.now() - startTime) / 1000);
      }

      return reply.code(500).send(errorStatus);
    }
  });

  server.log.info({
    operation: 'routes_registered',
    routes: ['/']
  }, 'Satellite status routes registered');
}
