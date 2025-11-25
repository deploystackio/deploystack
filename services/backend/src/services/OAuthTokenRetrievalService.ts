import type { FastifyBaseLogger } from 'fastify';
import type { AnyDatabase } from '../db';
import { mcpOauthTokens } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { decrypt } from '../utils/encryption';

/**
 * Decrypted OAuth tokens returned to caller
 */
export interface DecryptedTokens {
	access_token: string;
	refresh_token: string | null;
	token_type: string;
	expires_at: Date | null;
	scope: string | null;
	token_id: string; // Added for refresh operations
}

/**
 * Service for retrieving and decrypting OAuth tokens from database
 *
 * This service is used by the satellite to get decrypted tokens when
 * spawning MCP server processes. Tokens are stored encrypted at rest
 * and decrypted only when needed.
 */
export class OAuthTokenRetrievalService {
	private db: AnyDatabase;
	private logger: FastifyBaseLogger;

	constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
		this.db = db;
		this.logger = logger;
	}

	/**
	 * Retrieves and decrypts OAuth tokens for a specific installation+user+team
	 *
	 * @param installationId - MCP server installation ID
	 * @param userId - User ID who owns the tokens
	 * @param teamId - Team ID context
	 * @returns Decrypted tokens or null if not found
	 */
	async getDecryptedTokens(
		installationId: string,
		userId: string,
		teamId: string
	): Promise<DecryptedTokens | null> {
		this.logger.debug(
			{ installationId, userId, teamId, operation: 'get_decrypted_tokens' },
			'Retrieving OAuth tokens from database'
		);

		// Get encrypted tokens from database
		const [tokenRecord] = await this.db
			.select()
			.from(mcpOauthTokens)
			.where(
				and(
					eq(mcpOauthTokens.installation_id, installationId),
					eq(mcpOauthTokens.user_id, userId),
					eq(mcpOauthTokens.team_id, teamId)
				)
			)
			.limit(1);

		if (!tokenRecord) {
			this.logger.debug(
				{ installationId, userId, teamId, operation: 'get_decrypted_tokens' },
				'No OAuth tokens found in database'
			);
			return null;
		}

		try {
			// Decrypt access token
			const decryptedAccessToken = decrypt(tokenRecord.access_token, this.logger);

			// Decrypt refresh token (if present)
			const decryptedRefreshToken = tokenRecord.refresh_token
				? decrypt(tokenRecord.refresh_token, this.logger)
				: null;

			this.logger.debug(
				{
					installationId,
					userId,
					teamId,
					tokenId: tokenRecord.id,
					hasRefreshToken: !!decryptedRefreshToken,
					expiresAt: tokenRecord.expires_at,
					operation: 'get_decrypted_tokens',
				},
				'OAuth tokens decrypted successfully'
			);

			return {
				access_token: decryptedAccessToken,
				refresh_token: decryptedRefreshToken,
				token_type: tokenRecord.token_type,
				expires_at: tokenRecord.expires_at,
				scope: tokenRecord.scope,
				token_id: tokenRecord.id, // Return ID for refresh operations
			};
		} catch (error) {
			this.logger.error(
				{
					error: error instanceof Error ? error.message : 'Unknown error',
					installationId,
					userId,
					teamId,
					operation: 'get_decrypted_tokens',
				},
				'Failed to decrypt OAuth tokens - encryption key may have changed or data corrupted'
			);

			// Don't expose decryption details in error message
			throw new Error('Token decryption failed');
		}
	}

	/**
	 * Check if tokens exist for installation+user+team (without decrypting)
	 *
	 * @param installationId - MCP server installation ID
	 * @param userId - User ID
	 * @param teamId - Team ID
	 * @returns True if tokens exist
	 */
	async hasTokens(installationId: string, userId: string, teamId: string): Promise<boolean> {
		const [tokenRecord] = await this.db
			.select({ id: mcpOauthTokens.id })
			.from(mcpOauthTokens)
			.where(
				and(
					eq(mcpOauthTokens.installation_id, installationId),
					eq(mcpOauthTokens.user_id, userId),
					eq(mcpOauthTokens.team_id, teamId)
				)
			)
			.limit(1);

		return !!tokenRecord;
	}
}
