import type { FastifyInstance  } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { type BulkGlobalSettingsInput } from '../schemas';

const GLOBAL_SETTING_OBJECT = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    name: { type: ['string', 'null'] },
    value: { type: 'string' },
    type: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    is_encrypted: { type: 'boolean' },
    group_id: { type: ['string', 'null'] },
    created_at: { type: ['string', 'null'] },
    updated_at: { type: ['string', 'null'] }
  }
} as const;

const BULK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: GLOBAL_SETTING_OBJECT
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['key', 'error']
      }
    },
    message: { type: 'string' }
  },
  required: ['success', 'data', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export default async function bulkGlobalSettingsRoute(server: FastifyInstance) {
  // POST /settings/bulk - Bulk create/update settings (admin only)
  server.post<{ Body: BulkGlobalSettingsInput }>('/settings/bulk', {
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
                name: { type: 'string' },
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
        200: {
          ...BULK_RESPONSE_SCHEMA,
          description: 'All settings processed successfully'
        },
        207: {
          ...BULK_RESPONSE_SCHEMA,
          description: 'Partial success - Some settings processed, some failed'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error or all settings failed'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
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
              name: settingData.name,
              description: settingData.description,
              encrypted: settingData.encrypted,
              group_id: settingData.group_id,
            }
          );
          results.push(setting);
        } catch (error) {
          server.log.error({ error }, `Error processing setting ${settingData.key}:`);
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
          name: setting.name ? String(setting.name) : null,
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
      server.log.error(error, 'Error in bulk settings operation');
      const errorResponse = {
        success: false,
        error: 'Failed to process bulk settings operation'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
