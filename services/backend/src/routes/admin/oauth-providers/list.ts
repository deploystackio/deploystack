import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { mcpOauthProviders } from '../../../db/schema';
import {
  LIST_PROVIDERS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type ListProvidersResponse,
  type ProviderResponse,
  type ErrorResponse
} from './schemas';

export default async function listProvidersRoute(server: FastifyInstance) {
  server.get('/oauth-providers', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - OAuth Providers'],
      summary: 'List all OAuth providers (Global Admin)',
      description: 'Returns all pre-registered OAuth providers for MCP server authentication.',
      security: [{ cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Filter by enabled status'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          ...LIST_PROVIDERS_RESPONSE_SCHEMA,
          description: 'List of OAuth providers'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { enabled } = request.query as { enabled?: boolean };

    try {
      const db = getDb();

      // Build query
      let providers;
      if (enabled !== undefined) {
        providers = await db.select()
          .from(mcpOauthProviders)
          .where(eq(mcpOauthProviders.enabled, enabled));
      } else {
        providers = await db.select().from(mcpOauthProviders);
      }

      // Map to response format (never expose client_secret)
      const responseData: ProviderResponse[] = providers.map(provider => {
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

        return {
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
      });

      const listResponse: ListProvidersResponse = {
        success: true,
        data: responseData
      };

      server.log.info({
        operation: 'list_oauth_providers',
        count: responseData.length,
        filter_enabled: enabled
      }, 'Listed OAuth providers');

      const jsonString = JSON.stringify(listResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({ error, operation: 'list_oauth_providers' }, 'Failed to list OAuth providers');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
