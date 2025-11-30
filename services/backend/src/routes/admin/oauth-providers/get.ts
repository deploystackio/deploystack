import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { mcpOauthProviders } from '../../../db/schema';
import {
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type SuccessResponse,
  type ProviderResponse,
  type ErrorResponse
} from './schemas';

export default async function getProviderRoute(server: FastifyInstance) {
  server.get('/oauth-providers/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - OAuth Providers'],
      summary: 'Get OAuth provider by ID (Global Admin)',
      description: 'Returns a specific OAuth provider by ID.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Provider ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Provider retrieved successfully'
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
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

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

      // Parse JSON arrays from text fields
      let authServerPatterns: string[] = [];
      let defaultScopes: string[] | null = null;

      try {
        authServerPatterns = JSON.parse(provider.auth_server_patterns);
      } catch {
        authServerPatterns = [provider.auth_server_patterns];
      }

      if (provider.default_scopes) {
        try {
          defaultScopes = JSON.parse(provider.default_scopes);
        } catch {
          defaultScopes = provider.default_scopes.split(' ').filter(Boolean);
        }
      }

      // Build response (never expose client_secret)
      const responseData: ProviderResponse = {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        icon_url: provider.icon_url,
        auth_server_patterns: authServerPatterns,
        client_id: provider.client_id,
        has_client_secret: !!provider.client_secret,
        authorization_endpoint: provider.authorization_endpoint,
        token_endpoint: provider.token_endpoint,
        default_scopes: defaultScopes,
        pkce_required: provider.pkce_required,
        token_endpoint_auth_method: provider.token_endpoint_auth_method,
        enabled: provider.enabled,
        created_at: provider.created_at.toISOString(),
        updated_at: provider.updated_at.toISOString()
      };

      const successResponse: SuccessResponse = {
        success: true,
        message: 'OAuth provider retrieved successfully',
        data: responseData
      };

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error, operation: 'get_oauth_provider', providerId: id }, 'Failed to get OAuth provider');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
