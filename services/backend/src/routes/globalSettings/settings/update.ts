import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  UpdateGlobalSettingSchema,
  GlobalSettingSchema,
  type UpdateGlobalSettingInput,
} from '../schemas';
import { z } from 'zod';

// Response schema for updating global setting
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

export default async function updateGlobalSettingRoute(fastify: FastifyInstance) {
  // PUT /settings/:key - Update existing global setting (admin only)
  fastify.put<{ Params: { key: string }; Body: UpdateGlobalSettingInput }>('/settings/:key', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Update global setting',
      description: 'Updates an existing global setting. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithKeySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      body: zodToJsonSchema(UpdateGlobalSettingSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingResponseSchema.describe('Global setting updated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error'), {
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
    preValidation: requireGlobalAdmin(),
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      // Fastify has already validated request.body using UpdateGlobalSettingSchema
      const validatedData = request.body;
      
      const setting = await GlobalSettingsService.update(key, validatedData);
      
      if (!setting) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: setting,
        message: 'Global setting updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error updating global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update global setting',
      });
    }
  });
}
