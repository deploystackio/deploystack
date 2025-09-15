import type { FastifyBaseLogger } from 'fastify';
import { BackendClient } from './backend-client';

export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  sub?: string;
  aud?: string[];
  iss?: string;
  exp?: number;
  iat?: number;
  team_id?: string;
  team_name?: string;
  team_role?: string;
  team_permissions?: string[];
  error?: string;
  error_description?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: {
    id: string;
    username: string;
  };
  team?: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  scopes?: string[];
  client_id?: string;
  error?: string;
  error_description?: string;
}

export class TokenIntrospectionService {
  private backendClient: BackendClient;
  private logger: FastifyBaseLogger;
  private tokenCache: Map<string, { result: TokenValidationResult; expires: number }>;

  constructor(backendClient: BackendClient, logger: FastifyBaseLogger) {
    this.backendClient = backendClient;
    this.logger = logger.child({ component: 'TokenIntrospectionService' });
    this.tokenCache = new Map();

    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 5 * 60 * 1000);
  }

  /**
   * Validate Bearer token with Backend introspection (multi-team support)
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Check cache first (5 minute TTL)
      const cacheKey = this.hashToken(token);
      const cached = this.tokenCache.get(cacheKey);
      
      if (cached && cached.expires > Date.now()) {
        this.logger.debug({
          operation: 'token_validation_cache_hit'
        }, 'Token validation cache hit');
        
        return cached.result;
      }

      this.logger.debug({
        operation: 'token_introspection_start'
      }, 'Starting token introspection with Backend');

      // Call Backend introspection endpoint
      const introspectionResponse = await this.callIntrospectionEndpoint(token);

      if (!introspectionResponse.active) {
        const result: TokenValidationResult = {
          valid: false,
          error: introspectionResponse.error || 'invalid_token',
          error_description: introspectionResponse.error_description || 'Token is not active'
        };

        this.logger.warn({
          operation: 'token_validation_failed',
          error: result.error
        }, 'Token validation failed - token not active');

        return result;
      }

      // Token is valid - extract team information
      const result: TokenValidationResult = {
        valid: true,
        user: {
          id: introspectionResponse.sub!,
          username: introspectionResponse.username!
        },
        team: {
          id: introspectionResponse.team_id!,
          name: introspectionResponse.team_name!,
          role: introspectionResponse.team_role!,
          permissions: introspectionResponse.team_permissions || []
        },
        scopes: introspectionResponse.scope?.split(' ') || [],
        client_id: introspectionResponse.client_id
      };

      // Cache the result (5 minute TTL)
      this.tokenCache.set(cacheKey, {
        result,
        expires: Date.now() + (5 * 60 * 1000)
      });

      this.logger.debug({
        operation: 'token_validation_success',
        userId: result.user?.id,
        teamId: result.team?.id,
        clientId: result.client_id,
        scopes: result.scopes
      }, 'Token validation successful');

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'token_validation_error',
        error: errorMessage
      }, 'Token validation error');

      return {
        valid: false,
        error: 'server_error',
        error_description: 'Token validation failed due to server error'
      };
    }
  }

  /**
   * Call Backend introspection endpoint
   */
  private async callIntrospectionEndpoint(token: string): Promise<IntrospectionResponse> {
    const introspectionUri = `${this.backendClient.getBackendUrl()}/api/oauth2/introspect`;
    
    const response = await fetch(introspectionUri, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.backendClient.getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Introspection failed: HTTP ${response.status}`);
    }

    return await response.json() as IntrospectionResponse;
  }

  /**
   * Hash token for cache key (security)
   */
  private hashToken(token: string): string {
    // Simple hash for cache key - don't store actual tokens
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.tokenCache.entries()) {
      if (value.expires <= now) {
        this.tokenCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug({
        operation: 'token_cache_cleanup',
        cleaned,
        remaining: this.tokenCache.size
      }, 'Token cache cleanup completed');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cached_tokens: this.tokenCache.size,
      cache_hit_ratio: 'Not implemented' // Could track this if needed
    };
  }
}
