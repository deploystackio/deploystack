import type { Logger } from 'pino';
import type { AnyDatabase } from '../db';
import { mcpOauthTokens } from '../db/schema.sqlite';
import { eq } from 'drizzle-orm';
import { encrypt } from '../utils/encryption';

export interface TokenExchangeParams {
	code: string;
	codeVerifier: string;
	clientId: string;
	redirectUri: string;
	tokenEndpoint: string;
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
	 * @param params - Token exchange parameters
	 * @returns Token response from OAuth server
	 * @throws Error if token exchange fails
	 */
	async exchangeCodeForToken(params: TokenExchangeParams): Promise<TokenResponse> {
		this.logger.info(
			{ tokenEndpoint: params.tokenEndpoint, clientId: params.clientId },
			'Exchanging authorization code for token'
		);

		try {
			// Build request body (application/x-www-form-urlencoded)
			const requestBody = new URLSearchParams({
				grant_type: 'authorization_code',
				code: params.code,
				redirect_uri: params.redirectUri,
				client_id: params.clientId,
				code_verifier: params.codeVerifier, // PKCE verification
			});

			// Exchange code for token
			const response = await fetch(params.tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
					'User-Agent': 'DeployStack/1.0',
				},
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
	 * @param params - Token refresh parameters
	 * @returns New token response from OAuth server
	 * @throws Error if token refresh fails
	 */
	async refreshToken(params: TokenRefreshParams): Promise<TokenResponse> {
		this.logger.info(
			{ tokenEndpoint: params.tokenEndpoint, clientId: params.clientId },
			'Refreshing access token'
		);

		try {
			// Build request body (application/x-www-form-urlencoded)
			const requestBody = new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: params.refreshToken,
				client_id: params.clientId,
			});

			// Request new access token
			const response = await fetch(params.tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
					'User-Agent': 'DeployStack/1.0',
				},
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

			// Multi-driver compatibility: check both SQLite and Turso result properties
			const rowsAffected = (result as any).changes || (result as any).rowsAffected || 0;

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
