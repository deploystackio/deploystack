import type { FastifyBaseLogger } from 'fastify';
import { OAuthProviderMatchService, MatchedOAuthProvider } from './OAuthProviderMatchService';

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
  provider?: MatchedOAuthProvider; // Pre-registered provider (when DCR not available)
  discoveryUrl?: string; // Optional discovery URL from WWW-Authenticate header
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
      const detectionResult = await this.checkOAuthRequirement(url);

      if (!detectionResult.requiresOauth) {
        this.logger.info({ url }, 'MCP server does not require OAuth');
        return { requiresOauth: false };
      }

      // Step 2: Extract issuer from URL (use discovery URL from header if available)
      let issuer: string;
      if (detectionResult.discoveryUrl) {
        this.logger.info(
          { url, discoveryUrl: detectionResult.discoveryUrl },
          'OAuth discovery URL found in WWW-Authenticate header'
        );
        issuer = detectionResult.discoveryUrl;
      } else {
        const issuerUrl = new URL(url);
        issuer = `${issuerUrl.protocol}//${issuerUrl.host}`;
      }

      if (detectionResult.resourceMetadataUrl) {
        this.logger.info(
          { url, resourceMetadataUrl: detectionResult.resourceMetadataUrl },
          'RFC 9728 resource_metadata URL found in WWW-Authenticate header'
        );
      }

      this.logger.info({ url, issuer }, 'OAuth required, starting discovery');

      // Step 3: Discover OAuth metadata
      const metadata = await this.discoverOAuthMetadata(
        issuer,
        detectionResult.discoveryUrl,
        detectionResult.resourceMetadataUrl
      );

      this.logger.info(
        {
          url,
          issuer,
          authEndpoint: metadata.authorization_endpoint,
          tokenEndpoint: metadata.token_endpoint,
          hasDcr: this.hasDcrSupport(metadata)
        },
        'OAuth discovery completed successfully'
      );

      // Check if DCR is supported
      if (this.hasDcrSupport(metadata)) {
        this.logger.info(
          { url, registrationEndpoint: metadata.registration_endpoint },
          'DCR endpoint found, will use Dynamic Client Registration'
        );
        return {
          requiresOauth: true,
          metadata
        };
      }

      // DCR not supported - check for pre-registered provider
      this.logger.info(
        { url, authEndpoint: metadata.authorization_endpoint },
        'No DCR endpoint, checking for pre-registered OAuth provider'
      );

      const providerMatchService = new OAuthProviderMatchService(this.logger);
      const provider = await providerMatchService.findMatchingProvider(metadata.authorization_endpoint);

      if (provider) {
        this.logger.info(
          {
            url,
            providerId: provider.id,
            providerName: provider.name
          },
          `Found pre-registered OAuth provider: ${provider.name}`
        );
        return {
          requiresOauth: true,
          metadata,
          provider
        };
      }

      // No DCR and no matching provider
      this.logger.warn(
        { url, authEndpoint: metadata.authorization_endpoint },
        'No DCR support and no matching pre-registered provider found'
      );
      return {
        requiresOauth: true,
        metadata
        // provider is undefined - caller should handle this case
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
   * Checks if MCP server requires OAuth by making test requests
   *
   * Tries GET first (most common case), then POST with MCP protocol request
   * (handles servers like Harmonic that only protect POST endpoints)
   *
   * @param url - MCP server URL
   * @returns Detection result with optional discovery URL from WWW-Authenticate header
   */
  private async checkOAuthRequirement(url: string): Promise<{
    requiresOauth: boolean;
    discoveryUrl?: string;
    resourceMetadataUrl?: string;
  }> {
    try {
      // Try GET first (fast path for most servers)
      this.logger.debug({ url, method: 'GET' }, 'Making test request to check OAuth requirement');
      const getResult = await this.tryOAuthDetection(url, 'GET');
      if (getResult.requiresOauth) {
        this.logger.info({ url, method: 'GET' }, 'OAuth detected via GET');
        return getResult;
      }

      // Try POST with MCP protocol request (handles Harmonic-style servers)
      this.logger.debug(
        { url, method: 'POST' },
        'Server returned non-401 on GET, trying POST with MCP protocol request'
      );
      const postResult = await this.tryOAuthDetection(url, 'POST', {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      });

      if (postResult.requiresOauth) {
        this.logger.info({ url, method: 'POST' }, 'OAuth detected via POST');
        return postResult;
      }

      this.logger.debug({ url }, 'No OAuth requirement detected (both GET and POST returned non-401)');
      return { requiresOauth: false };
    } catch (error) {
      this.logger.warn(
        { url, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to check OAuth requirement, assuming no OAuth'
      );
      return { requiresOauth: false };
    }
  }

  /**
   * Attempts OAuth detection with specified HTTP method
   *
   * @param url - MCP server URL
   * @param method - HTTP method (GET or POST)
   * @param body - Optional request body for POST requests
   * @returns Detection result with optional discovery URL
   */
  private async tryOAuthDetection(
    url: string,
    method: 'GET' | 'POST',
    body?: object
  ): Promise<{
    requiresOauth: boolean;
    discoveryUrl?: string;
    resourceMetadataUrl?: string;
  }> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'DeployStack/1.0'
    };

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    // Check for 401 Unauthorized
    if (response.status !== 401) {
      this.logger.debug(
        { url, method, status: response.status },
        'Server returned non-401 status'
      );
      return { requiresOauth: false };
    }

    // Check for WWW-Authenticate: Bearer header
    const wwwAuthenticate = response.headers.get('www-authenticate');
    if (!wwwAuthenticate || !wwwAuthenticate.toLowerCase().includes('bearer')) {
      this.logger.debug(
        { url, method, wwwAuthenticate },
        'No Bearer authentication scheme found'
      );
      return { requiresOauth: false };
    }

    // Extract optional discovery URL from WWW-Authenticate header
    // Format: oauth_authorization_server="https://example.com/.well-known/oauth-authorization-server"
    const match = wwwAuthenticate.match(/oauth_authorization_server="([^"]+)"/);
    const discoveryUrl = match ? match[1] : undefined;

    // Extract optional RFC 9728 resource metadata URL from WWW-Authenticate header
    // Format: resource_metadata="https://..." (quoted) or resource_metadata=https://... (unquoted)
    // PlanetScale does NOT quote the URL, Neon DOES quote it — handle both
    const resourceMetadataMatch = wwwAuthenticate.match(/resource_metadata="?([^",\s]+)"?/);
    const resourceMetadataUrl = resourceMetadataMatch ? resourceMetadataMatch[1] : undefined;

    this.logger.info(
      { url, method, wwwAuthenticate, discoveryUrl, resourceMetadataUrl },
      'OAuth requirement detected (401 + WWW-Authenticate: Bearer)'
    );

    return {
      requiresOauth: true,
      discoveryUrl,
      resourceMetadataUrl
    };
  }

  /**
   * Discovers OAuth server metadata using multiple discovery strategies
   *
   * Priority order:
   * 1. RFC 9728 resource_metadata → two-hop discovery (protected resource metadata)
   * 2. Direct oauth_authorization_server URL from WWW-Authenticate header
   * 3. RFC 8414 at root /.well-known/oauth-authorization-server
   * 4. OpenID Connect /.well-known/openid-configuration
   *
   * @param issuer - OAuth issuer URL (e.g., "https://api.box.com")
   * @param discoveryUrl - Optional direct discovery URL from WWW-Authenticate header
   * @param resourceMetadataUrl - Optional RFC 9728 resource metadata URL
   * @returns OAuth server metadata
   * @throws Error if discovery fails
   */
  private async discoverOAuthMetadata(
    issuer: string,
    discoveryUrl?: string,
    resourceMetadataUrl?: string
  ): Promise<OAuthServerMetadata> {
    // Normalize issuer URL (remove trailing slash)
    const normalizedIssuer = issuer.replace(/\/$/, '');

    // Priority 1: RFC 9728 protected resource metadata (two-hop discovery)
    if (resourceMetadataUrl) {
      this.logger.debug(
        { issuer: normalizedIssuer, resourceMetadataUrl },
        'Trying RFC 9728 protected resource metadata discovery'
      );
      const resourceMetadata = await this.discoverViaProtectedResourceMetadata(resourceMetadataUrl);
      if (resourceMetadata) {
        return resourceMetadata;
      }
    }

    // Priority 2: Direct discovery URL from WWW-Authenticate header
    if (discoveryUrl) {
      this.logger.debug(
        { issuer: normalizedIssuer, discoveryUrl },
        'Trying discovery URL from WWW-Authenticate header'
      );
      const headerMetadata = await this.fetchMetadata(discoveryUrl);
      if (headerMetadata) {
        this.logger.info(
          { issuer: normalizedIssuer, discoveryUrl },
          'Successfully discovered OAuth metadata via WWW-Authenticate header'
        );
        return headerMetadata;
      }
    }

    // Priority 3: RFC 8414 at root
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

    // Priority 4: OpenID Connect discovery as fallback
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

    // All failed
    this.logger.error(
      { issuer: normalizedIssuer, resourceMetadataUrl, discoveryUrl, rfc8414Url, oidcUrl },
      'OAuth discovery failed on all endpoints'
    );
    throw new Error(
      `OAuth discovery failed for ${normalizedIssuer}. Tried ${resourceMetadataUrl ? 'RFC 9728 resource metadata, ' : ''}${discoveryUrl ? 'WWW-Authenticate header, ' : ''}RFC 8414 and OpenID Connect endpoints.`
    );
  }

  /**
   * Discovers OAuth metadata via RFC 9728 Protected Resource Metadata (two-hop discovery)
   *
   * 1. Fetches the resource metadata URL → gets { resource, authorization_servers: [...] }
   * 2. Takes first authorization server URL
   * 3. Constructs path-aware well-known URL for that authorization server
   * 4. Fetches OAuth authorization server metadata
   *
   * @param resourceMetadataUrl - URL from WWW-Authenticate resource_metadata parameter
   * @returns OAuth server metadata or null if discovery fails
   */
  private async discoverViaProtectedResourceMetadata(
    resourceMetadataUrl: string
  ): Promise<OAuthServerMetadata | null> {
    try {
      this.logger.debug(
        { resourceMetadataUrl },
        'Fetching RFC 9728 protected resource metadata'
      );

      const response = await fetch(resourceMetadataUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DeployStack/1.0'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        this.logger.debug(
          { resourceMetadataUrl, status: response.status },
          'Protected resource metadata fetch failed'
        );
        return null;
      }

      const resourceMetadata = (await response.json()) as {
        resource?: string;
        authorization_servers?: string[];
      };

      const authorizationServers = resourceMetadata.authorization_servers;
      if (!authorizationServers || authorizationServers.length === 0) {
        this.logger.warn(
          { resourceMetadataUrl, resourceMetadata },
          'Protected resource metadata missing authorization_servers'
        );
        return null;
      }

      const authServerUrl = authorizationServers[0];
      this.logger.debug(
        { resourceMetadataUrl, authServerUrl },
        'Found authorization server from protected resource metadata'
      );

      // Construct path-aware well-known URL per RFC 8414
      // If auth server has a path (e.g., https://host/mcp/planetscale),
      // the well-known URL is https://host/.well-known/oauth-authorization-server/mcp/planetscale
      const parsedAuthServer = new URL(authServerUrl);
      const authServerPath = parsedAuthServer.pathname === '/' ? '' : parsedAuthServer.pathname;
      const wellKnownUrl = `${parsedAuthServer.protocol}//${parsedAuthServer.host}/.well-known/oauth-authorization-server${authServerPath}`;

      this.logger.debug(
        { authServerUrl, wellKnownUrl },
        'Constructed path-aware well-known URL for authorization server'
      );

      const metadata = await this.fetchMetadata(wellKnownUrl);
      if (metadata) {
        this.logger.info(
          { resourceMetadataUrl, wellKnownUrl },
          'Successfully discovered OAuth metadata via RFC 9728 protected resource metadata'
        );
      }

      return metadata;
    } catch (error) {
      this.logger.debug(
        { resourceMetadataUrl, error: error instanceof Error ? error.message : 'Unknown error' },
        'RFC 9728 protected resource metadata discovery failed'
      );
      return null;
    }
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

  /**
   * Checks if OAuth server supports Dynamic Client Registration (DCR)
   *
   * @param metadata - OAuth server metadata
   * @returns true if registration_endpoint is present
   */
  private hasDcrSupport(metadata: OAuthServerMetadata): boolean {
    return !!metadata.registration_endpoint;
  }
}
