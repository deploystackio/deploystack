import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { mcpOauthProviders } from '../../../db/schema';
import { encrypt } from '../../../utils/encryption';
import {
  CREATE_PROVIDER_SCHEMA,
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type CreateProviderRequest,
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

export default async function createProviderRoute(server: FastifyInstance) {
  server.post('/oauth-providers', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - OAuth Providers'],
      summary: 'Create OAuth provider (Global Admin)',
      description: 'Creates a pre-registered OAuth provider for MCP server authentication (e.g., GitHub, Google).',
      security: [{ cookieAuth: [] }],
      body: CREATE_PROVIDER_SCHEMA,
      response: {
        201: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Provider created successfully'
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
    const body = request.body as CreateProviderRequest;

    try {
      const db = getDb();

      // Validate regex patterns
      validatePatterns(body.auth_server_patterns);

      // Validate URLs
      validateUrl(body.authorization_endpoint, 'authorization_endpoint');
      validateUrl(body.token_endpoint, 'token_endpoint');
      if (body.icon_url) {
        validateUrl(body.icon_url, 'icon_url');
      }

      // Check slug uniqueness
      const existingProvider = await db.select({ id: mcpOauthProviders.id })
        .from(mcpOauthProviders)
        .where(eq(mcpOauthProviders.slug, body.slug))
        .limit(1);

      if (existingProvider.length > 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Provider with slug "${body.slug}" already exists`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      // Encrypt client_secret if provided
      let encryptedSecret: string | null = null;
      if (body.client_secret) {
        encryptedSecret = encrypt(body.client_secret, request.log);
      }

      // Generate ID
      const providerId = nanoid();
      const now = new Date();

      // Insert provider
      await db.insert(mcpOauthProviders).values({
        id: providerId,
        name: body.name,
        slug: body.slug,
        icon_url: body.icon_url || null,
        auth_server_patterns: JSON.stringify(body.auth_server_patterns),
        client_id: body.client_id,
        client_secret: encryptedSecret,
        authorization_endpoint: body.authorization_endpoint,
        token_endpoint: body.token_endpoint,
        default_scopes: body.default_scopes ? JSON.stringify(body.default_scopes) : null,
        pkce_required: body.pkce_required ?? true,
        token_endpoint_auth_method: body.token_endpoint_auth_method || 'client_secret_post',
        enabled: body.enabled ?? true,
        created_at: now,
        updated_at: now
      });

      // Build response (never expose client_secret)
      const responseData: ProviderResponse = {
        id: providerId,
        name: body.name,
        slug: body.slug,
        icon_url: body.icon_url || null,
        auth_server_patterns: body.auth_server_patterns,
        client_id: body.client_id,
        has_client_secret: !!body.client_secret,
        authorization_endpoint: body.authorization_endpoint,
        token_endpoint: body.token_endpoint,
        default_scopes: body.default_scopes || null,
        pkce_required: body.pkce_required ?? true,
        token_endpoint_auth_method: body.token_endpoint_auth_method || 'client_secret_post',
        enabled: body.enabled ?? true,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      const successResponse: SuccessResponse = {
        success: true,
        message: 'OAuth provider created successfully',
        data: responseData
      };

      server.log.info({
        operation: 'create_oauth_provider',
        provider_id: providerId,
        provider_slug: body.slug,
        provider_name: body.name,
        has_client_secret: !!body.client_secret,
        patterns_count: body.auth_server_patterns.length
      }, `Created OAuth provider: ${body.name}`);

      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error({
        error,
        operation: 'create_oauth_provider',
        slug: body.slug
      }, 'Failed to create OAuth provider');

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
