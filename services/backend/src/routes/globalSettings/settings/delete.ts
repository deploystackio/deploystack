import type { FastifyInstance  } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';

const SUCCESS_MESSAGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export default async function deleteGlobalSettingRoute(server: FastifyInstance) {
  // DELETE /settings/:key - Delete global setting (admin only)
  server.delete<{ Params: { key: string } }>('/settings/:key', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Delete global setting',
      description: 'Deletes a global setting from the system. Requires settings delete permissions.',
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
          ...SUCCESS_MESSAGE_RESPONSE_SCHEMA,
          description: 'Global setting deleted successfully'
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

      const success = await GlobalSettingsService.delete(key);

      if (!success) {
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
        message: 'Global setting deleted successfully'
      };

      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error deleting global setting');

      const errorResponse = {
        success: false,
        error: 'Failed to delete global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
