import { createHash, randomBytes } from 'crypto';

/**
 * PKCE pair with code verifier, challenge, and method
 */
export interface PKCEPair {
  code_verifier: string;
  code_challenge: string;
  code_challenge_method: 'S256';
}

/**
 * Base64URL encodes a buffer (RFC 4648 §5)
 *
 * Base64URL is like Base64 but:
 * - Uses '-' instead of '+'
 * - Uses '_' instead of '/'
 * - No padding ('=')
 *
 * @param buffer - Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates a cryptographically secure PKCE code_verifier
 *
 * Requirements (RFC 7636):
 * - 43-128 characters long
 * - Uses unreserved characters: [A-Z] [a-z] [0-9] - . _ ~
 *
 * @returns Base64URL-encoded random string (43 characters)
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (256 bits)
  const buffer = randomBytes(32);

  // Base64URL encode (no padding)
  // 32 bytes → 43 characters in base64url
  return base64URLEncode(buffer);
}

/**
 * Generates SHA-256 code_challenge from code_verifier
 *
 * @param codeVerifier - PKCE code verifier
 * @returns Base64URL-encoded SHA-256 hash
 */
export function generateCodeChallenge(codeVerifier: string): string {
  // SHA-256 hash the verifier
  const hash = createHash('sha256')
    .update(codeVerifier)
    .digest();

  // Base64URL encode the hash
  return base64URLEncode(hash);
}

/**
 * Generates a complete PKCE pair (verifier + challenge)
 *
 * @returns PKCE pair with S256 challenge method
 */
export function generatePKCEPair(): PKCEPair {
  const code_verifier = generateCodeVerifier();
  const code_challenge = generateCodeChallenge(code_verifier);

  return {
    code_verifier,
    code_challenge,
    code_challenge_method: 'S256'
  };
}

/**
 * Validates a code_verifier string
 *
 * @param verifier - Code verifier to validate
 * @returns True if valid, false otherwise
 */
export function validateCodeVerifier(verifier: string): boolean {
  // Must be 43-128 characters
  if (verifier.length < 43 || verifier.length > 128) {
    return false;
  }

  // Must only contain unreserved characters
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(verifier);
}

/**
 * Generates a cryptographically secure OAuth state parameter
 *
 * State parameter is used for CSRF protection
 *
 * @returns Base64URL-encoded random string (32 characters)
 */
export function generateState(): string {
  // Generate 24 random bytes (192 bits)
  const buffer = randomBytes(24);

  // Base64URL encode → 32 characters
  return base64URLEncode(buffer);
}

/**
 * Validates a state parameter
 *
 * @param state - State parameter to validate
 * @returns True if valid, false otherwise
 */
export function validateState(state: string): boolean {
  // Must be at least 16 characters for security
  if (state.length < 16) {
    return false;
  }

  // Must only contain URL-safe characters
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(state);
}

/**
 * Generates OAuth resource parameter for token audience binding (RFC 8707)
 *
 * The resource parameter ensures tokens are bound to a specific MCP server
 *
 * @param mcpServerId - MCP server ID from catalog
 * @param teamId - Team ID
 * @returns Resource URI for this specific MCP server installation
 */
export function generateResourceParameter(mcpServerId: string, teamId: string): string {
  // Format: urn:deploystack:mcp:{teamId}:{serverId}
  return `urn:deploystack:mcp:${teamId}:${mcpServerId}`;
}

/**
 * Parses a resource parameter back into components
 *
 * @param resource - Resource URI
 * @returns Parsed components or null if invalid
 */
export function parseResourceParameter(resource: string): { teamId: string; mcpServerId: string } | null {
  const pattern = /^urn:deploystack:mcp:([^:]+):([^:]+)$/;
  const match = resource.match(pattern);

  if (!match) {
    return null;
  }

  return {
    teamId: match[1],
    mcpServerId: match[2]
  };
}
