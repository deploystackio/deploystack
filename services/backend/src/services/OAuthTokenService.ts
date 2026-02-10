import type { Logger } from 'pino';
import type { AnyDatabase } from '../db';
import { mcpOauthTokens } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '../utils/encryption';

export interface TokenExchangeParams {
	code: string;
	codeVerifier: string;
	clientId: string;
	redirectUri: string;
	tokenEndpoint: string;
	clientSecret?: string | null;
	tokenEndpointAuthMethod?: 'client_secret_post' | 'client_secret_basic' | 'none';
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in?: number;
	refresh_token?: string;
	scope?: string;
}

export interface TokenRefreshParams {
	refreshToken: string;
	clientId: string;
	tokenEndpoint: string;
	clientSecret?: string | null;
	tokenEndpointAuthMethod?: 'client_secret_post' | 'client_secret_basic' | 'none';
}

/**
 * Service for exchanging OAuth authorization codes for access tokens
 * and refreshing expired tokens.
 */
export class OAuthTokenService {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Exchanges authorization code for access token using PKCE verification
	 *
	 * Supports different token endpoint authentication methods:
	 * - 'none': Public client, PKCE only (no client secret)
	 * - 'client_secret_post': Client secret in request body (GitHub, most providers)
	 * - 'client_secret_basic': HTTP Basic Auth header (some enterprise providers)
	 *
	 * @param params - Token exchange parameters
	 * @returns Token response from OAuth server
	 * @throws Error if token exchange fails
	 */
	async exchangeCodeForToken(params: TokenExchangeParams): Promise<TokenResponse> {
		const authMethod = params.tokenEndpointAuthMethod || 'none';

		this.logger.info(
			{
				tokenEndpoint: params.tokenEndpoint,
				clientId: params.clientId,
				authMethod,
				hasClientSecret: !!params.clientSecret
			},
			'Exchanging authorization code for token'
		);

		try {
			// Build request body based on auth method
			const requestBody = new URLSearchParams({
				grant_type: 'authorization_code',
				code: params.code,
				redirect_uri: params.redirectUri,
				code_verifier: params.codeVerifier, // PKCE verification
			});

			// Build headers
			const headers: Record<string, string> = {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
				'User-Agent': 'Mozilla/5.0 (compatible; DeployStack/1.0; +https://deploystack.io)',
			};

			// Handle authentication based on method
			switch (authMethod) {
				case 'client_secret_basic':
					// HTTP Basic Auth: client_id:client_secret in Authorization header
					if (params.clientSecret) {
						const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');
						headers['Authorization'] = `Basic ${credentials}`;
					} else {
						// No secret, just send client_id in body as fallback
						requestBody.set('client_id', params.clientId);
					}
					break;

				case 'client_secret_post':
					// Client secret in body (GitHub, most providers)
					requestBody.set('client_id', params.clientId);
					if (params.clientSecret) {
						requestBody.set('client_secret', params.clientSecret);
					}
					break;

				case 'none':
				default:
					// Public client - only client_id, no secret (PKCE-only)
					requestBody.set('client_id', params.clientId);
					break;
			}

			// Exchange code for token
			const response = await fetch(params.tokenEndpoint, {
				method: 'POST',
				headers,
				body: requestBody.toString(),
				signal: AbortSignal.timeout(10000), // 10 second timeout
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(
					{ status: response.status, error: errorText, tokenEndpoint: params.tokenEndpoint },
					'Token exchange failed'
				);
				throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
			}

			const tokenData = (await response.json()) as TokenResponse;

			// Validate required fields
			if (!tokenData.access_token) {
				this.logger.error({ tokenData }, 'Token response missing access_token');
				throw new Error('Token response missing access_token');
			}

			this.logger.info(
				{
					tokenType: tokenData.token_type,
					expiresIn: tokenData.expires_in,
					hasRefreshToken: !!tokenData.refresh_token,
					scope: tokenData.scope,
				},
				'Token exchange successful'
			);

			return tokenData;
		} catch (error) {
			this.logger.error(
				{
					error: error instanceof Error ? error.message : 'Unknown error',
					tokenEndpoint: params.tokenEndpoint,
				},
				'Token exchange exception'
			);
			throw error;
		}
	}

	/**
	 * Refreshes an access token using a refresh token
	 *
	 * Supports different token endpoint authentication methods:
	 * - 'none': Public client (no client secret)
	 * - 'client_secret_post': Client secret in request body
	 * - 'client_secret_basic': HTTP Basic Auth header
	 *
	 * @param params - Token refresh parameters
	 * @returns New token response from OAuth server
	 * @throws Error if token refresh fails
	 */
	async refreshToken(params: TokenRefreshParams): Promise<TokenResponse> {
		const authMethod = params.tokenEndpointAuthMethod || 'none';

		this.logger.info(
			{
				tokenEndpoint: params.tokenEndpoint,
				clientId: params.clientId,
				authMethod,
				hasClientSecret: !!params.clientSecret
			},
			'Refreshing access token'
		);

		try {
			// Build request body
			const requestBody = new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: params.refreshToken,
			});

			// Build headers
			const headers: Record<string, string> = {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
				'User-Agent': 'Mozilla/5.0 (compatible; DeployStack/1.0; +https://deploystack.io)',
			};

			// Handle authentication based on method
			switch (authMethod) {
				case 'client_secret_basic':
					// HTTP Basic Auth
					if (params.clientSecret) {
						const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');
						headers['Authorization'] = `Basic ${credentials}`;
					} else {
						requestBody.set('client_id', params.clientId);
					}
					break;

				case 'client_secret_post':
					// Client secret in body
					requestBody.set('client_id', params.clientId);
					if (params.clientSecret) {
						requestBody.set('client_secret', params.clientSecret);
					}
					break;

				case 'none':
				default:
					// Public client
					requestBody.set('client_id', params.clientId);
					break;
			}

			// Request new access token
			const response = await fetch(params.tokenEndpoint, {
				method: 'POST',
				headers,
				body: requestBody.toString(),
				signal: AbortSignal.timeout(10000), // 10 second timeout
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(
					{ status: response.status, error: errorText, tokenEndpoint: params.tokenEndpoint },
					'Token refresh failed'
				);
				throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
			}

			const tokenData = (await response.json()) as TokenResponse;

			// Validate required fields
			if (!tokenData.access_token) {
				this.logger.error({ tokenData }, 'Token refresh response missing access_token');
				throw new Error('Token refresh response missing access_token');
			}

			this.logger.info(
				{
					tokenType: tokenData.token_type,
					expiresIn: tokenData.expires_in,
					hasNewRefreshToken: !!tokenData.refresh_token,
					scope: tokenData.scope,
				},
				'Token refresh successful'
			);

			return tokenData;
		} catch (error) {
			this.logger.error(
				{
					error: error instanceof Error ? error.message : 'Unknown error',
					tokenEndpoint: params.tokenEndpoint,
				},
				'Token refresh exception'
			);
			throw error;
		}
	}

