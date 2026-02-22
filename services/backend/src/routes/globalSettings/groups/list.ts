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

const SETTING_GROUP_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    icon: { type: ['string', 'null'] },
    sort_order: { type: 'number' },
    settings: {
      type: 'array',
      items: GLOBAL_SETTING_OBJECT
    },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  }
} as const;

const SETTING_GROUPS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: SETTING_GROUP_OBJECT
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

export default async function listGroupsRoute(server: FastifyInstance) {
  // GET /settings/groups - List all groups with their settings (admin only)
  server.get('/settings/groups', {
    schema: {
      tags: ['Global Settings'],
      summary: 'List all setting groups',
      description: 'Retrieves all setting groups with their associated settings. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...SETTING_GROUPS_LIST_RESPONSE_SCHEMA,
          description: 'Successfully retrieved setting groups'
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
      const groupsWithSettings = await GlobalSettingsService.getAllGroupsWithSettings();
      return reply.status(200).send({
        success: true,
        data: groupsWithSettings
      });
    } catch (error) {
      server.log.error(error, 'Error fetching all global setting groups with settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch all global setting groups with settings'
      });
    }
  });
}
