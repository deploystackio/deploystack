import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { GlobalSettingSchema } from '../schemas';
import { z } from 'zod';

// Response schema for listing global settings
const globalSettingsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Array of global settings')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});

export default async function listGlobalSettingsRoute(fastify: FastifyInstance) {
  // GET /settings - List all global settings (admin only)
  fastify.get('/settings', {
    schema: {
      tags: ['Global Settings'],
      summary: 'List all global settings',
      description: 'Retrieves all global settings in the system. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(globalSettingsListResponseSchema.describe('Successfully retrieved global settings'), {
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await GlobalSettingsService.getAll();
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching global settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch global settings',
      });
    }
  });
}
