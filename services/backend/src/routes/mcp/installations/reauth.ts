import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { OAuthDiscoveryService } from '../../../services/OAuthDiscoveryService';
import { OAuthClientRegistrationService } from '../../../services/OAuthClientRegistrationService';
import { encrypt } from '../../../utils/encryption';
import { generatePKCEPair, generateState, generateResourceParameter } from '../../../utils/pkce';
import { getDb, getSchema } from '../../../db';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { GlobalSettings } from '../../../global-settings';
import {
  TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  OAUTH_AUTHORIZE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  type TeamAndInstallationParams,
  type OAuthAuthorizeSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function reauthRoute(server: FastifyInstance) {
  server.post('/teams/:teamId/mcp/installations/:installationId/reauth', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.view')
    ],
    schema: {
      tags: ['MCP Installations', 'OAuth'],
      summary: 'Re-authenticate MCP server installation',
      description: 'Initiates OAuth re-authorization for existing installation with expired or invalid tokens.',
      security: DUAL_AUTH_SECURITY,

      // Fastify validation schema
      params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,

      // OpenAPI documentation
      response: {
        200: {
          ...OAUTH_AUTHORIZE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Re-authentication OAuth authorization URL generated successfully'
        },
        ...COMMON_ERROR_RESPONSES,
        400: {
          ...COMMON_ERROR_RESPONSES[400],
          description: 'Installation does not require re-authorization or does not use OAuth'
        },
        404: {
          ...COMMON_ERROR_RESPONSES[404],
          description: 'Installation not found or does not belong to team'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId, installationId } = request.params as TeamAndInstallationParams;
    const userId = request.user!.id;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.info({
      operation: 'oauth_reauth_initiate',
      teamId,
      installationId,
      userId,
      authType
    }, 'Initiating OAuth re-authorization flow for existing installation');

    try {
      const db = getDb();
      const { mcpServerInstallations, mcpServers, oauthPendingFlows } = getSchema();

      // Find installation and join with server data
      const [installationData] = await db
        .select({
          installation: mcpServerInstallations,
          server: mcpServers
        })
        .from(mcpServerInstallations)
        .innerJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
        .where(
          and(
            eq(mcpServerInstallations.id, installationId),
            eq(mcpServerInstallations.team_id, teamId)
          )
        )
        .limit(1);

      if (!installationData) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Installation not found or does not belong to this team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const { installation, server: mcpServer } = installationData;

      // Check if installation requires re-auth
      if (installation.status !== 'requires_reauth') {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Installation does not require re-authorization. Current status: ${installation.status}`
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Verify server requires OAuth
      if (!mcpServer.requires_oauth) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'This server does not use OAuth authentication'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Get server URL from packages or remotes
      let serverUrl: string | null = null;

      // DEBUG: Log raw values from database
      server.log.info({
        operation: 'oauth_reauth_debug',
        installation_id: installationId,
        server_id: mcpServer.id,
        packages_raw: mcpServer.packages,
        packages_type: typeof mcpServer.packages,
        remotes_raw: mcpServer.remotes,
        remotes_type: typeof mcpServer.remotes,
        transport_type: mcpServer.transport_type
      }, 'DEBUG: Raw database values for re-auth');

      // Parse JSON fields if they are strings (Drizzle returns TEXT fields as strings)
      const packages = typeof mcpServer.packages === 'string'
        ? JSON.parse(mcpServer.packages)
        : mcpServer.packages;

      const remotes = typeof mcpServer.remotes === 'string'
        ? JSON.parse(mcpServer.remotes)
        : mcpServer.remotes;

      // DEBUG: Log parsed values
      server.log.info({
        operation: 'oauth_reauth_debug',
        packages_parsed: packages,
        packages_is_array: Array.isArray(packages),
        packages_length: packages?.length,
        remotes_parsed: remotes,
        remotes_is_array: Array.isArray(remotes),
        remotes_length: remotes?.length,
        remotes_first: remotes?.[0]
      }, 'DEBUG: Parsed values for re-auth');

      if (packages && Array.isArray(packages) && packages.length > 0 && packages[0] !== null) {
        // For stdio transport, extract from first package
        serverUrl = packages[0]?.url || null;
        server.log.info({ operation: 'oauth_reauth_debug', serverUrl, source: 'packages' }, 'DEBUG: URL from packages');
      }

      // Always check remotes if we don't have a URL yet (not else if!)
      if (!serverUrl && remotes && Array.isArray(remotes) && remotes.length > 0) {
        // For http/sse transport, extract from first remote
        serverUrl = remotes[0]?.url || null;
        server.log.info({ operation: 'oauth_reauth_debug', serverUrl, source: 'remotes', remote_object: remotes[0] }, 'DEBUG: URL from remotes');
      }

      if (!serverUrl) {
        server.log.error({
          operation: 'oauth_reauth_url_not_found',
          installation_id: installationId,
          server_id: mcpServer.id,
          packages,
          remotes
        }, 'MCP server URL not found for re-auth - dumping full data');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Cannot determine OAuth server URL from installation configuration'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      // Create pending flow
      const flowId = nanoid();

      // Get backend URL from global settings for OAuth callback
      const backendUrl = await GlobalSettings.get('global.backend_url', 'http://localhost:3000');
      const redirectUri = `${backendUrl}/api/teams/${teamId}/mcp/oauth/callback/${flowId}`;

      // Discover OAuth endpoints and check for dynamic client registration
      const discoveryService = new OAuthDiscoveryService(request.log);
      const discovery = await discoveryService.detectAndDiscoverOAuth(serverUrl);

      if (!discovery.requiresOauth || !discovery.metadata) {
        throw new Error('OAuth discovery failed - server does not support OAuth or endpoints not found');
      }

      // Variables for OAuth configuration
      let clientId: string;
      let clientSecret: string | null = null;
      let tokenEndpoint: string;
      let tokenEndpointAuthMethod: string;
      let authorizationEndpoint: string;
      let providerId: string | null = null;
      let scopes: string[] = [];

      // Check for Dynamic Client Registration (DCR) or pre-registered provider
      if (discovery.metadata.registration_endpoint) {
        // DCR available - use dynamic registration
        request.log.info(
          { registrationEndpoint: discovery.metadata.registration_endpoint },
          'Registering dynamic OAuth client for re-auth'
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const registrationService = new OAuthClientRegistrationService(request.log as any);
        const registrationResponse = await registrationService.registerClient(
          discovery.metadata.registration_endpoint,
          {
            client_name: 'DeployStack',
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none', // Public client (PKCE)
          }
        );

        clientId = registrationResponse.client_id;
        if (registrationResponse.client_secret) {
          clientSecret = registrationResponse.client_secret;
        }
        tokenEndpoint = discovery.metadata.token_endpoint;
        tokenEndpointAuthMethod = 'none'; // DCR public client
        authorizationEndpoint = discovery.metadata.authorization_endpoint;

        // Use scopes from discovery metadata if available
        if (discovery.metadata.scopes_supported?.length) {
          scopes = discovery.metadata.scopes_supported;
        }

        request.log.info(
          { clientId, hasClientSecret: !!clientSecret },
          'Dynamic client registration successful for re-auth'
        );

      } else if (discovery.provider) {
        // No DCR but we have a pre-registered provider
        clientId = discovery.provider.clientId;
        clientSecret = discovery.provider.clientSecret;
        tokenEndpoint = discovery.provider.tokenEndpoint;
        tokenEndpointAuthMethod = discovery.provider.tokenEndpointAuthMethod;
        authorizationEndpoint = discovery.provider.authorizationEndpoint;
        providerId = discovery.provider.id;

        // Use provider's default scopes if discovery metadata doesn't have them
        if (discovery.metadata.scopes_supported?.length) {
          scopes = discovery.metadata.scopes_supported;
        } else if (discovery.provider.defaultScopes?.length) {
          scopes = discovery.provider.defaultScopes;
        }

        request.log.info({
          operation: 'oauth_reauth_using_provider',
          provider_name: discovery.provider.name,
          provider_id: discovery.provider.id,
          clientId,
          hasClientSecret: !!clientSecret,
          tokenEndpointAuthMethod,
          scopes
        }, `Using pre-registered OAuth provider for re-auth: ${discovery.provider.name}`);

      } else {
        // No DCR and no provider - cannot proceed
        request.log.error({
          operation: 'oauth_reauth_no_provider',
          serverUrl,
          authEndpoint: discovery.metadata.authorization_endpoint
        }, 'OAuth provider not configured for re-auth - no DCR support and no matching pre-registered provider');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'OAuth provider not configured. This MCP server requires OAuth but its ' +
            'authorization server does not support Dynamic Client Registration and no ' +
            'pre-registered provider is configured. Please contact support.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Generate PKCE pair
      const pkce = generatePKCEPair();

      // Generate state parameter
      const state = generateState();

      // Generate resource parameter (RFC 8707)
      const resource = generateResourceParameter(mcpServer.id, teamId);

      // Build authorization URL
      const authUrl = new URL(authorizationEndpoint);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', pkce.code_challenge);
      authUrl.searchParams.set('code_challenge_method', pkce.code_challenge_method);
      authUrl.searchParams.set('resource', resource);

      // Add scope if present
      if (scopes.length > 0) {
        authUrl.searchParams.set('scope', scopes.join(' '));
      }

      // Add prompt parameter to force consent
      authUrl.searchParams.set('prompt', 'consent');

      // State expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Parse existing team config from installation
      const teamArgs = installation.team_args
        ? (typeof installation.team_args === 'string' ? JSON.parse(installation.team_args) : installation.team_args)
        : [];

      const teamEnv = installation.team_env
        ? (typeof installation.team_env === 'string' ? JSON.parse(installation.team_env) : installation.team_env)
        : {};

      const teamHeaders = installation.team_headers
        ? (typeof installation.team_headers === 'string' ? JSON.parse(installation.team_headers) : installation.team_headers)
        : {};

      const teamUrlQueryParams = installation.team_url_query_params
        ? (typeof installation.team_url_query_params === 'string' ? JSON.parse(installation.team_url_query_params) : installation.team_url_query_params)
        : {};

      // Serialize existing team config (preserve all configuration)
      const teamConfigJson = JSON.stringify({
        team_args: teamArgs,
        team_env: teamEnv,
        team_headers: teamHeaders,
        team_url_query_params: teamUrlQueryParams
      });

      // Store pending flow with installation_id (KEY DIFFERENCE: This links re-auth to existing installation)
      await db.insert(oauthPendingFlows).values({
        id: flowId,
        team_id: teamId,
        server_id: mcpServer.id,
        created_by: userId,
        installation_id: installationId, // ← KEY: Link to existing installation for re-auth
        oauth_state: state,
        oauth_code_verifier: pkce.code_verifier,
        oauth_client_id: clientId,
        oauth_client_secret: clientSecret ? encrypt(clientSecret, request.log) : null,
        oauth_provider_id: providerId,
        oauth_token_endpoint: tokenEndpoint,
        oauth_token_endpoint_auth_method: tokenEndpointAuthMethod,
        installation_name: installation.installation_name, // Preserve existing name
        installation_type: installation.installation_type, // Preserve type
        team_config: teamConfigJson, // Preserve existing config
        expires_at: expiresAt,
        created_at: new Date(),
      });

      request.log.info({
        operation: 'oauth_reauth_initiated',
        flowId,
        installationId,
        serverId: mcpServer.id,
        teamId,
        userId,
        providerId,
        authUrl: authUrl.toString(),
        expiresAt
      }, 'OAuth re-authorization initiated successfully');

      const successResponse: OAuthAuthorizeSuccessResponse = {
        flow_id: flowId,
        authorization_url: authUrl.toString(),
        requires_authorization: true,
        expires_at: expiresAt.toISOString()
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      request.log.error({
        operation: 'oauth_reauth_initiate',
        teamId,
        installationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to initiate OAuth re-authorization');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate re-authorization'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
