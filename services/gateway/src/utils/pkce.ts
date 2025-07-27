import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure code verifier for PKCE
 * @returns Base64URL-encoded code verifier
 */
export function generateCodeVerifier(): string {
  const buffer = randomBytes(32);
  return base64URLEncode(buffer);
}

/**
 * Generate a code challenge from a code verifier using SHA256
 * @param codeVerifier The code verifier to hash
 * @returns Base64URL-encoded code challenge
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64URLEncode(hash);
}

/**
 * Generate a cryptographically secure state parameter
 * @returns Random state string
 */
export function generateState(): string {
  const buffer = randomBytes(32);
  return base64URLEncode(buffer);
}

/**
 * Base64URL encode a buffer (RFC 4648 Section 5)
 * @param buffer Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
