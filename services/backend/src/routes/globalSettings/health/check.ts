import type { FastifyInstance  } from 'fastify';
import { validateEncryption } from '../../../utils/encryption';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';

const HEALTH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        encryption_working: { type: 'boolean' },
        timestamp: { type: 'string' }
      },
      required: ['encryption_working', 'timestamp']
    },
    message: { type: 'string' }
  },
  required: ['success', 'data', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export default async function healthCheckRoute(server: FastifyInstance) {
  // GET /settings/health - Health check for encryption system (admin only)
  server.get('/settings/health', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Health check',
      description: 'Performs a health check on the global settings system, including encryption functionality. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...HEALTH_RESPONSE_SCHEMA,
          description: 'Health check completed successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    },
    preValidation: requireGlobalAdmin()
  }, async (request, reply) => {
    try {
      const encryptionWorking = validateEncryption();

      // Create clean response with primitive types only
      const cleanResponse = {
        success: true,
        data: {
          encryption_working: Boolean(encryptionWorking),
          timestamp: String(new Date().toISOString())
        },
        message: encryptionWorking
          ? 'Global settings system is healthy'
          : 'Warning: Encryption system is not working properly'
      };

      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error checking settings health');

      const errorResponse = {
        success: false,
        error: 'Failed to check settings health'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
