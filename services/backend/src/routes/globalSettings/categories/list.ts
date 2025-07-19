import type { FastifyInstance } from 'fastify';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { z } from 'zod';

// Response schema for categories
const categoriesResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(z.string()).describe('Array of category names')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details')
});

export default async function listCategoriesRoute(fastify: FastifyInstance) {
  // GET /settings/categories - Get all categories (admin only)
  fastify.get('/settings/categories', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get all categories',
      description: 'Retrieves all available setting categories. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(categoriesResponseSchema.describe('Categories retrieved successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      fastify.log.error(error, 'Error fetching categories');
      
      const errorResponse = {
        success: false,
        error: 'Failed to fetch categories'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
