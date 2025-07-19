import type { FastifyInstance  } from 'fastify';
import { ZodError } from 'zod';
import { createSchema } from 'zod-openapi';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  GlobalSettingSchema,
  type SearchGlobalSettingsInput
} from '../schemas';
import { z } from 'zod';

// Response schema for search results
const globalSettingsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Array of global settings')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});

export default async function searchGlobalSettingsRoute(fastify: FastifyInstance) {
  // POST /settings/search - Search settings by key pattern (admin only)
  fastify.post<{ Body: SearchGlobalSettingsInput }>('/settings/search', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Search settings',
      description: 'Searches for global settings by key pattern. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        properties: {
          pattern: { type: 'string', minLength: 1 }
        },
        required: ['pattern'],
        additionalProperties: false
      },
      response: {
        200: createSchema(globalSettingsListResponseSchema.describe('Search results retrieved successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireGlobalAdmin()
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using SearchGlobalSettingsSchema
      const { pattern } = request.body;
      
      const settings = await GlobalSettingsService.search(pattern);
      
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
      if (error instanceof ZodError) {
        const errorResponse = {
          success: false,
          error: 'Validation error',
          details: error.issues  // Fixed: error.errors → error.issues for Zod v4
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
      
      fastify.log.error(error, 'Error searching global settings');
      const errorResponse = {
        success: false,
        error: 'Failed to search global settings'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
