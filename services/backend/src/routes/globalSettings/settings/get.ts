import type { FastifyInstance  } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';

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

export default async function getGlobalSettingRoute(server: FastifyInstance) {
  // GET /settings/:key - Get specific global setting (admin only)
  server.get<{ Params: { key: string } }>('/settings/:key', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get global setting by key',
      description: 'Retrieves a specific global setting by its key. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Global setting key' }
        },
        required: ['key']
      },
      response: {
        200: {
          ...GLOBAL_SETTING_RESPONSE_SCHEMA,
          description: 'Global setting retrieved successfully'
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
      const setting = await GlobalSettingsService.get(key);

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
        }
      };

      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching global setting');

      const errorResponse = {
        success: false,
        error: 'Failed to fetch global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
