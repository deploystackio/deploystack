import { Logger } from 'pino';
import { BackendClient } from './backend-client';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scope: string | null;
}

export interface OAuthTokenStatus {
  exists: boolean;
  expired: boolean | null;
  expires_at: string | null;
  can_refresh: boolean;
}

/**
 * Service for retrieving OAuth tokens from backend for MCP servers
 *
 * This service:
 * - Fetches OAuth tokens from Phase 9 backend endpoints
 * - Caches tokens for 5 minutes to reduce backend load
 * - Handles token expiration and missing tokens
 * - Only used for HTTP/SSE MCP servers (not stdio)
 */
export class OAuthTokenService {
  private logger: Logger;
  private backendClient: BackendClient;
  private satelliteId: string;
  private tokenCache = new Map<string, { tokens: OAuthTokens; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    logger: Logger,
    backendClient: BackendClient,
    satelliteId: string
  ) {
    this.logger = logger.child({ component: 'OAuthTokenService' });
    this.backendClient = backendClient;
    this.satelliteId = satelliteId;
  }

  /**
   * Generate cache key for tokens
   */
  private getCacheKey(installationId: string, userId: string, teamId: string): string {
    return `${installationId}:${userId}:${teamId}`;
  }

  /**
   * Check if cached token is still valid
   */
  private isCacheValid(cachedAt: number, expiresAt: string | null): boolean {
    // Check cache age (5 minutes)
    if (Date.now() - cachedAt > this.CACHE_TTL_MS) {
      return false;
    }

    // Check token expiration
    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      if (expiresDate <= new Date()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Retrieve OAuth tokens for an MCP server installation
   * Uses caching to reduce backend calls
   *
   * @param installationId - MCP server installation ID
   * @param userId - User ID who authorized the MCP server
   * @param teamId - Team ID for the installation
   * @returns OAuth tokens or null if not found
   */
  async getTokens(
    installationId: string,
    userId: string,
    teamId: string
  ): Promise<OAuthTokens | null> {
    const cacheKey = this.getCacheKey(installationId, userId, teamId);

    // Check cache first
    const cached = this.tokenCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.tokens.expires_at)) {
      this.logger.debug({
        operation: 'oauth_tokens_cache_hit',
        installation_id: installationId,
        user_id: userId,
        team_id: teamId
      }, 'Using cached OAuth tokens');
      return cached.tokens;
    }

    // Fetch from backend
    this.logger.debug({
      operation: 'oauth_tokens_fetch',
      installation_id: installationId,
      user_id: userId,
      team_id: teamId
    }, 'Fetching OAuth tokens from backend');

    try {
      const response = await fetch(
        `${this.backendClient.getBackendUrl()}/api/satellites/${this.satelliteId}/tokens/retrieve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.backendClient.getApiKey()}`
          },
          body: JSON.stringify({
            installation_id: installationId,
            user_id: userId,
            team_id: teamId
          }),
          signal: AbortSignal.timeout(10000)
        }
      );

      if (response.status === 404) {
        this.logger.warn({
          operation: 'oauth_tokens_not_found',
          installation_id: installationId,
          user_id: userId,
          team_id: teamId
        }, 'No OAuth tokens found for installation');
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error({
          operation: 'oauth_tokens_fetch_error',
          installation_id: installationId,
          status: response.status,
          error: errorText
        }, 'Failed to fetch OAuth tokens');
        throw new Error(`Failed to fetch OAuth tokens: ${response.status} ${errorText}`);
      }

      const tokens = await response.json() as OAuthTokens;

      // Cache the tokens
      this.tokenCache.set(cacheKey, {
        tokens,
        cachedAt: Date.now()
      });

      this.logger.info({
        operation: 'oauth_tokens_retrieved',
        installation_id: installationId,
        user_id: userId,
        team_id: teamId,
        expires_at: tokens.expires_at,
        has_refresh_token: !!tokens.refresh_token
      }, 'OAuth tokens retrieved successfully');

      return tokens;

    } catch (error) {
      this.logger.error({
        operation: 'oauth_tokens_fetch_failed',
        installation_id: installationId,
        user_id: userId,
        team_id: teamId,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to fetch OAuth tokens');
      throw error;
    }
  }

  /**
   * Check OAuth token status without retrieving tokens
   * Lightweight endpoint to check if tokens exist and are valid
   *
   * @param installationId - MCP server installation ID
   * @param userId - User ID
   * @param teamId - Team ID
   * @returns Token status information
   */
  async checkTokenStatus(
    installationId: string,
    userId: string,
    teamId: string
  ): Promise<OAuthTokenStatus> {
    this.logger.debug({
      operation: 'oauth_token_status_check',
      installation_id: installationId,
      user_id: userId,
      team_id: teamId
    }, 'Checking OAuth token status');

    try {
      const response = await fetch(
        `${this.backendClient.getBackendUrl()}/api/satellites/${this.satelliteId}/tokens/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.backendClient.getApiKey()}`
          },
          body: JSON.stringify({
            installation_id: installationId,
            user_id: userId,
            team_id: teamId
          }),
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) {
        throw new Error(`Token status check failed: ${response.status}`);
      }

      return await response.json() as OAuthTokenStatus;

    } catch (error) {
      this.logger.error({
        operation: 'oauth_token_status_check_failed',
        installation_id: installationId,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to check OAuth token status');
      throw error;
    }
  }

  /**
   * Clear cached tokens for an installation
   * Useful when tokens are invalidated or refreshed
   */
  clearCache(installationId: string, userId: string, teamId: string): void {
    const cacheKey = this.getCacheKey(installationId, userId, teamId);
    this.tokenCache.delete(cacheKey);

    this.logger.debug({
      operation: 'oauth_tokens_cache_cleared',
      installation_id: installationId
    }, 'Cleared OAuth token cache');
  }

  /**
   * Clear all cached tokens
   * Useful for testing or when satellite restarts
   */
  clearAllCache(): void {
    this.tokenCache.clear();
    this.logger.debug({
      operation: 'oauth_tokens_cache_cleared_all'
    }, 'Cleared all OAuth token cache');
  }

  /**
   * Clear all cached tokens for a specific user
   */
  clearUserCache(userId: string): number {
    let cleared = 0;

    // Cache key format: `${installationId}:${userId}:${teamId}`
    for (const cacheKey of this.tokenCache.keys()) {
      const parts = cacheKey.split(':');
      if (parts.length === 3 && parts[1] === userId) {
        this.tokenCache.delete(cacheKey);
        cleared++;
      }
    }

    this.logger.info({
      operation: 'oauth_tokens_user_cache_cleared',
      user_id: userId,
      cleared_count: cleared
    }, `Cleared ${cleared} OAuth cache entries for user ${userId}`);

    return cleared;
  }
}