	/**
	 * Updates stored tokens with newly refreshed tokens (encrypted)
	 *
	 * This method is called after successfully refreshing a token to update
	 * the database with the new encrypted access token and refresh token.
	 *
	 * @param tokenId - Token record ID in mcpOauthTokens table
	 * @param newTokens - New token response from OAuth server
	 * @param db - Database instance
	 * @throws Error if database update fails
	 */
	async updateRefreshedTokens(
		tokenId: string,
		newTokens: TokenResponse,
		db: AnyDatabase
	): Promise<void> {
		this.logger.info({ tokenId, operation: 'update_refreshed_tokens' }, 'Updating refreshed tokens in database');

		try {
			// Encrypt new access token
			const encryptedAccessToken = encrypt(newTokens.access_token, this.logger);

			// Encrypt new refresh token (if provided - some OAuth servers rotate refresh tokens)
			const encryptedRefreshToken = newTokens.refresh_token
				? encrypt(newTokens.refresh_token, this.logger)
				: undefined; // Keep existing if not rotated

			// Calculate new expiry timestamp
			const expiresAt = newTokens.expires_in
				? new Date(Date.now() + newTokens.expires_in * 1000)
				: null;

			// Update database with encrypted tokens
			const result = await db
				.update(mcpOauthTokens)
				.set({
					access_token: encryptedAccessToken,
					...(encryptedRefreshToken !== undefined && { refresh_token: encryptedRefreshToken }),
					expires_at: expiresAt,
					scope: newTokens.scope || undefined,
					updated_at: new Date(),
				})
				.where(eq(mcpOauthTokens.id, tokenId));

			// PostgreSQL result property
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rowsAffected = (result as any).rowCount || 0;

			if (rowsAffected === 0) {
				this.logger.error({ tokenId }, 'Failed to update tokens - token record not found');
				throw new Error('Token record not found');
			}

			this.logger.info(
				{
					tokenId,
					expiresAt,
					hasNewRefreshToken: !!encryptedRefreshToken,
					operation: 'update_refreshed_tokens',
				},
				'Refreshed tokens updated successfully (encrypted)'
			);
		} catch (error) {
			this.logger.error(
				{
					error: error instanceof Error ? error.message : 'Unknown error',
					tokenId,
					operation: 'update_refreshed_tokens',
				},
				'Failed to update refreshed tokens'
			);
			throw error;
		}
	}
}
