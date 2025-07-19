import type { FastifyInstance  } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  GlobalSettingSchema,
  type UpdateGlobalSettingInput
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


export default async function updateGlobalSettingRoute(fastify: FastifyInstance) {
  // PUT /settings/:key - Update existing global setting (admin only)
  fastify.put<{ Params: { key: string }; Body: UpdateGlobalSettingInput }>('/settings/:key', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Update global setting',
      description: 'Updates an existing global setting. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Global setting key' }
        },
        required: ['key']
      },
      body: {
        type: 'object',
        properties: {
          value: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          encrypted: { type: 'boolean' },
          group_id: { type: 'string' }
        },
        additionalProperties: false,
        minProperties: 1
      },
      response: {
        200: createSchema(globalSettingResponseSchema.describe('Global setting updated successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Setting not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireGlobalAdmin()
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      // Fastify has already validated request.body using UpdateGlobalSettingSchema
      const validatedData = request.body;
      
      const setting = await GlobalSettingsService.update(key, validatedData);
      
      if (!setting) {
        const notFoundResponse = {
          success: false,
          error: 'Setting not found'
        };
        const jsonString = JSON.stringify(notFoundResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create clean response with primitive types only
      const cleanResponse = {
        success: true,
        data: {
          key: String(setting.key),
          value: setting.value,
          type: setting.type ? String(setting.type) : null,
          description: setting.description ? String(setting.description) : null,
          is_encrypted: Boolean(setting.is_encrypted),
          group_id: setting.group_id ? String(setting.group_id) : null,
          created_at: setting.created_at ? String(setting.created_at) : null,
          updated_at: setting.updated_at ? String(setting.updated_at) : null
        },
        message: 'Global setting updated successfully'
      };
      
      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse = {
          success: false,
          error: 'Validation error',
          details: error.issues  // Fixed: error.errors → error.issues for Zod v4
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
      
      fastify.log.error(error, 'Error updating global setting');
      const errorResponse = {
        success: false,
        error: 'Failed to update global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
