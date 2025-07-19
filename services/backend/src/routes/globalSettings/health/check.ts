import type { FastifyInstance  } from 'fastify';
import { createSchema } from 'zod-openapi';
import { validateEncryption } from '../../../utils/encryption';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { z } from 'zod';

// Response schema for health check
const healthResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.object({
    encryption_working: z.boolean().describe('Whether encryption system is working'),
    timestamp: z.string().describe('Health check timestamp')
  }).describe('Health check data'),
  message: z.string().describe('Health status message')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details')
});

export default async function healthCheckRoute(fastify: FastifyInstance) {
  // GET /settings/health - Health check for encryption system (admin only)
  fastify.get('/settings/health', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Health check',
      description: 'Performs a health check on the global settings system, including encryption functionality. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(healthResponseSchema.describe('Health check completed successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      fastify.log.error(error, 'Error checking settings health');
      
      const errorResponse = {
        success: false,
        error: 'Failed to check settings health'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
