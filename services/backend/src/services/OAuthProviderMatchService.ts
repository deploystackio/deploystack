import type { FastifyBaseLogger } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb, getSchema } from '../db/index';
import { decrypt } from '../utils/encryption';

/**
 * Matched OAuth provider with decrypted credentials
 */
export interface MatchedOAuthProvider {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  clientSecret: string | null;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  defaultScopes: string[];
  pkceRequired: boolean;
  tokenEndpointAuthMethod: 'client_secret_post' | 'client_secret_basic' | 'none';
}

/**
 * Service for matching authorization server URLs against pre-registered OAuth providers.
 *
 * Used when MCP servers require OAuth but don't support Dynamic Client Registration (DCR).
 * Examples: GitHub, Google, Discord, Spotify.
 */
export class OAuthProviderMatchService {
  private readonly mcpOauthProviders: ReturnType<typeof getSchema>['mcpOauthProviders'];

  constructor(private logger: FastifyBaseLogger) {
    const schema = getSchema();
    this.mcpOauthProviders = schema.mcpOauthProviders;
  }

  /**
   * Find a pre-registered OAuth provider that matches the given authorization server URL.
   *
   * @param authServerUrl - Authorization server URL from OAuth discovery (e.g., "https://github.com/login/oauth/authorize")
   * @returns Matched provider with decrypted credentials, or null if no match found
   */
  async findMatchingProvider(authServerUrl: string): Promise<MatchedOAuthProvider | null> {
    this.logger.info(
      { operation: 'find_matching_provider', authServerUrl },
      'Searching for matching OAuth provider'
    );

    const db = getDb();

    // Query all enabled providers
    const providers = await db
      .select()
      .from(this.mcpOauthProviders)
      .where(eq(this.mcpOauthProviders.enabled, true));

    this.logger.debug(
      { operation: 'find_matching_provider', providerCount: providers.length },
      `Found ${providers.length} enabled OAuth providers to check`
    );

    for (const provider of providers) {
      try {
        // Parse auth_server_patterns as JSON array
        let patterns: string[];
        try {
          patterns = JSON.parse(provider.auth_server_patterns);
          if (!Array.isArray(patterns)) {
            this.logger.warn(
              { operation: 'find_matching_provider', providerId: provider.id, providerName: provider.name },
              'Provider auth_server_patterns is not an array, skipping'
            );
            continue;
          }
        } catch (parseError) {
          this.logger.warn(
            {
              operation: 'find_matching_provider',
              providerId: provider.id,
              providerName: provider.name,
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            },
            'Failed to parse auth_server_patterns as JSON, skipping provider'
          );
          continue;
        }

        // Test each pattern against the auth server URL
        for (const pattern of patterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(authServerUrl)) {
              this.logger.info(
                {
                  operation: 'find_matching_provider',
                  providerId: provider.id,
                  providerName: provider.name,
                  matchedPattern: pattern,
                  authServerUrl
                },
                `Found matching OAuth provider: ${provider.name}`
              );

              // Decrypt client_secret if present
              let clientSecret: string | null = null;
              if (provider.client_secret) {
                try {
                  clientSecret = decrypt(provider.client_secret, this.logger);
                } catch (decryptError) {
                  this.logger.error(
                    {
                      operation: 'find_matching_provider',
                      providerId: provider.id,
                      providerName: provider.name,
                      error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
                    },
                    'Failed to decrypt client_secret, returning null for secret'
                  );
                }
              }

              // Parse default_scopes
              let defaultScopes: string[] = [];
              if (provider.default_scopes) {
                try {
                  const parsed = JSON.parse(provider.default_scopes);
                  if (Array.isArray(parsed)) {
                    defaultScopes = parsed;
                  }
                } catch {
                  this.logger.warn(
                    { operation: 'find_matching_provider', providerId: provider.id },
                    'Failed to parse default_scopes, using empty array'
                  );
                }
              }

              return {
                id: provider.id,
                name: provider.name,
                slug: provider.slug,
                clientId: provider.client_id,
                clientSecret,
                authorizationEndpoint: provider.authorization_endpoint,
                tokenEndpoint: provider.token_endpoint,
                defaultScopes,
                pkceRequired: provider.pkce_required,
                tokenEndpointAuthMethod: provider.token_endpoint_auth_method as 'client_secret_post' | 'client_secret_basic' | 'none'
              };
            }
          } catch (regexError) {
            this.logger.warn(
              {
                operation: 'find_matching_provider',
                providerId: provider.id,
                providerName: provider.name,
                pattern,
                error: regexError instanceof Error ? regexError.message : 'Unknown error'
              },
              'Invalid regex pattern, skipping'
            );
            continue;
          }
        }
      } catch (error) {
        this.logger.warn(
          {
            operation: 'find_matching_provider',
            providerId: provider.id,
            providerName: provider.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Error processing provider, skipping'
        );
        continue;
      }
    }

