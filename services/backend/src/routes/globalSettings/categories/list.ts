import type { FastifyInstance } from 'fastify';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';

const CATEGORIES_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: { type: 'string' }
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

export default async function listCategoriesRoute(server: FastifyInstance) {
  // GET /settings/categories - Get all categories (admin only)
  server.get('/settings/categories', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get all categories',
      description: 'Retrieves all available setting categories. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...CATEGORIES_RESPONSE_SCHEMA,
          description: 'Categories retrieved successfully'
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
      const categories = await GlobalSettingsService.getCategories();

      // Create clean response with primitive types only
      const cleanResponse = {
        success: true,
        data: categories.map(category => String(category))
      };

      // Manual JSON serialization
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching categories');

      const errorResponse = {
        success: false,
        error: 'Failed to fetch categories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
