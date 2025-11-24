import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../../db';
import { mcpServerInstallations, mcpServers, mcpOauthTokens } from '../../../db/schema.sqlite';
import { eq, and } from 'drizzle-orm';
import { OAuthTokenService } from '../../../services/OAuthTokenService';
import { OAuthDiscoveryService } from '../../../services/OAuthDiscoveryService';
import { encrypt } from '../../../utils/encryption';
import { GlobalSettingsInitService } from '../../../global-settings';
import { GlobalSettings } from '../../../global-settings';
import { nanoid } from 'nanoid';
import {
	OAUTH_CALLBACK_QUERY_SCHEMA,
	TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
	type OAuthCallbackQuery,
	type TeamAndInstallationParams,
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
		'/teams/:teamId/mcp/installations/:installationId/oauth/callback',
		{
			schema: {
				description: 'OAuth callback endpoint for MCP server authentication',
				tags: ['MCP Installations', 'OAuth'],
				params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
				querystring: OAUTH_CALLBACK_QUERY_SCHEMA,
			},
		},
		async (request: FastifyRequest, reply: FastifyReply) => {
			const query = request.query as OAuthCallbackQuery;
			const params = request.params as TeamAndInstallationParams;
			const { teamId, installationId } = params;
			const db = getDb();

			// Check for OAuth errors from provider
			if (query.error) {
				request.log.warn(
					{
						error: query.error,
						description: query.error_description,
						installationId,
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
					{ state: query.state, hasCode: !!query.code, installationId },
					'Missing required OAuth parameters'
				);
				return reply.code(400).send({ error: 'Missing required OAuth parameters (state or code)' });
			}

			// Find pending installation by state
			const [installation] = await db
				.select()
				.from(mcpServerInstallations)
				.where(
					and(
						eq(mcpServerInstallations.id, installationId),
						eq(mcpServerInstallations.team_id, teamId),
						eq(mcpServerInstallations.oauth_state, query.state),
						eq(mcpServerInstallations.oauth_pending, true)
					)
				)
				.limit(1);

			if (!installation) {
				request.log.error(
					{ state: query.state, installationId, teamId },
					'No pending installation found for state'
				);
				return reply.code(404).send({ error: 'Installation not found or OAuth state invalid' });
			}

			// Check if expired
			if (
				installation.oauth_pending_expires_at &&
				installation.oauth_pending_expires_at < new Date()
			) {
				request.log.warn({ installationId }, 'OAuth pending installation expired');

				// Delete expired installation
				await db.delete(mcpServerInstallations).where(eq(mcpServerInstallations.id, installation.id));

				return reply.code(400).send({ error: 'Installation expired. Please try again.' });
			}

			// Validate code_verifier exists
			if (!installation.oauth_code_verifier) {
				request.log.error({ installationId }, 'Missing oauth_code_verifier in installation');
				return reply.code(500).send({ error: 'Invalid installation state' });
			}

			// Get MCP server details
			const [mcpServer] = await db
				.select()
				.from(mcpServers)
				.where(eq(mcpServers.id, installation.server_id))
				.limit(1);

			if (!mcpServer) {
				request.log.error({ serverId: installation.server_id }, 'MCP server not found');
				return reply.code(404).send({ error: 'MCP server not found' });
			}

			try {
				// Extract server URL from packages or remotes
				let serverUrl: string | null = null;

				// Parse JSON fields if they are strings (Drizzle returns TEXT fields as strings)
				const packages = typeof mcpServer.packages === 'string'
					? JSON.parse(mcpServer.packages)
					: mcpServer.packages;

				const remotes = typeof mcpServer.remotes === 'string'
					? JSON.parse(mcpServer.remotes)
					: mcpServer.remotes;

				// Check packages first (with null check)
				if (packages && Array.isArray(packages) && packages.length > 0 && packages[0] !== null) {
					// Stdio MCP server - check if it has OAuth configuration
					const pkg = packages[0];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					serverUrl = (pkg as any).oauth_server_url || null;
				}

				// Always check remotes if we don't have a URL yet (not else if!)
				if (!serverUrl && remotes && Array.isArray(remotes) && remotes.length > 0) {
					// Remote MCP server (HTTP/SSE)
					const remote = remotes[0];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					serverUrl = (remote as any).url;
				}

				if (!serverUrl) {
					request.log.error(
						{ serverId: mcpServer.id, packages, remotes },
						'Cannot determine server URL for OAuth discovery'
					);
					throw new Error('Cannot determine server URL for OAuth discovery');
				}

				// Discover OAuth endpoints on-the-fly
				const discoveryService = new OAuthDiscoveryService(request.log);
				const discovery = await discoveryService.detectAndDiscoverOAuth(serverUrl);

				if (!discovery.requiresOauth || !discovery.metadata) {
					request.log.error({ serverUrl, discovery }, 'OAuth discovery failed or server does not require OAuth');
					throw new Error('OAuth discovery failed');
				}

				// Construct redirect URI (must match what was sent in authorization request)
				const backendUrl = await GlobalSettings.get('global.backend_url', 'http://localhost:3000');
				const redirectUri = `${backendUrl}/api/teams/${teamId}/mcp/installations/${installationId}/oauth/callback`;

				// Get client_id from installation (may be dynamically registered)
				const clientId = installation.oauth_client_id || 'deploystack';

				request.log.info(
					{ clientId, installationId: installation.id },
					'Using OAuth client_id for token exchange'
				);

				// Exchange code for token using PKCE verification
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const tokenService = new OAuthTokenService(request.log as any);
				const tokenResponse = await tokenService.exchangeCodeForToken({
					code: query.code,
					codeVerifier: installation.oauth_code_verifier,
					clientId,
					redirectUri,
					tokenEndpoint: discovery.metadata.token_endpoint,
				});

				// Calculate token expiry
				const expiresAt = tokenResponse.expires_in
					? new Date(Date.now() + tokenResponse.expires_in * 1000)
					: null;

				// Encrypt tokens
				const encryptedAccessToken = encrypt(tokenResponse.access_token, request.log);
				const encryptedRefreshToken = tokenResponse.refresh_token
					? encrypt(tokenResponse.refresh_token, request.log)
					: null;

				// Store encrypted tokens
				await db.insert(mcpOauthTokens).values({
					id: nanoid(),
					installation_id: installation.id,
					user_id: installation.created_by,
					team_id: installation.team_id,
					access_token: encryptedAccessToken,
					refresh_token: encryptedRefreshToken,
					token_type: tokenResponse.token_type || 'Bearer',
					expires_at: expiresAt,
					scope: tokenResponse.scope || null,
					created_at: new Date(),
					updated_at: new Date(),
				});

				// Update installation: mark as complete, clear OAuth pending state
				await db
					.update(mcpServerInstallations)
					.set({
						oauth_pending: false,
						oauth_state: null, // Clear state (security)
						oauth_code_verifier: null, // Clear verifier (security)
						oauth_pending_expires_at: null,
						updated_at: new Date(),
					})
					.where(eq(mcpServerInstallations.id, installation.id));

				// Create satellite commands for immediate notification
				try {
					const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');
					const satelliteCommandService = new SatelliteCommandService(db, request.log);
					const commands = await satelliteCommandService.notifyMcpInstallation(
						installation.id,
						installation.team_id,
						installation.created_by
					);

					request.log.info(
						{
							installationId: installation.id,
							commandsCreated: commands.length,
							satelliteIds: commands.map(c => c.satellite_id)
						},
						'Satellite commands created for OAuth MCP installation'
					);
				} catch (commandError) {
					request.log.error(commandError, `Failed to create satellite commands for installation ${installation.id}:`);
					// Don't fail OAuth completion if command creation fails
				}

				request.log.info(
					{
						installationId: installation.id,
						serverId: mcpServer.id,
						teamId: installation.team_id,
						userId: installation.created_by,
					},
					'OAuth flow completed successfully'
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
						installationId: installation.id,
					},
					'OAuth callback processing failed'
				);

				// Clean up failed installation
				await db.delete(mcpServerInstallations).where(eq(mcpServerInstallations.id, installation.id));

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
