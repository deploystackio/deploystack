import type { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
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

const paramsWithGroupIdSchema = z.object({
  groupId: z.string().describe('Group ID')
});

export default async function getGroupSettingsRoute(fastify: FastifyInstance) {
  // GET /settings/group/:groupId - Get settings by group (admin only)
  fastify.get<{ Params: { groupId: string } }>('/settings/group/:groupId', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get settings by group',
      description: 'Retrieves all global settings belonging to a specific group. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithGroupIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingsListResponseSchema.describe('Settings retrieved successfully'), {
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
      const { groupId } = request.params;
      const settings = await GlobalSettingsService.getByGroup(groupId);
      
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching settings by group');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch settings by group',
      });
    }
  });
}
