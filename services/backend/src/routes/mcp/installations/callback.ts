import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import { OAuthTokenService } from '../../../services/OAuthTokenService';
import { encrypt, decrypt } from '../../../utils/encryption';
import { GlobalSettingsInitService } from '../../../global-settings';
import { GlobalSettings } from '../../../global-settings';
import { nanoid } from 'nanoid';
import {
	OAUTH_CALLBACK_QUERY_SCHEMA,
	FLOW_ID_PARAM_SCHEMA,
	type OAuthCallbackQuery,
	type FlowIdParams,
} from './schemas';

/**
 * OAuth callback route for MCP server authentication
 *
 * This endpoint receives the authorization code from the OAuth provider,
 * exchanges it for access/refresh tokens, encrypts and stores them,
 * and completes the installation.
 *
 * Flow:
 * 1. Validate state parameter (CSRF protection)
 * 2. Find pending installation
 * 3. Exchange code for tokens using PKCE
 * 4. Encrypt and store tokens
 * 5. Mark installation as complete
 * 6. Redirect to frontend with success status
 */
export default async function oauthCallbackRoute(server: FastifyInstance) {
	server.get(
		'/teams/:teamId/mcp/oauth/callback/:flowId',
		{
			schema: {
				description: 'OAuth callback endpoint for MCP server authentication',
				tags: ['MCP Installations', 'OAuth'],
				params: FLOW_ID_PARAM_SCHEMA,
				querystring: OAUTH_CALLBACK_QUERY_SCHEMA,
			},
		},
		async (request: FastifyRequest, reply: FastifyReply) => {
			const query = request.query as OAuthCallbackQuery;
			const params = request.params as FlowIdParams;
			const { teamId, flowId } = params;
			const db = getDb();
			const { oauthPendingFlows, mcpServerInstallations, mcpServers, mcpOauthTokens } = getSchema();

			// Check for OAuth errors from provider
			if (query.error) {
				request.log.warn(
					{
						error: query.error,
						description: query.error_description,
						flowId,
						teamId,
					},
					'OAuth callback received error from provider'
				);

				// Render error page that posts message to opener
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				const errorMsg = query.error_description || query.error;
				return reply.type('text/html').send(`
					<!DOCTYPE html>
					<html>
						<head>
							<title>Authorization Failed</title>
							<meta charset="utf-8">
						</head>
						<body>
							<h1>Authorization Failed</h1>
							<p><strong>Error:</strong> ${escapeHtml(query.error)}</p>
							${query.error_description ? `<p>${escapeHtml(query.error_description)}</p>` : ''}
							<p>Closing window...</p>
							<script>
								// Post error message to parent window
								if (window.opener) {
									window.opener.postMessage({
										type: 'oauth_error',
										error: '${escapeHtml(errorMsg)}'
									}, '${frontendUrl}');
								}

								// Close the popup window
								setTimeout(() => {
									window.close();
								}, 500);
							</script>
						</body>
					</html>
				`);
			}

			// Validate required parameters
			if (!query.state || !query.code) {
				request.log.error(
					{ state: query.state, hasCode: !!query.code, flowId },
					'Missing required OAuth parameters'
				);
				return reply.code(400).send({ error: 'Missing required OAuth parameters (state or code)' });
			}

			// Find pending flow by flowId and state
			const [flow] = await db
				.select()
				.from(oauthPendingFlows)
				.where(
					and(
						eq(oauthPendingFlows.id, flowId),
						eq(oauthPendingFlows.team_id, teamId),
						eq(oauthPendingFlows.oauth_state, query.state)
					)
				)
				.limit(1);

			if (!flow) {
				request.log.error(
					{ state: query.state, flowId, teamId },
					'No pending flow found for state'
				);
				return reply.code(404).send({ error: 'Flow not found or OAuth state invalid' });
			}

			// Check if expired
			if (flow.expires_at < new Date()) {
				request.log.warn({ flowId }, 'OAuth pending flow expired');

				// Delete expired flow
				await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

				return reply.code(400).send({ error: 'Flow expired. Please try again.' });
			}

			// Get MCP server details
			const [mcpServer] = await db
				.select()
				.from(mcpServers)
				.where(eq(mcpServers.id, flow.server_id))
				.limit(1);

			if (!mcpServer) {
				request.log.error({ serverId: flow.server_id }, 'MCP server not found');
				return reply.code(404).send({ error: 'MCP server not found' });
			}

			try {
				// Construct redirect URI (must match what was sent in authorization request)
				const backendUrl = await GlobalSettings.get('global.backend_url', 'http://localhost:3000');
				const redirectUri = `${backendUrl}/api/teams/${teamId}/mcp/oauth/callback/${flowId}`;

				// Get OAuth configuration from flow record
				const clientId = flow.oauth_client_id;
				const tokenEndpoint = flow.oauth_token_endpoint;
				const tokenEndpointAuthMethod = flow.oauth_token_endpoint_auth_method as 'client_secret_post' | 'client_secret_basic' | 'none';

				// Decrypt client secret if present (for pre-registered providers)
				let clientSecret: string | null = null;
				if (flow.oauth_client_secret) {
					try {
						clientSecret = decrypt(flow.oauth_client_secret, request.log);
					} catch {
						request.log.error({ flowId: flow.id }, 'Failed to decrypt client secret');
						// Continue without client secret - may fail at token exchange
					}
				}

				request.log.info(
					{
						clientId,
						flowId: flow.id,
						tokenEndpoint,
						authMethod: tokenEndpointAuthMethod,
						hasClientSecret: !!clientSecret,
						hasProviderId: !!flow.oauth_provider_id
					},
					'Using OAuth configuration for token exchange'
				);

				// Exchange code for token using PKCE verification
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const tokenService = new OAuthTokenService(request.log as any);
				const tokenResponse = await tokenService.exchangeCodeForToken({
					code: query.code,
					codeVerifier: flow.oauth_code_verifier,
					clientId,
					redirectUri,
					tokenEndpoint,
					clientSecret,
					tokenEndpointAuthMethod,
				});

				// Calculate token expiry
				const expiresAt = tokenResponse.expires_in
					? new Date(Date.now() + tokenResponse.expires_in * 1000)
					: null;

				// Parse team config
				const teamConfig = flow.team_config ? JSON.parse(flow.team_config) : {};

				// CREATE INSTALLATION NOW (after successful OAuth - not before!)
				const installationId = nanoid();
				await db.insert(mcpServerInstallations).values({
					id: installationId,
					team_id: flow.team_id,
					server_id: flow.server_id,
					created_by: flow.created_by,
					installation_name: flow.installation_name,
					installation_type: flow.installation_type,
					team_args: teamConfig.team_args ? JSON.stringify(teamConfig.team_args) : null,
					team_env: teamConfig.team_env ? JSON.stringify(teamConfig.team_env) : null,
					team_headers: teamConfig.team_headers ? JSON.stringify(teamConfig.team_headers) : null,
					team_url_query_params: teamConfig.team_url_query_params ? JSON.stringify(teamConfig.team_url_query_params) : null,
					// DO NOT set oauth_pending fields - installation is complete from the start
					oauth_state: null,
					oauth_code_verifier: null,
					oauth_pending: false,
					oauth_pending_expires_at: null,
					oauth_client_id: null,
					oauth_client_secret: null,
					oauth_provider_id: null,
					oauth_token_endpoint: null,
					oauth_token_endpoint_auth_method: null,
					status: 'connecting',
					status_message: 'Authenticated successfully, waiting for satellite to connect',
					status_updated_at: new Date(),
					created_at: new Date(),
					updated_at: new Date(),
					last_used_at: null,
				});

				// Encrypt tokens
				const encryptedAccessToken = encrypt(tokenResponse.access_token, request.log);
				const encryptedRefreshToken = tokenResponse.refresh_token
					? encrypt(tokenResponse.refresh_token, request.log)
					: null;

				// Store encrypted tokens
				await db.insert(mcpOauthTokens).values({
					id: nanoid(),
					installation_id: installationId,
					user_id: flow.created_by,
					team_id: flow.team_id,
					access_token: encryptedAccessToken,
					refresh_token: encryptedRefreshToken,
					token_type: tokenResponse.token_type || 'Bearer',
					expires_at: expiresAt,
					scope: tokenResponse.scope || null,
					created_at: new Date(),
					updated_at: new Date(),
				});

				// DELETE the flow (critical - prevents reuse and cleans up temporary data)
				await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

				// Create satellite commands for immediate notification
				try {
					const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');
					const satelliteCommandService = new SatelliteCommandService(db, request.log);
					const commands = await satelliteCommandService.notifyMcpInstallation(
						installationId,
						flow.team_id,
						flow.created_by
					);

					request.log.info(
						{
							installationId,
							flowId: flow.id,
							commandsCreated: commands.length,
							satelliteIds: commands.map(c => c.satellite_id)
						},
						'Satellite commands created for OAuth MCP installation'
					);
				} catch (commandError) {
					request.log.error(commandError, `Failed to create satellite commands for installation ${installationId}:`);
					// Don't fail OAuth completion if command creation fails
				}

				request.log.info(
					{
						installationId,
						flowId: flow.id,
						serverId: mcpServer.id,
						teamId: flow.team_id,
						userId: flow.created_by,
						providerId: flow.oauth_provider_id,
						authMethod: tokenEndpointAuthMethod,
					},
					'OAuth flow completed successfully - installation created'
				);

				// Return HTML page that posts message to opener and closes
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				return reply.type('text/html').send(`
					<!DOCTYPE html>
					<html>
						<head>
							<title>Authorization Successful</title>
							<meta charset="utf-8">
						</head>
						<body>
							<h1>Authorization Successful</h1>
							<p>Closing window...</p>
							<script>
								// Post success message to parent window
								if (window.opener) {
									window.opener.postMessage({
										type: 'oauth_success',
										installation_id: '${installationId}'
									}, '${frontendUrl}');
								}

								// Close the popup window
								setTimeout(() => {
									window.close();
								}, 500);
							</script>
						</body>
					</html>
				`);
			} catch (error) {
				request.log.error(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						flowId: flow.id,
					},
					'OAuth callback processing failed'
				);

				// Clean up failed flow (NOT installation, since we didn't create one yet)
				await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

				// Render error page that posts message to opener
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				return reply.type('text/html').send(`
					<!DOCTYPE html>
					<html>
						<head>
							<title>Authorization Failed</title>
							<meta charset="utf-8">
						</head>
						<body>
							<h1>Authorization Failed</h1>
							<p>An error occurred while processing the authorization.</p>
							<p>Closing window...</p>
							<script>
								// Post error message to parent window
								if (window.opener) {
									window.opener.postMessage({
										type: 'oauth_error',
										error: '${escapeHtml(errorMessage)}'
									}, '${frontendUrl}');
								}

								// Close the popup window
								setTimeout(() => {
									window.close();
								}, 500);
							</script>
						</body>
					</html>
				`);
			}
		}
	);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}
