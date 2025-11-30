import { type FastifyInstance } from 'fastify';
import { eq, count } from 'drizzle-orm';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { mcpOauthProviders, mcpServerInstallations } from '../../../db/schema';
import {
  DELETE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type DeleteSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function deleteProviderRoute(server: FastifyInstance) {
  server.delete('/oauth-providers/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - OAuth Providers'],
      summary: 'Delete OAuth provider (Global Admin)',
      description: 'Deletes a pre-registered OAuth provider. Installations using this provider will have oauth_provider_id set to null.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Provider ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      querystring: {
        type: 'object',
        properties: {
          force: {
            type: 'boolean',
            default: false,
            description: 'Force delete even if installations reference this provider'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          ...DELETE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Provider deleted successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Provider not found'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Provider is in use by installations'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { force } = request.query as { force?: boolean };

    try {
      const db = getDb();

      // Find provider
      const providers = await db.select()
        .from(mcpOauthProviders)
        .where(eq(mcpOauthProviders.id, id))
        .limit(1);

      if (providers.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'OAuth provider not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const provider = providers[0];

      // Check if any installations reference this provider
      const installationCountResult = await db.select({ count: count() })
        .from(mcpServerInstallations)
        .where(eq(mcpServerInstallations.oauth_provider_id, id));

      const installationCount = installationCountResult[0]?.count ?? 0;

      if (installationCount > 0 && !force) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Cannot delete provider: ${installationCount} installation(s) reference this provider. Use ?force=true to delete anyway (installations will have oauth_provider_id set to null).`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      // Delete provider (ON DELETE SET NULL will handle installations)
      await db.delete(mcpOauthProviders)
        .where(eq(mcpOauthProviders.id, id));

      const successResponse: DeleteSuccessResponse = {
        success: true,
        message: installationCount > 0
          ? `OAuth provider "${provider.name}" deleted. ${installationCount} installation(s) had their oauth_provider_id set to null.`
          : `OAuth provider "${provider.name}" deleted successfully`
      };

      server.log.info({
        operation: 'delete_oauth_provider',
        provider_id: id,
        provider_slug: provider.slug,
        provider_name: provider.name,
        affected_installations: installationCount,
        forced: force
      }, `Deleted OAuth provider: ${provider.name}`);

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        error,
        operation: 'delete_oauth_provider',
        providerId: id
      }, 'Failed to delete OAuth provider');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
