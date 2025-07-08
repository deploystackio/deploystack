import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
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

const paramsWithKeySchema = z.object({
  key: z.string().describe('Global setting key')
});

export default async function deleteGlobalSettingRoute(fastify: FastifyInstance) {
  // DELETE /settings/:key - Delete global setting (admin only)
  fastify.delete<{ Params: { key: string } }>('/settings/:key', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Delete global setting',
      description: 'Deletes a global setting from the system. Requires settings delete permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithKeySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successMessageResponseSchema.describe('Global setting deleted successfully'), {
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
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Setting not found'), {
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
      const { key } = request.params;
      
      const success = await GlobalSettingsService.delete(key);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Global setting deleted successfully',
      });
    } catch (error) {
      fastify.log.error(error, 'Error deleting global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete global setting',
      });
    }
  });
}
