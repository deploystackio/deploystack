import { type FastifyInstance } from 'fastify';
import { requireAuthenticationAny, requireOAuthScope } from '../../../middleware/oauthMiddleware';
import { requireTeamPermission } from '../../../middleware/roleMiddleware';
import { OAuthAuthorizationService } from '../../../services/OAuthAuthorizationService';
import { OAuthDiscoveryService } from '../../../services/OAuthDiscoveryService';
import { OAuthClientRegistrationService } from '../../../services/OAuthClientRegistrationService';
import { encrypt } from '../../../utils/encryption';
import { getDb } from '../../../db';
import { mcpServers, mcpServerInstallations } from '../../../db/schema.sqlite';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
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
      requireOAuthScope('mcp:read'),
      requireTeamPermission('mcp.installations.create')
    ],
    schema: {
      tags: ['MCP Installations', 'OAuth'],
      summary: 'Initiate OAuth flow for MCP server installation',
      description: 'Creates a pending MCP server installation and returns OAuth authorization URL for user authentication. Requires Content-Type: application/json header when sending request body. Supports both cookie-based authentication (for web users) and OAuth2 Bearer token authentication (for CLI users). Requires mcp:read scope for OAuth2 access.',
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

      // Create pending installation
      const installationId = nanoid();
      const authService = new OAuthAuthorizationService(request.log);

      // Build backend URL for OAuth callback
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = process.env.HOST || 'localhost';
      const port = process.env.PORT || '3000';
      const backendUrl = process.env.NODE_ENV === 'production'
        ? `${protocol}://${host}`
        : `${protocol}://${host}:${port}`;
      const redirectUri = `${backendUrl}/api/teams/${teamId}/mcp/installations/${installationId}/oauth/callback`;

      // Discover OAuth endpoints and check for dynamic client registration
      const discoveryService = new OAuthDiscoveryService(request.log);
      const discovery = await discoveryService.detectAndDiscoverOAuth(serverUrl);

      if (!discovery.requiresOauth || !discovery.metadata) {
        throw new Error('OAuth discovery failed');
      }

      // Dynamic client registration (RFC 7591)
      let clientId = 'deploystack'; // Default client_id
      let clientSecret: string | null = null;

      if (discovery.metadata.registration_endpoint) {
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

        request.log.info(
          { clientId, hasClientSecret: !!clientSecret },
          'Dynamic client registration successful'
        );
      }

      // Build authorization URL
      const authResult = await authService.buildAuthorizationUrl({
        serverId: mcpServer.id,
        serverUrl,
        teamId,
        userId,
        installationId,
        redirectUri,
        clientId, // Use dynamically registered client_id
        scope: undefined // Will use default scopes from OAuth provider
      });

      // Store pending installation
      await db.insert(mcpServerInstallations).values({
        id: installationId,
        team_id: teamId,
        server_id: mcpServer.id,
        created_by: userId,
        installation_name: body.installation_name || mcpServer.name,
        installation_type: 'global',
        team_args: null,
        team_env: body.team_config ? JSON.stringify(body.team_config) : null,
        team_headers: null,
        team_url_query_params: null,
        oauth_state: authResult.state,
        oauth_code_verifier: authResult.codeVerifier,
        oauth_pending: true,
        oauth_pending_expires_at: authResult.expiresAt,
        oauth_client_id: clientId,
        oauth_client_secret: clientSecret ? encrypt(clientSecret, request.log) : null,
        created_at: new Date(),
        updated_at: new Date(),
        last_used_at: null
      });

      request.log.info({
        operation: 'oauth_authorization_initiated',
        installationId,
        serverId: mcpServer.id,
        teamId,
        userId,
        authUrl: authResult.authorizationUrl,
        expiresAt: authResult.expiresAt
      }, 'OAuth authorization initiated successfully');

      const successResponse: OAuthAuthorizeSuccessResponse = {
        installation_id: installationId,
        authorization_url: authResult.authorizationUrl,
        requires_authorization: true,
        expires_at: authResult.expiresAt.toISOString()
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
