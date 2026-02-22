import type { FastifyInstance  } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { type UpdateGlobalSettingInput } from '../schemas';

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

const GLOBAL_SETTING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: GLOBAL_SETTING_OBJECT,
    message: { type: 'string' }
  },
  required: ['success']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export default async function updateGlobalSettingRoute(server: FastifyInstance) {
  // PUT /settings/:key - Update existing global setting (admin only)
  server.put<{ Params: { key: string }; Body: UpdateGlobalSettingInput }>('/settings/:key', {
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
          name: { type: 'string' },
          value: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          encrypted: { type: 'boolean' },
          group_id: { type: 'string' }
        },
        additionalProperties: false,
        minProperties: 1
      },
      response: {
        200: {
          ...GLOBAL_SETTING_RESPONSE_SCHEMA,
          description: 'Global setting updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Setting not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
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
          name: setting.name ? String(setting.name) : null,
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
      server.log.error(error, 'Error updating global setting');
      const errorResponse = {
        success: false,
        error: 'Failed to update global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
