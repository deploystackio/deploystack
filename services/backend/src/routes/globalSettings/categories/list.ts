import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
        200: zodToJsonSchema(categoriesResponseSchema.describe('Categories retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preValidation: requireGlobalAdmin(),
  }, async (request, reply) => {
    try {
      const categories = await GlobalSettingsService.getCategories();
      
      return reply.status(200).send({
        success: true,
        data: categories,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching categories');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch categories',
      });
    }
  });
}
