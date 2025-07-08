import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  CreateGlobalSettingSchema,
  GlobalSettingSchema,
  type CreateGlobalSettingInput,
} from '../schemas';
import { z } from 'zod';

// Response schema for creating global setting
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

export default async function createGlobalSettingRoute(fastify: FastifyInstance) {
  // POST /settings - Create new global setting (admin only)
  fastify.post<{ Body: CreateGlobalSettingInput }>('/settings', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Create new global setting',
      description: 'Creates a new global setting with the specified key, value, and metadata. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      body: zodToJsonSchema(CreateGlobalSettingSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        201: zodToJsonSchema(globalSettingResponseSchema.describe('Global setting created successfully'), {
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
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Setting with this key already exists'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    onRequest: requireGlobalAdmin(),
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using CreateGlobalSettingSchema
      const validatedData = request.body;
      
      // Check if setting already exists
      const existing = await GlobalSettingsService.exists(validatedData.key);
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: 'Setting with this key already exists. Use PUT to update.',
        });
      }

      const setting = await GlobalSettingsService.setTyped(
        validatedData.key,
        validatedData.value,
        validatedData.type,
        {
          description: validatedData.description,
          encrypted: validatedData.encrypted,
          group_id: validatedData.group_id,
        }
      );

      return reply.status(201).send({
        success: true,
        data: setting,
        message: 'Global setting created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error creating global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to create global setting',
      });
    }
  });
}
