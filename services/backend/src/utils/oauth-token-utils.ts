/**
 * OAuth Token Utility Functions
 *
 * Provides utility functions for managing OAuth token lifecycle,
 * including expiration checking and expiry calculation.
 */

/**
 * Checks if an OAuth token is expired or will expire within the buffer window
 *
 * @param expiresAt - Token expiry timestamp (null means non-expiring token)
 * @param bufferSeconds - Seconds before expiry to consider token expired (default: 60)
 * @returns True if token is expired or will expire within buffer window
 *
 * @example
 * ```typescript
 * const token = { expires_at: new Date('2025-01-01T12:00:00Z') };
 *
 * // Check if expired with 60 second buffer (default)
 * if (isTokenExpired(token.expires_at)) {
 *   // Refresh token
 * }
 *
 * // Check if expired with 5 minute buffer
 * if (isTokenExpired(token.expires_at, 300)) {
 *   // Refresh token proactively
 * }
 * ```
 */
export function isTokenExpired(expiresAt: Date | null, bufferSeconds: number = 60): boolean {
	if (!expiresAt) {
		// No expiry means non-expiring token
		return false;
	}

	const now = new Date();
	const expiryWithBuffer = new Date(expiresAt.getTime() - bufferSeconds * 1000);

	return now >= expiryWithBuffer;
}

/**
 * Calculates token expiry date from expires_in seconds
 *
 * @param expiresIn - Seconds until token expires (from token response)
 * @returns Expiry date calculated from current time + expires_in
 *
 * @example
 * ```typescript
 * const tokenResponse = {
 *   access_token: 'eyJhbGci...',
 *   expires_in: 3600 // 1 hour
 * };
 *
 * const expiresAt = calculateTokenExpiry(tokenResponse.expires_in);
 * // expiresAt = Date object representing 1 hour from now
 *
 * // Store in database
 * await db.insert(mcpOauthTokens).values({
 *   access_token: encrypt(tokenResponse.access_token),
 *   expires_at: expiresAt
 * });
 * ```
 */
export function calculateTokenExpiry(expiresIn: number): Date {
	return new Date(Date.now() + expiresIn * 1000);
}
