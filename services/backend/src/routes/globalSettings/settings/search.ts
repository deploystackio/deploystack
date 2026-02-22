import type { FastifyInstance  } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { type SearchGlobalSettingsInput } from '../schemas';

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

const GLOBAL_SETTINGS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: GLOBAL_SETTING_OBJECT
    }
  },
  required: ['success', 'data']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export default async function searchGlobalSettingsRoute(server: FastifyInstance) {
  // POST /settings/search - Search settings by key pattern (admin only)
  server.post<{ Body: SearchGlobalSettingsInput }>('/settings/search', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Search settings',
      description: 'Searches for global settings by key pattern. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        properties: {
          pattern: { type: 'string', minLength: 1 }
        },
        required: ['pattern'],
        additionalProperties: false
      },
      response: {
        200: {
          ...GLOBAL_SETTINGS_LIST_RESPONSE_SCHEMA,
          description: 'Search results retrieved successfully'
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
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    },
    preValidation: requireGlobalAdmin()
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using SearchGlobalSettingsSchema
      const { pattern } = request.body;

      const settings = await GlobalSettingsService.search(pattern);

      // Create clean response with primitive types only
      const cleanResponse = {
        success: true,
        data: settings.map(setting => ({
          key: String(setting.key),
          name: setting.name ? String(setting.name) : null,
          value: setting.value,
          type: setting.type ? String(setting.type) : null,
          description: setting.description ? String(setting.description) : null,
          is_encrypted: Boolean(setting.is_encrypted),
          group_id: setting.group_id ? String(setting.group_id) : null,
          created_at: setting.created_at ? String(setting.created_at) : null,
          updated_at: setting.updated_at ? String(setting.updated_at) : null
        }))
      };

      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error searching global settings');
      const errorResponse = {
        success: false,
        error: 'Failed to search global settings'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
