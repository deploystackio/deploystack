import type { FastifyBaseLogger } from 'fastify';

export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string; // RFC 7591 Dynamic Client Registration
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

export interface OAuthDetectionResult {
  requiresOauth: boolean;
  metadata?: OAuthServerMetadata;
}

export class OAuthDiscoveryService {
  constructor(private logger: FastifyBaseLogger) {}

  /**
   * Detects if an MCP server requires OAuth and discovers OAuth metadata
   *
   * @param url - MCP server URL (e.g., "https://mcp.example.com")
   * @returns Detection result with OAuth metadata if required
   */
  async detectAndDiscoverOAuth(url: string): Promise<OAuthDetectionResult> {
    this.logger.info({ url }, 'Starting OAuth detection for MCP server');

    try {
      // Step 1: Check if OAuth is required
      const requiresOauth = await this.checkOAuthRequirement(url);

      if (!requiresOauth) {
        this.logger.info({ url }, 'MCP server does not require OAuth');
        return { requiresOauth: false };
      }

      // Step 2: Extract issuer from URL
      const issuerUrl = new URL(url);
      const issuer = `${issuerUrl.protocol}//${issuerUrl.host}`;

      this.logger.info({ url, issuer }, 'OAuth required, starting discovery');

      // Step 3: Discover OAuth metadata
      const metadata = await this.discoverOAuthMetadata(issuer);

      this.logger.info(
        {
          url,
          issuer,
          authEndpoint: metadata.authorization_endpoint,
          tokenEndpoint: metadata.token_endpoint
        },
        'OAuth discovery completed successfully'
      );

      return {
        requiresOauth: true,
        metadata
      };
    } catch (error) {
      this.logger.error(
        { url, error: error instanceof Error ? error.message : 'Unknown error' },
        'OAuth detection/discovery failed'
      );
      throw error;
    }
  }

  /**
   * Checks if MCP server requires OAuth by making a test request
   *
   * @param url - MCP server URL
   * @returns true if 401 + WWW-Authenticate: Bearer header present
   */
  private async checkOAuthRequirement(url: string): Promise<boolean> {
    try {
      this.logger.debug({ url }, 'Making test request to check OAuth requirement');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DeployStack/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      // Check for 401 Unauthorized
      if (response.status !== 401) {
        this.logger.debug(
          { url, status: response.status },
          'Server returned non-401 status, OAuth not required'
        );
        return false;
      }

      // Check for WWW-Authenticate: Bearer header
      const wwwAuthenticate = response.headers.get('www-authenticate');
      if (!wwwAuthenticate || !wwwAuthenticate.toLowerCase().includes('bearer')) {
        this.logger.debug(
          { url, wwwAuthenticate },
          'No Bearer authentication scheme found, OAuth not required'
        );
        return false;
      }

      this.logger.info(
        { url, wwwAuthenticate },
        'OAuth requirement detected (401 + WWW-Authenticate: Bearer)'
      );
      return true;
    } catch (error) {
      this.logger.warn(
        { url, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to check OAuth requirement, assuming no OAuth'
      );
      return false;
    }
  }

  /**
   * Discovers OAuth server metadata using RFC 8414/9728 well-known endpoints
   *
   * @param issuer - OAuth issuer URL (e.g., "https://api.box.com")
   * @returns OAuth server metadata
   * @throws Error if discovery fails
   */
  private async discoverOAuthMetadata(issuer: string): Promise<OAuthServerMetadata> {
    // Normalize issuer URL (remove trailing slash)
    const normalizedIssuer = issuer.replace(/\/$/, '');

    // Try RFC 8414 first
    this.logger.debug({ issuer: normalizedIssuer }, 'Trying RFC 8414 discovery');
    const rfc8414Url = `${normalizedIssuer}/.well-known/oauth-authorization-server`;
    const rfc8414Metadata = await this.fetchMetadata(rfc8414Url);
    if (rfc8414Metadata) {
      this.logger.info(
        { issuer: normalizedIssuer, discoveryUrl: rfc8414Url },
        'Successfully discovered OAuth metadata via RFC 8414'
      );
      return rfc8414Metadata;
    }

    // Try OpenID Connect discovery as fallback
    this.logger.debug({ issuer: normalizedIssuer }, 'Trying OpenID Connect discovery');
    const oidcUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
    const oidcMetadata = await this.fetchMetadata(oidcUrl);
    if (oidcMetadata) {
      this.logger.info(
        { issuer: normalizedIssuer, discoveryUrl: oidcUrl },
        'Successfully discovered OAuth metadata via OpenID Connect'
      );
      return oidcMetadata;
    }

    // Both failed
    this.logger.error(
      { issuer: normalizedIssuer, rfc8414Url, oidcUrl },
      'OAuth discovery failed on all endpoints'
    );
    throw new Error(
      `OAuth discovery failed for ${normalizedIssuer}. Tried RFC 8414 and OpenID Connect endpoints.`
    );
  }

  /**
   * Fetches and validates OAuth metadata from a well-known URL
   *
   * @param url - Well-known metadata URL
   * @returns OAuth metadata or null if fetch fails
   */
  private async fetchMetadata(url: string): Promise<OAuthServerMetadata | null> {
    try {
      this.logger.debug({ url }, 'Fetching OAuth metadata');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DeployStack/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        this.logger.debug(
          { url, status: response.status },
          'Metadata fetch failed with non-OK status'
        );
        return null;
      }

      const metadata = (await response.json()) as OAuthServerMetadata;

      // Validate required fields
      if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
        this.logger.warn(
          { url, metadata },
          'OAuth metadata missing required endpoints'
        );
        return null;
      }

      // Validate PKCE support (warn if not supported, but don't fail)
      if (metadata.code_challenge_methods_supported) {
        if (!metadata.code_challenge_methods_supported.includes('S256')) {
          this.logger.warn(
            { url, methods: metadata.code_challenge_methods_supported },
            'OAuth server does not support S256 PKCE method (security concern)'
          );
        }
      }

      this.logger.debug(
        {
          url,
          authEndpoint: metadata.authorization_endpoint,
          tokenEndpoint: metadata.token_endpoint,
          supportsPKCE: metadata.code_challenge_methods_supported?.includes('S256') ?? false
        },
        'OAuth metadata fetched and validated'
      );

      return metadata;
    } catch (error) {
      this.logger.debug(
        { url, error: error instanceof Error ? error.message : 'Unknown error' },
        'Metadata fetch exception'
      );
      return null;
    }
  }
}
