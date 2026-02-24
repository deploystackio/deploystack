import type { FastifyBaseLogger } from 'fastify';
import { getDb } from '../db';
import { mcpOauthTokens, mcpServerInstallations, mcpServers } from '../db/schema';
import { and, eq, lt, gt, or, isNotNull } from 'drizzle-orm';
import { OAuthTokenService } from '../services/OAuthTokenService';
import { OAuthDiscoveryService } from '../services/OAuthDiscoveryService';
import { decrypt } from '../utils/encryption';

/**
 * Refreshes expiring OAuth tokens for MCP servers
 *
 * This background job runs every 5 minutes and refreshes tokens that:
 * - Have a refresh_token (NOT NULL)
 * - Have an expires_at timestamp (NOT NULL)
 * - Expire within the next 10 minutes, OR
 * - Already expired up to 24 hours ago (retry with hourly backoff)
 *
 * For each expiring token:
 * 1. Discovers OAuth endpoints from MCP server
 * 2. Decrypts the refresh token
 * 3. Calls OAuth token endpoint to refresh
 * 4. Encrypts and stores new access token
 * 5. Handles refresh token rotation if provider sends new refresh_token
 * 6. On successful recovery of expired token, clears requires_reauth status
 * 7. On failure, updates token's updated_at to enable hourly retry backoff
 */
