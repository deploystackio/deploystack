import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../../db';
import { mcpServerInstallations, mcpServers, mcpOauthTokens } from '../../../db/schema.sqlite';
import { eq, and } from 'drizzle-orm';
import { OAuthTokenService } from '../../../services/OAuthTokenService';
import { OAuthDiscoveryService } from '../../../services/OAuthDiscoveryService';
import { encrypt } from '../../../utils/encryption';
import { GlobalSettingsInitService } from '../../../global-settings';
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
		'/api/teams/:teamId/mcp/installations/:installationId/oauth/callback',
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

				// Render error page
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
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
							<p>Redirecting to dashboard...</p>
							<script>
								setTimeout(() => {
									window.location.href = '${frontendUrl}/teams/${teamId}/mcp/installations?status=error&error=${encodeURIComponent(query.error)}';
								}, 2000);
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

				if (mcpServer.remotes && Array.isArray(mcpServer.remotes) && mcpServer.remotes.length > 0) {
					// Remote MCP server (HTTP/SSE)
					const remote = mcpServer.remotes[0];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					serverUrl = (remote as any).url;
				} else if (
					mcpServer.packages &&
					Array.isArray(mcpServer.packages) &&
					mcpServer.packages.length > 0
				) {
					// Stdio MCP server - check if it has OAuth configuration
					const pkg = mcpServer.packages[0];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					serverUrl = (pkg as any).oauth_server_url || null;
				}

				if (!serverUrl) {
					request.log.error(
						{ serverId: mcpServer.id, packages: mcpServer.packages, remotes: mcpServer.remotes },
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
				const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
				const host = process.env.HOST || 'localhost';
				const port = process.env.PORT || '3000';
				const backendUrl =
					process.env.NODE_ENV === 'production' ? `${protocol}://${host}` : `${protocol}://${host}:${port}`;
				const redirectUri = `${backendUrl}/api/teams/${teamId}/mcp/installations/${installationId}/oauth/callback`;

				// Exchange code for token using PKCE verification
				const tokenService = new OAuthTokenService(request.log as any);
				const tokenResponse = await tokenService.exchangeCodeForToken({
					code: query.code,
					codeVerifier: installation.oauth_code_verifier,
					clientId: 'deploystack',
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
					user_id: installation.installed_by_user_id,
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

				request.log.info(
					{
						installationId: installation.id,
						serverId: mcpServer.id,
						teamId: installation.team_id,
						userId: installation.installed_by_user_id,
					},
					'OAuth flow completed successfully'
				);

				// Redirect to frontend with success status
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				return reply.redirect(
					`${frontendUrl}/teams/${teamId}/mcp/installations?status=success&id=${installationId}`
				);
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

				// Render error page
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
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
							<p>Redirecting to dashboard...</p>
							<script>
								setTimeout(() => {
									window.location.href = '${frontendUrl}/teams/${teamId}/mcp/installations?status=error&error=processing_failed';
								}, 2000);
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
