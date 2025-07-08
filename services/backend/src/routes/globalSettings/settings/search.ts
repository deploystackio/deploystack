import type { FastifyInstance  } from 'fastify';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../../services/globalSettingsService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  SearchGlobalSettingsSchema,
  GlobalSettingSchema,
  type SearchGlobalSettingsInput,
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
      body: zodToJsonSchema(SearchGlobalSettingsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingsListResponseSchema.describe('Search results retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error'), {
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
      // Fastify has already validated request.body using SearchGlobalSettingsSchema
      const { pattern } = request.body;
      
      const settings = await GlobalSettingsService.search(pattern);
      
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error searching global settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to search global settings',
      });
    }
  });
}
