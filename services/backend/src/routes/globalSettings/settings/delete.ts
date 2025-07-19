import type { FastifyInstance  } from 'fastify';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { z } from 'zod';

// Response schemas
const successMessageResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  message: z.string().describe('Success message')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});


export default async function deleteGlobalSettingRoute(fastify: FastifyInstance) {
  // DELETE /settings/:key - Delete global setting (admin only)
  fastify.delete<{ Params: { key: string } }>('/settings/:key', {
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
        200: createSchema(successMessageResponseSchema.describe('Global setting deleted successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - Setting not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      fastify.log.error(error, 'Error deleting global setting');
      
      const errorResponse = {
        success: false,
        error: 'Failed to delete global setting'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