export async function refreshExpiringOAuthTokens(logger: FastifyBaseLogger) {
	try {
		const db = getDb();

		// Tokens expiring within next 10 minutes
		const expiryThreshold = new Date(Date.now() + 10 * 60 * 1000);
		const now = new Date();
		// Allow retrying tokens that expired up to 24 hours ago
		const expiredFloor = new Date(Date.now() - 24 * 60 * 60 * 1000);
		// For already-expired tokens, only retry if not attempted in the last hour
		const retryFloor = new Date(Date.now() - 60 * 60 * 1000);

		logger.trace(
			{
				operation: 'refresh_expiring_oauth_tokens',
				expiryThreshold,
				now,
			},
			'Starting OAuth token refresh job'
		);

		// Find expiring tokens with their server information
		const expiringTokens = await db
			.select({
				token: mcpOauthTokens,
				installation: mcpServerInstallations,
				server: mcpServers,
			})
			.from(mcpOauthTokens)
			.innerJoin(
				mcpServerInstallations,
				eq(mcpOauthTokens.installation_id, mcpServerInstallations.id)
			)
			.innerJoin(mcpServers, eq(mcpServerInstallations.server_id, mcpServers.id))
			.where(
				and(
					isNotNull(mcpOauthTokens.refresh_token),
					isNotNull(mcpOauthTokens.expires_at),
					or(
						// Case 1: Token expiring soon (within 10 min) — always refresh
						and(
							lt(mcpOauthTokens.expires_at, expiryThreshold),
							gt(mcpOauthTokens.expires_at, now)
						),
						// Case 2: Token already expired (up to 24h ago) — retry with hourly backoff
						and(
							lt(mcpOauthTokens.expires_at, now),
							gt(mcpOauthTokens.expires_at, expiredFloor),
							lt(mcpOauthTokens.updated_at, retryFloor)
						)
					)
				)
			);

		if (expiringTokens.length === 0) {
			logger.trace(
				{ operation: 'refresh_expiring_oauth_tokens' },
				'No tokens need refreshing'
			);
			return 0;
		}

		logger.info(
			{
				operation: 'refresh_expiring_oauth_tokens',
				count: expiringTokens.length,
			},
			'Found tokens that need refreshing'
		);

		// Initialize services
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tokenService = new OAuthTokenService(logger as any);
		const discoveryService = new OAuthDiscoveryService(logger);

		let successCount = 0;
		let failureCount = 0;

		// Refresh each token
		for (const { token, installation, server } of expiringTokens) {
			try {
				logger.debug(
					{
						tokenId: token.id,
						installationId: installation.id,
						serverId: server.id,
						expiresAt: token.expires_at,
						operation: 'refresh_expiring_oauth_tokens',
					},
					'Refreshing token'
				);

				// Extract server URL from MCP server configuration
				let serverUrl: string | null = null;

				// Parse JSON fields if they are strings (Drizzle returns TEXT fields as strings)
				const remotes =
					typeof server.remotes === 'string' ? JSON.parse(server.remotes) : server.remotes;
				const packages =
					typeof server.packages === 'string' ? JSON.parse(server.packages) : server.packages;

				if (remotes && Array.isArray(remotes) && remotes.length > 0 && remotes[0] !== null) {
					// Remote MCP server (HTTP/SSE)
					serverUrl = remotes[0]?.url || null;
				} else if (
					packages &&
					Array.isArray(packages) &&
					packages.length > 0 &&
					packages[0] !== null
				) {
					// Stdio MCP server with OAuth configuration
					serverUrl = packages[0]?.oauth_server_url || packages[0]?.url || null;
				}

				if (!serverUrl) {
					logger.warn(
						{
							tokenId: token.id,
							serverId: server.id,
							operation: 'refresh_expiring_oauth_tokens',
						},
						'Cannot determine server URL for OAuth discovery - skipping token refresh'
					);
					failureCount++;
					continue;
				}

				// Discover OAuth endpoints
				const discovery = await discoveryService.detectAndDiscoverOAuth(serverUrl);

				if (!discovery.requiresOauth || !discovery.metadata) {
					logger.warn(
						{
							tokenId: token.id,
							serverId: server.id,
							serverUrl,
							operation: 'refresh_expiring_oauth_tokens',
						},
						'OAuth discovery failed or server does not require OAuth - skipping token refresh'
					);
					failureCount++;
					continue;
				}

				// Decrypt refresh token
				const decryptedRefreshToken = decrypt(token.refresh_token!, logger);

				// Determine client ID: use stored DCR client ID or fall back to 'deploystack'
				const clientId = installation.oauth_client_id || 'deploystack';

				// Decrypt client secret if stored (from DCR or pre-registered provider)
				const clientSecret = installation.oauth_client_secret
					? decrypt(installation.oauth_client_secret, logger)
					: null;

				// Use stored token endpoint (from installation) with fallback to discovery
				const tokenEndpoint = installation.oauth_token_endpoint || discovery.metadata.token_endpoint;
				const tokenEndpointAuthMethod = installation.oauth_token_endpoint_auth_method || 'none';

				// Refresh access token
				const newTokens = await tokenService.refreshToken({
					refreshToken: decryptedRefreshToken,
					clientId,
					tokenEndpoint,
					clientSecret,
					tokenEndpointAuthMethod: tokenEndpointAuthMethod as 'client_secret_post' | 'client_secret_basic' | 'none',
				});

				// Update encrypted tokens in database
				await tokenService.updateRefreshedTokens(token.id, newTokens, db);

				// If token was already expired and we successfully refreshed,
				// clear requires_reauth status so the user can reconnect
				if (token.expires_at && token.expires_at < now) {
					const { getSchema } = await import('../db');
					const { mcpServerInstances } = getSchema();
					await db
						.update(mcpServerInstances)
						.set({
							status: 'offline',
							status_message: 'OAuth token refreshed successfully. Reconnection needed.',
							status_updated_at: new Date(),
						})
						.where(
							and(
								eq(mcpServerInstances.installation_id, installation.id),
								eq(mcpServerInstances.status, 'requires_reauth')
							)
						);

					logger.info(
						{
							operation: 'refresh_expiring_oauth_tokens',
							installationId: installation.id,
							tokenId: token.id,
						},
						'Cleared requires_reauth status after successful token recovery'
					);
				}

				logger.info(
					{
						tokenId: token.id,
						installationId: installation.id,
						serverId: server.id,
						teamId: token.team_id,
						userId: token.user_id,
						oldExpiresAt: token.expires_at,
						newExpiresIn: newTokens.expires_in,
						clientId,
						wasExpired: token.expires_at ? token.expires_at < now : false,
						operation: 'refresh_expiring_oauth_tokens',
					},
					'Token refreshed successfully'
				);

				successCount++;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error(
					{
						error: errorMessage,
						tokenId: token.id,
						installationId: installation.id,
						serverId: server.id,
						operation: 'refresh_expiring_oauth_tokens',
					},
					'Failed to refresh token'
				);

				// Update token's updated_at to track last refresh attempt (enables hourly retry backoff)
				try {
					await db
						.update(mcpOauthTokens)
						.set({ updated_at: new Date() })
						.where(eq(mcpOauthTokens.id, token.id));
				} catch (updateError) {
					logger.error(
						{
							error: updateError instanceof Error ? updateError.message : 'Unknown error',
							tokenId: token.id,
							operation: 'refresh_expiring_oauth_tokens',
						},
						'Failed to update token updated_at after refresh failure'
					);
				}

				// Update ALL user instances status to requires_reauth
				try {
					const { getSchema } = await import('../db');
					const { mcpServerInstances } = getSchema();
					await db
						.update(mcpServerInstances)
						.set({
							status: 'requires_reauth',
							status_message: `OAuth token refresh failed: ${errorMessage}. Please re-authenticate.`,
							status_updated_at: new Date(),
						})
						.where(eq(mcpServerInstances.installation_id, installation.id));

					logger.warn(
						{
							operation: 'oauth_refresh_status_update',
							installation_id: installation.id,
							team_id: installation.team_id,
							server_id: server.id,
							error: errorMessage,
						},
						'OAuth refresh failed, installation status set to requires_reauth'
					);
				} catch (statusUpdateError) {
					logger.error(
						{
							error: statusUpdateError instanceof Error ? statusUpdateError.message : 'Unknown error',
							installation_id: installation.id,
							operation: 'oauth_refresh_status_update',
						},
						'Failed to update installation status after OAuth refresh failure'
					);
				}

				failureCount++;
			}
		}

		logger.info(
			{
				operation: 'refresh_expiring_oauth_tokens',
				totalTokens: expiringTokens.length,
				successCount,
				failureCount,
			},
			'OAuth token refresh job completed'
		);

		return successCount;
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : 'Unknown error',
				operation: 'refresh_expiring_oauth_tokens',
			},
			'OAuth token refresh job failed'
		);
		throw error;
	}
}
