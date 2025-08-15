import type { FastifyInstance  } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  GlobalSettingSchema,
  type BulkGlobalSettingsInput,
} from '../schemas';
import { z } from 'zod';

// Response schemas for bulk operations
const bulkSettingErrorSchema = z.object({
  key: z.string().describe('Setting key that failed'),
  error: z.string().describe('Error message')
});

const bulkResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Successfully processed settings'),
  errors: z.array(bulkSettingErrorSchema).optional().describe('Failed settings with error details'),
  message: z.string().describe('Bulk operation result message')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});

export default async function bulkGlobalSettingsRoute(fastify: FastifyInstance) {
  // POST /settings/bulk - Bulk create/update settings (admin only)
  fastify.post<{ Body: BulkGlobalSettingsInput }>('/settings/bulk', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Bulk create/update settings',
      description: 'Creates or updates multiple global settings in a single operation. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        properties: {
          settings: {
            type: 'array',
            minItems: 1,
            items: {
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
            }
          }
        },
        required: ['settings'],
        additionalProperties: false
      },
      response: {
        200: createSchema(bulkResponseSchema.describe('All settings processed successfully')),
        207: createSchema(bulkResponseSchema.describe('Partial success - Some settings processed, some failed')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error or all settings failed')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireGlobalAdmin(),
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using BulkGlobalSettingsSchema
      const { settings } = request.body;
      
      const results = [];
      const errors = [];

      for (const settingData of settings) {
        try {
          // Convert value to proper type if needed
          let processedValue = settingData.value;
          if (settingData.type === 'boolean' && typeof settingData.value === 'string') {
            processedValue = settingData.value.toLowerCase() === 'true';
          } else if (settingData.type === 'number' && typeof settingData.value === 'string') {
            processedValue = Number(settingData.value);
          }
          
          const setting = await GlobalSettingsService.setTyped(
            settingData.key,
            processedValue,
            settingData.type,
            {
              description: settingData.description,
              encrypted: settingData.encrypted,
              group_id: settingData.group_id,
            }
          );
          results.push(setting);
        } catch (error) {
          fastify.log.error({ error }, `Error processing setting ${settingData.key}:`);
          errors.push({
            key: settingData.key,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const hasErrors = errors.length > 0;
      const status = hasErrors ? (results.length > 0 ? 207 : 400) : 200; // 207 = Multi-Status

      // Create clean response with primitive types only
      const cleanResponse = {
        success: !hasErrors || results.length > 0,
        data: results.map(setting => ({
          key: String(setting.key),
          value: setting.value,
          type: setting.type ? String(setting.type) : null,
          description: setting.description ? String(setting.description) : null,
          is_encrypted: Boolean(setting.is_encrypted),
          group_id: setting.group_id ? String(setting.group_id) : null,
          created_at: setting.created_at ? String(setting.created_at) : null,
          updated_at: setting.updated_at ? String(setting.updated_at) : null
        })),
        errors: hasErrors ? errors.map(error => ({
          key: String(error.key),
          error: String(error.error)
        })) : undefined,
        message: hasErrors 
          ? `Processed ${results.length} settings successfully, ${errors.length} failed`
          : `Successfully processed ${results.length} settings`
      };
      
      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(status).type('application/json').send(jsonString);
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
      
      fastify.log.error(error, 'Error in bulk settings operation');
      const errorResponse = {
        success: false,
        error: 'Failed to process bulk settings operation'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
