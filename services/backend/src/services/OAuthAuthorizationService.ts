import type { FastifyBaseLogger } from 'fastify';
import { OAuthDiscoveryService } from './OAuthDiscoveryService';
import { generatePKCEPair, generateState, generateResourceParameter } from '../utils/pkce';

export interface AuthorizationUrlParams {
  serverId: string;
  serverUrl: string;
  teamId: string;
  userId: string;
  installationId: string;
  redirectUri: string;
  scope?: string;
}

export interface AuthorizationUrlResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  expiresAt: Date;
}

export class OAuthAuthorizationService {
  private discoveryService: OAuthDiscoveryService;
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
    this.discoveryService = new OAuthDiscoveryService(logger);
  }

  /**
   * Builds OAuth authorization URL for browser redirect
   *
   * @param params - Authorization parameters
   * @returns Authorization URL with PKCE parameters
   */
  async buildAuthorizationUrl(params: AuthorizationUrlParams): Promise<AuthorizationUrlResult> {
    this.logger.info(
      { serverId: params.serverId, teamId: params.teamId, userId: params.userId },
      'Building OAuth authorization URL'
    );

    // Discover OAuth endpoints from MCP server URL
    const discovery = await this.discoveryService.detectAndDiscoverOAuth(params.serverUrl);

    if (!discovery.requiresOauth || !discovery.metadata) {
      throw new Error(`OAuth discovery failed for server: ${params.serverId}`);
    }

    // Generate PKCE pair
    const pkce = generatePKCEPair();

    // Generate state parameter
    const state = generateState();

    // Generate resource parameter (RFC 8707)
    const resource = generateResourceParameter(params.serverId, params.teamId);

    // Build authorization URL
    const authUrl = new URL(discovery.metadata.authorization_endpoint);

    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'deploystack');
    authUrl.searchParams.set('redirect_uri', params.redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', pkce.code_challenge);
    authUrl.searchParams.set('code_challenge_method', pkce.code_challenge_method);
    authUrl.searchParams.set('resource', resource);

    // Add scope if provided
    if (params.scope) {
      authUrl.searchParams.set('scope', params.scope);
    }

    // Add prompt parameter to force consent
    authUrl.searchParams.set('prompt', 'consent');

    this.logger.debug(
      {
        authUrl: authUrl.toString(),
        state,
        codeChallenge: pkce.code_challenge,
        resource
      },
      'Authorization URL built successfully'
    );

    // State expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    return {
      authorizationUrl: authUrl.toString(),
      state,
      codeVerifier: pkce.code_verifier,
      expiresAt
    };
  }
}
