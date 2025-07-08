import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { GlobalSettingGroupSchema } from '../schemas';
import { z } from 'zod';

// Response schema for listing setting groups
const settingGroupsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingGroupSchema).describe('Array of setting groups with their settings')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details')
});

export default async function listGroupsRoute(fastify: FastifyInstance) {
  // GET /settings/groups - List all groups with their settings (admin only)
  fastify.get('/settings/groups', {
    schema: {
      tags: ['Global Settings'],
      summary: 'List all setting groups',
      description: 'Retrieves all setting groups with their associated settings. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(settingGroupsListResponseSchema.describe('Successfully retrieved setting groups'), {
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
    preHandler: requireGlobalAdmin(),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const groupsWithSettings = await GlobalSettingsService.getAllGroupsWithSettings();
      return reply.status(200).send({
        success: true,
        data: groupsWithSettings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching all global setting groups with settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch all global setting groups with settings',
      });
    }
  });
}
