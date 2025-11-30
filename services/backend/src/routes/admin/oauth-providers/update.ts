import { type FastifyInstance } from 'fastify';
import { eq, and, ne } from 'drizzle-orm';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { mcpOauthProviders } from '../../../db/schema';
import { encrypt } from '../../../utils/encryption';
import {
  UPDATE_PROVIDER_SCHEMA,
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type UpdateProviderRequest,
  type SuccessResponse,
  type ProviderResponse,
  type ErrorResponse
} from './schemas';

/**
 * Validate that all patterns are valid regular expressions
 */
function validatePatterns(patterns: string[]): void {
  for (const pattern of patterns) {
    try {
      new RegExp(pattern);
    } catch (e) {
      throw new Error(`Invalid regex pattern: ${pattern} - ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
}

/**
 * Validate URL format
 */
function validateUrl(url: string, fieldName: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL for ${fieldName}: ${url}`);
  }
}

export default async function updateProviderRoute(server: FastifyInstance) {
  server.put('/oauth-providers/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - OAuth Providers'],
      summary: 'Update OAuth provider (Global Admin)',
      description: 'Updates a pre-registered OAuth provider. All fields are optional.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Provider ID' }
        },
        required: ['id'],
        additionalProperties: false
      },
      body: UPDATE_PROVIDER_SCHEMA,
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Provider updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid input'
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
          description: 'Conflict - Slug already exists'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateProviderRequest;

    try {
      const db = getDb();

      // Find existing provider
      const existingProviders = await db.select()
        .from(mcpOauthProviders)
        .where(eq(mcpOauthProviders.id, id))
        .limit(1);

      if (existingProviders.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'OAuth provider not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const existingProvider = existingProviders[0];

      // Validate patterns if provided
      if (body.auth_server_patterns) {
        validatePatterns(body.auth_server_patterns);
      }

      // Validate URLs if provided
      if (body.authorization_endpoint) {
        validateUrl(body.authorization_endpoint, 'authorization_endpoint');
      }
      if (body.token_endpoint) {
        validateUrl(body.token_endpoint, 'token_endpoint');
      }
      if (body.icon_url) {
        validateUrl(body.icon_url, 'icon_url');
      }

      // Check slug uniqueness if changed
      if (body.slug && body.slug !== existingProvider.slug) {
        const slugConflict = await db.select({ id: mcpOauthProviders.id })
          .from(mcpOauthProviders)
          .where(and(
            eq(mcpOauthProviders.slug, body.slug),
            ne(mcpOauthProviders.id, id)
          ))
          .limit(1);

        if (slugConflict.length > 0) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: `Provider with slug "${body.slug}" already exists`
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(409).type('application/json').send(jsonString);
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date()
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.icon_url !== undefined) updateData.icon_url = body.icon_url;
      if (body.auth_server_patterns !== undefined) {
        updateData.auth_server_patterns = JSON.stringify(body.auth_server_patterns);
      }
      if (body.client_id !== undefined) updateData.client_id = body.client_id;
      if (body.authorization_endpoint !== undefined) {
        updateData.authorization_endpoint = body.authorization_endpoint;
      }
      if (body.token_endpoint !== undefined) {
        updateData.token_endpoint = body.token_endpoint;
      }
      if (body.default_scopes !== undefined) {
        updateData.default_scopes = body.default_scopes ? JSON.stringify(body.default_scopes) : null;
      }
      if (body.pkce_required !== undefined) updateData.pkce_required = body.pkce_required;
      if (body.token_endpoint_auth_method !== undefined) {
        updateData.token_endpoint_auth_method = body.token_endpoint_auth_method;
      }
      if (body.enabled !== undefined) updateData.enabled = body.enabled;

      // Handle client_secret update
      // - If empty string: remove secret (set to null)
      // - If provided: encrypt and update
      // - If not provided (undefined): keep existing
      if (body.client_secret !== undefined) {
        if (body.client_secret === '' || body.client_secret === null) {
          updateData.client_secret = null;
        } else {
          updateData.client_secret = encrypt(body.client_secret, request.log);
        }
      }

      // Update provider
      await db.update(mcpOauthProviders)
        .set(updateData)
        .where(eq(mcpOauthProviders.id, id));

      // Fetch updated provider
      const updatedProviders = await db.select()
        .from(mcpOauthProviders)
        .where(eq(mcpOauthProviders.id, id))
        .limit(1);

      const updatedProvider = updatedProviders[0];

      // Parse JSON arrays from text fields
      let authServerPatterns: string[] = [];
      let defaultScopes: string[] | null = null;

      try {
        authServerPatterns = JSON.parse(updatedProvider.auth_server_patterns);
      } catch {
        authServerPatterns = [updatedProvider.auth_server_patterns];
      }

      if (updatedProvider.default_scopes) {
        try {
          defaultScopes = JSON.parse(updatedProvider.default_scopes);
        } catch {
          defaultScopes = updatedProvider.default_scopes.split(' ').filter(Boolean);
        }
      }

      // Build response (never expose client_secret)
      const responseData: ProviderResponse = {
        id: updatedProvider.id,
        name: updatedProvider.name,
        slug: updatedProvider.slug,
        icon_url: updatedProvider.icon_url,
        auth_server_patterns: authServerPatterns,
        client_id: updatedProvider.client_id,
        has_client_secret: !!updatedProvider.client_secret,
        authorization_endpoint: updatedProvider.authorization_endpoint,
        token_endpoint: updatedProvider.token_endpoint,
        default_scopes: defaultScopes,
        pkce_required: updatedProvider.pkce_required,
        token_endpoint_auth_method: updatedProvider.token_endpoint_auth_method,
        enabled: updatedProvider.enabled,
        created_at: updatedProvider.created_at.toISOString(),
        updated_at: updatedProvider.updated_at.toISOString()
      };

      const successResponse: SuccessResponse = {
        success: true,
        message: 'OAuth provider updated successfully',
        data: responseData
      };

      server.log.info({
        operation: 'update_oauth_provider',
        provider_id: id,
        provider_slug: updatedProvider.slug,
        updated_fields: Object.keys(body)
      }, `Updated OAuth provider: ${updatedProvider.name}`);

      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        error,
        operation: 'update_oauth_provider',
        providerId: id
      }, 'Failed to update OAuth provider');

      // Check for validation errors
      if (error instanceof Error && (
        error.message.includes('Invalid regex pattern') ||
        error.message.includes('Invalid URL')
      )) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
