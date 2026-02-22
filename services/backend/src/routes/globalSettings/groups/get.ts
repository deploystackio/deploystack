import type { FastifyInstance } from 'fastify';
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

export default async function getGroupSettingsRoute(server: FastifyInstance) {
  // GET /settings/group/:groupId - Get settings by group (admin only)
  server.get<{ Params: { groupId: string } }>('/settings/group/:groupId', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get settings by group',
      description: 'Retrieves all global settings belonging to a specific group. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: 'Group ID' }
        },
        required: ['groupId']
      },
      response: {
        200: {
          ...GLOBAL_SETTINGS_LIST_RESPONSE_SCHEMA,
          description: 'Settings retrieved successfully'
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
      const { groupId } = request.params;
      const settings = await GlobalSettingsService.getByGroup(groupId);

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
      server.log.error(error, 'Error fetching settings by group');

      const errorResponse = {
        success: false,
        error: 'Failed to fetch settings by group'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
