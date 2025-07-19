import type { FastifyInstance  } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  BulkGlobalSettingsSchema,
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
      body: zodToJsonSchema(BulkGlobalSettingsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(bulkResponseSchema.describe('All settings processed successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        207: zodToJsonSchema(bulkResponseSchema.describe('Partial success - Some settings processed, some failed'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error or all settings failed'), {
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
          fastify.log.error(`Error processing setting ${settingData.key}:`, error);
          errors.push({
            key: settingData.key,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const hasErrors = errors.length > 0;
      const status = hasErrors ? (results.length > 0 ? 207 : 400) : 200; // 207 = Multi-Status

      return reply.status(status).send({
        success: !hasErrors || results.length > 0,
        data: results,
        errors: hasErrors ? errors : undefined,
        message: hasErrors 
          ? `Processed ${results.length} settings successfully, ${errors.length} failed`
          : `Successfully processed ${results.length} settings`,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }
      
      fastify.log.error(error, 'Error in bulk settings operation');
      return reply.status(500).send({
        success: false,
        error: 'Failed to process bulk settings operation',
      });
    }
  });
}
