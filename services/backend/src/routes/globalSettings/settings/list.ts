import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { GlobalSettingSchema } from '../schemas';
import { z } from 'zod';

// Response schema for listing global settings
const globalSettingsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Array of global settings')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});

export default async function listGlobalSettingsRoute(fastify: FastifyInstance) {
  // GET /settings - List all global settings (admin only)
  fastify.get('/settings', {
    schema: {
      tags: ['Global Settings'],
      summary: 'List all global settings',
      description: 'Retrieves all global settings in the system. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(globalSettingsListResponseSchema.describe('Successfully retrieved global settings')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireGlobalAdmin()
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await GlobalSettingsService.getAll();
      
      // Create clean response with primitive types only
      const cleanResponse = {
        success: true,
        data: settings.map(setting => ({
          key: String(setting.key),
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
      fastify.log.error(error, 'Error fetching global settings');
      
      const errorResponse = {
        success: false,
        error: 'Failed to fetch global settings'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
