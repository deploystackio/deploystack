import type { FastifyBaseLogger } from 'fastify';
import { getDb } from '../db';
import { mcpOauthTokens, mcpServerInstallations, mcpServers } from '../db/schema.sqlite';
import { and, eq, lt, gt, isNotNull } from 'drizzle-orm';
import { OAuthTokenService } from '../services/OAuthTokenService';
import { OAuthDiscoveryService } from '../services/OAuthDiscoveryService';
import { decrypt } from '../utils/encryption';

/**
 * Refreshes expiring OAuth tokens for MCP servers
 *
 * This background job runs every 5 minutes and refreshes tokens that:
 * - Have a refresh_token (NOT NULL)
 * - Have an expires_at timestamp (NOT NULL)
 * - Expire within the next 10 minutes
 * - Are not already expired
 *
 * For each expiring token:
 * 1. Discovers OAuth endpoints from MCP server
 * 2. Decrypts the refresh token
 * 3. Calls OAuth token endpoint to refresh
 * 4. Encrypts and stores new access token
 * 5. Handles refresh token rotation if provider sends new refresh_token
 */
export async function refreshExpiringOAuthTokens(logger: FastifyBaseLogger) {
	try {
		const db = getDb();

		// Tokens expiring within next 10 minutes
		const expiryThreshold = new Date(Date.now() + 10 * 60 * 1000);
		const now = new Date();

		logger.debug(
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
					// Must have refresh token
					isNotNull(mcpOauthTokens.refresh_token),
					// Must have expiry timestamp
					isNotNull(mcpOauthTokens.expires_at),
					// Expires within threshold
					lt(mcpOauthTokens.expires_at, expiryThreshold),
					// Not already expired
					gt(mcpOauthTokens.expires_at, now)
				)
			);

		if (expiringTokens.length === 0) {
			logger.debug(
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

				if (server.remotes && Array.isArray(server.remotes) && server.remotes.length > 0) {
					// Remote MCP server (HTTP/SSE)
					const remote = server.remotes[0];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					serverUrl = (remote as any).url;
				} else if (
					server.packages &&
					Array.isArray(server.packages) &&
					server.packages.length > 0
				) {
					// Stdio MCP server with OAuth configuration
					const pkg = server.packages[0];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					serverUrl = (pkg as any).oauth_server_url || null;
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

				// Refresh access token
				const newTokens = await tokenService.refreshToken({
					refreshToken: decryptedRefreshToken,
					clientId: 'deploystack', // Same client ID as authorization flow
					tokenEndpoint: discovery.metadata.token_endpoint,
				});

				// Update encrypted tokens in database
				await tokenService.updateRefreshedTokens(token.id, newTokens, db);

				logger.info(
					{
						tokenId: token.id,
						installationId: installation.id,
						serverId: server.id,
						teamId: token.team_id,
						userId: token.user_id,
						oldExpiresAt: token.expires_at,
						newExpiresIn: newTokens.expires_in,
						operation: 'refresh_expiring_oauth_tokens',
					},
					'Token refreshed successfully'
				);

				successCount++;
			} catch (error) {
				logger.error(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						tokenId: token.id,
						installationId: installation.id,
						serverId: server.id,
						operation: 'refresh_expiring_oauth_tokens',
					},
					'Failed to refresh token'
				);
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
