import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { GlobalSettingSchema } from '../schemas';
import { z } from 'zod';

// Response schema for single global setting
const globalSettingResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: GlobalSettingSchema.optional().describe('Global setting data'),
  message: z.string().optional().describe('Success message')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});

const paramsWithKeySchema = z.object({
  key: z.string().describe('Global setting key')
});

export default async function getGlobalSettingRoute(fastify: FastifyInstance) {
  // GET /settings/:key - Get specific global setting (admin only)
  fastify.get<{ Params: { key: string } }>('/settings/:key', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get global setting by key',
      description: 'Retrieves a specific global setting by its key. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithKeySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingResponseSchema.describe('Global setting retrieved successfully'), {
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
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Setting not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requireGlobalAdmin(),
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      const setting = await GlobalSettingsService.get(key);
      
      if (!setting) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: setting,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch global setting',
      });
    }
  });
}