    this.logger.debug(
      { operation: 'find_matching_provider', authServerUrl },
      'No matching OAuth provider found'
    );

    return null;
  }

  /**
   * Get a provider by its slug (e.g., "github", "google").
   *
   * @param slug - Provider slug
   * @returns Matched provider with decrypted credentials, or null if not found
   */
  async getProviderBySlug(slug: string): Promise<MatchedOAuthProvider | null> {
    this.logger.debug(
      { operation: 'get_provider_by_slug', slug },
      'Looking up OAuth provider by slug'
    );

    const db = getDb();

    const providers = await db
      .select()
      .from(this.mcpOauthProviders)
      .where(eq(this.mcpOauthProviders.slug, slug));

    if (providers.length === 0) {
      return null;
    }

    const provider = providers[0];

    // Decrypt client_secret if present
    let clientSecret: string | null = null;
    if (provider.client_secret) {
      try {
        clientSecret = decrypt(provider.client_secret, this.logger);
      } catch (decryptError) {
        this.logger.error(
          {
            operation: 'get_provider_by_slug',
            providerId: provider.id,
            slug,
            error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
          },
          'Failed to decrypt client_secret'
        );
      }
    }

    // Parse default_scopes
    let defaultScopes: string[] = [];
    if (provider.default_scopes) {
      try {
        const parsed = JSON.parse(provider.default_scopes);
        if (Array.isArray(parsed)) {
          defaultScopes = parsed;
        }
      } catch {
        this.logger.warn(
          { operation: 'get_provider_by_slug', providerId: provider.id, slug },
          'Failed to parse default_scopes, using empty array'
        );
      }
    }

    return {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      clientId: provider.client_id,
      clientSecret,
      authorizationEndpoint: provider.authorization_endpoint,
      tokenEndpoint: provider.token_endpoint,
      defaultScopes,
      pkceRequired: provider.pkce_required,
      tokenEndpointAuthMethod: provider.token_endpoint_auth_method as 'client_secret_post' | 'client_secret_basic' | 'none'
    };
  }

  /**
   * Get a provider by its ID.
   *
   * @param id - Provider ID
   * @returns Matched provider with decrypted credentials, or null if not found
   */
  async getProviderById(id: string): Promise<MatchedOAuthProvider | null> {
    this.logger.debug(
      { operation: 'get_provider_by_id', id },
      'Looking up OAuth provider by ID'
    );

    const db = getDb();

    const providers = await db
      .select()
      .from(this.mcpOauthProviders)
      .where(eq(this.mcpOauthProviders.id, id));

    if (providers.length === 0) {
      return null;
    }

    const provider = providers[0];

    // Decrypt client_secret if present
    let clientSecret: string | null = null;
    if (provider.client_secret) {
      try {
        clientSecret = decrypt(provider.client_secret, this.logger);
      } catch (decryptError) {
        this.logger.error(
          {
            operation: 'get_provider_by_id',
            providerId: provider.id,
            error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
          },
          'Failed to decrypt client_secret'
        );
      }
    }

    // Parse default_scopes
    let defaultScopes: string[] = [];
    if (provider.default_scopes) {
      try {
        const parsed = JSON.parse(provider.default_scopes);
        if (Array.isArray(parsed)) {
          defaultScopes = parsed;
        }
      } catch {
        this.logger.warn(
          { operation: 'get_provider_by_id', providerId: provider.id },
          'Failed to parse default_scopes, using empty array'
        );
      }
    }

    return {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      clientId: provider.client_id,
      clientSecret,
      authorizationEndpoint: provider.authorization_endpoint,
      tokenEndpoint: provider.token_endpoint,
      defaultScopes,
      pkceRequired: provider.pkce_required,
      tokenEndpointAuthMethod: provider.token_endpoint_auth_method as 'client_secret_post' | 'client_secret_basic' | 'none'
    };
  }
}
