import type { FastifyInstance  } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  GlobalSettingSchema,
  type CreateGlobalSettingInput
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
      body: {
        type: 'object',
        properties: {
          key: { type: 'string', minLength: 1, maxLength: 255, pattern: '^[a-zA-Z0-9._-]+$' },
          value: { type: ['string', 'number', 'boolean'] }, // Allow multiple types without oneOf
          type: { type: 'string', enum: ['string', 'number', 'boolean'] },
          description: { type: 'string' },
          encrypted: { type: 'boolean', default: false },
          group_id: { type: 'string' }
        },
        required: ['key', 'value', 'type'],
        additionalProperties: false
      },
      response: {
        201: createSchema(globalSettingResponseSchema.describe('Global setting created successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        409: createSchema(errorResponseSchema.describe('Conflict - Setting with this key already exists')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    onRequest: requireGlobalAdmin()
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using CreateGlobalSettingSchema
      const validatedData = request.body;
      
      // Check if setting already exists
      const existing = await GlobalSettingsService.exists(validatedData.key);
      if (existing) {
        const conflictResponse = {
          success: false,
          error: 'Setting with this key already exists. Use PUT to update.'
        };
        const jsonString = JSON.stringify(conflictResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      const setting = await GlobalSettingsService.setTyped(
        validatedData.key,
        validatedData.value,
        validatedData.type,
        {
          description: validatedData.description,
          encrypted: validatedData.encrypted,
          group_id: validatedData.group_id
        }
      );

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
        message: 'Global setting created successfully'
      };
      
      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(201).type('application/json').send(jsonString);
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
      
      fastify.log.error(error, 'Error creating global setting');
      const errorResponse = {
        success: false,
        error: 'Failed to create global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
