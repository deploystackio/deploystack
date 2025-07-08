import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
        200: zodToJsonSchema(healthResponseSchema.describe('Health check completed successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preValidation: requireGlobalAdmin(),
  }, async (request, reply) => {
    try {
      const encryptionWorking = validateEncryption();
      
      return reply.status(200).send({
        success: true,
        data: {
          encryption_working: encryptionWorking,
          timestamp: new Date().toISOString(),
        },
        message: encryptionWorking 
          ? 'Global settings system is healthy'
          : 'Warning: Encryption system is not working properly',
      });
    } catch (error) {
      fastify.log.error(error, 'Error checking settings health');
      return reply.status(500).send({
        success: false,
        error: 'Failed to check settings health',
      });
    }
  });
}
