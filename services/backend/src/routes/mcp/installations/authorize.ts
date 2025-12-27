import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { OAuthDiscoveryService } from '../../../services/OAuthDiscoveryService';
import { OAuthClientRegistrationService } from '../../../services/OAuthClientRegistrationService';
import { encrypt } from '../../../utils/encryption';
import { generatePKCEPair, generateState, generateResourceParameter } from '../../../utils/pkce';
import { getDb, getSchema } from '../../../db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { GlobalSettings } from '../../../global-settings';
import {
  TEAM_ID_PARAM_SCHEMA,
  OAUTH_AUTHORIZE_REQUEST_SCHEMA,
  OAUTH_AUTHORIZE_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  DUAL_AUTH_SECURITY,
  type TeamIdParams,
  type OAuthAuthorizeRequest,
  type OAuthAuthorizeSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function authorizeRoute(server: FastifyInstance) {
  server.post('/teams/:teamId/mcp/installations/authorize', {
    preValidation: [
      requireAuthenticationAny(),
      requireTeamPermission('mcp.installations.create')
    ],
    schema: {
      tags: ['MCP Installations', 'OAuth'],
      summary: 'Initiate OAuth flow for MCP server installation',
      description: 'Creates a pending MCP server installation and returns OAuth authorization URL for user authentication. Requires Content-Type: application/json header when sending request body.',
      security: DUAL_AUTH_SECURITY,

      // Fastify validation schema
      params: TEAM_ID_PARAM_SCHEMA,
      body: OAUTH_AUTHORIZE_REQUEST_SCHEMA,

      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: OAUTH_AUTHORIZE_REQUEST_SCHEMA
          }
        }
      },

      response: {
        200: {
          ...OAUTH_AUTHORIZE_SUCCESS_RESPONSE_SCHEMA,
          description: 'OAuth authorization URL generated successfully'
        },
        ...COMMON_ERROR_RESPONSES,
        404: {
          ...COMMON_ERROR_RESPONSES[404],
          description: 'MCP server not found'
        }
      }
    }
  }, async (request, reply) => {
    // TypeScript type assertion (Fastify has already validated)
    const { teamId } = request.params as TeamIdParams;
    const userId = request.user!.id;
    const body = request.body as OAuthAuthorizeRequest;
    const authType = request.tokenPayload ? 'oauth2' : 'cookie';

    request.log.info({
      operation: 'oauth_authorization_initiate',
      teamId,
      userId,
      authType,
      serverId: body.server_id
    }, 'Initiating OAuth authorization flow for MCP server installation');

    try {
      const db = getDb();
      const { mcpServers, oauthPendingFlows } = getSchema();

      // Get MCP server from catalog
      const [mcpServer] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, body.server_id))
        .limit(1);

      if (!mcpServer) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'MCP server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Verify server requires OAuth
      if (!mcpServer.requires_oauth) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'MCP server does not require OAuth authentication'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Get server URL from packages or remotes
      let serverUrl: string | null = null;

      // DEBUG: Log raw values from database
      server.log.info({
        operation: 'oauth_debug',
        server_id: body.server_id,
        packages_raw: mcpServer.packages,
        packages_type: typeof mcpServer.packages,
        remotes_raw: mcpServer.remotes,
        remotes_type: typeof mcpServer.remotes,
        transport_type: mcpServer.transport_type
      }, 'DEBUG: Raw database values');

      // Parse JSON fields if they are strings (Drizzle returns TEXT fields as strings)
      const packages = typeof mcpServer.packages === 'string'
        ? JSON.parse(mcpServer.packages)
        : mcpServer.packages;

      const remotes = typeof mcpServer.remotes === 'string'
        ? JSON.parse(mcpServer.remotes)
        : mcpServer.remotes;

      // DEBUG: Log parsed values
      server.log.info({
        operation: 'oauth_debug',
        packages_parsed: packages,
        packages_is_array: Array.isArray(packages),
        packages_length: packages?.length,
        remotes_parsed: remotes,
        remotes_is_array: Array.isArray(remotes),
        remotes_length: remotes?.length,
        remotes_first: remotes?.[0]
      }, 'DEBUG: Parsed values');

      if (packages && Array.isArray(packages) && packages.length > 0 && packages[0] !== null) {
        // For stdio transport, extract from first package
        serverUrl = packages[0]?.url || null;
        server.log.info({ operation: 'oauth_debug', serverUrl, source: 'packages' }, 'DEBUG: URL from packages');
      }

      // Always check remotes if we don't have a URL yet (not else if!)
      if (!serverUrl && remotes && Array.isArray(remotes) && remotes.length > 0) {
        // For http/sse transport, extract from first remote
        serverUrl = remotes[0]?.url || null;
        server.log.info({ operation: 'oauth_debug', serverUrl, source: 'remotes', remote_object: remotes[0] }, 'DEBUG: URL from remotes');
      }

      if (!serverUrl) {
        server.log.error({
          operation: 'oauth_url_not_found',
          server_id: body.server_id,
          packages,
          remotes
        }, 'MCP server URL not found - dumping full data');

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'MCP server URL not found in server configuration'
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
        throw new Error('OAuth discovery failed');
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
        // DCR available - use dynamic registration (existing flow)
        request.log.info(
          { registrationEndpoint: discovery.metadata.registration_endpoint },
          'Registering dynamic OAuth client'
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
          'Dynamic client registration successful'
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
          operation: 'oauth_using_provider',
          provider_name: discovery.provider.name,
          provider_id: discovery.provider.id,
          clientId,
          hasClientSecret: !!clientSecret,
          tokenEndpointAuthMethod,
          scopes
        }, `Using pre-registered OAuth provider: ${discovery.provider.name}`);

      } else {
        // No DCR and no provider - cannot proceed
        request.log.error({
          operation: 'oauth_no_provider',
          serverUrl,
          authEndpoint: discovery.metadata.authorization_endpoint
        }, 'OAuth provider not configured - no DCR support and no matching pre-registered provider');

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

      // Serialize team config (if provided)
      const teamConfigJson = body.team_config ? JSON.stringify(body.team_config) : null;

      // Store pending flow (NOT installation - installation created after OAuth completes)
      await db.insert(oauthPendingFlows).values({
        id: flowId,
        team_id: teamId,
        server_id: mcpServer.id,
        created_by: userId,
        oauth_state: state,
        oauth_code_verifier: pkce.code_verifier,
        oauth_client_id: clientId,
        oauth_client_secret: clientSecret ? encrypt(clientSecret, request.log) : null,
        oauth_provider_id: providerId,
        oauth_token_endpoint: tokenEndpoint,
        oauth_token_endpoint_auth_method: tokenEndpointAuthMethod,
        installation_name: body.installation_name || mcpServer.name,
        installation_type: body.installation_type,
        team_config: teamConfigJson,
        expires_at: expiresAt,
        created_at: new Date(),
      });

      request.log.info({
        operation: 'oauth_authorization_initiated',
        flowId,
        serverId: mcpServer.id,
        teamId,
        userId,
        providerId,
        authUrl: authUrl.toString(),
        expiresAt
      }, 'OAuth authorization initiated successfully');

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
        operation: 'oauth_authorization_initiate',
        teamId,
        userId,
        serverId: body.server_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to initiate OAuth authorization');

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate OAuth authorization'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
