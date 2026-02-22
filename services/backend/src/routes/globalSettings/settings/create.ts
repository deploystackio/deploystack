import type { FastifyInstance  } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { type CreateGlobalSettingInput } from '../schemas';

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

export default async function createGlobalSettingRoute(server: FastifyInstance) {
  // POST /settings - Create new global setting (admin only)
  server.post<{ Body: CreateGlobalSettingInput }>('/settings', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Create new global setting',
      description: 'Creates a new global setting with the specified key, value, and metadata. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      body: {
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
      },
      response: {
        201: {
          ...GLOBAL_SETTING_RESPONSE_SCHEMA,
          description: 'Global setting created successfully'
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
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Setting with this key already exists'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
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
          name: validatedData.name,
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
          name: setting.name ? String(setting.name) : null,
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
      server.log.error(error, 'Error creating global setting');
      const errorResponse = {
        success: false,
        error: 'Failed to create global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
