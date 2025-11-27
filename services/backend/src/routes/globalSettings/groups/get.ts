import type { FastifyInstance } from 'fastify';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { GlobalSettingSchema } from '../schemas';
import { z } from 'zod';

// Response schema for getting settings by group
const globalSettingsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Array of global settings')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details')
});


export default async function getGroupSettingsRoute(fastify: FastifyInstance) {
  // GET /settings/group/:groupId - Get settings by group (admin only)
  fastify.get<{ Params: { groupId: string } }>('/settings/group/:groupId', {
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
        200: createSchema(globalSettingsListResponseSchema.describe('Settings retrieved successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      fastify.log.error(error, 'Error fetching settings by group');
      
      const errorResponse = {
        success: false,
        error: 'Failed to fetch settings by group'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
