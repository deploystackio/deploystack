// OAuth2 Shared Schemas
// This file contains reusable JSON Schema constants for OAuth2 endpoints
// Following RFC 6749 OAuth2 specification and Fastify validation patterns

// =============================================================================
// ERROR RESPONSE SCHEMAS
// =============================================================================

/**
 * Standard OAuth2 error response schema (RFC 6749)
 * Used by: authorization.ts, token.ts, userinfo.ts
 */
export const OAUTH2_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      description: 'OAuth2 error code'
    },
    error_description: {
      type: 'string',
      description: 'Human-readable error description'
    }
  },
  required: ['error', 'error_description']
} as const;

/**
 * API-style error response with success field
 * Used by: consent.ts (for consistency with other API endpoints)
 */
export const API_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Always false for errors'
    },
    error: {
      type: 'string',
      description: 'OAuth2 error code'
    },
    error_description: {
      type: 'string',
      description: 'Human-readable error description'
    }
  },
  required: ['success', 'error', 'error_description']
} as const;

// =============================================================================
// COMMON OAUTH2 PARAMETER SCHEMAS
// =============================================================================

/**
 * OAuth2 client identifier schema
 * Used by: authorization.ts, token.ts, consent.ts
 */
export const CLIENT_ID_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'OAuth2 client identifier'
} as const;

/**
 * OAuth2 redirect URI schema
 * Used by: authorization.ts, token.ts
 */
export const REDIRECT_URI_SCHEMA = {
  type: 'string',
  format: 'uri',
  description: 'OAuth2 redirect URI'
} as const;

/**
 * OAuth2 scope parameter schema
 * Used by: authorization.ts, token.ts
 */
export const SCOPE_SCHEMA = {
  type: 'string',
  description: 'Space-separated list of OAuth2 scopes'
} as const;

/**
 * OAuth2 state parameter schema (CSRF protection)
 * Used by: authorization.ts
 */
export const STATE_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'CSRF protection state parameter'
} as const;

/**
 * OAuth2 response type schema
 * Used by: authorization.ts
 */
export const RESPONSE_TYPE_SCHEMA = {
  type: 'string',
  enum: ['code'],
  description: 'OAuth2 response type, must be "code"'
} as const;

// =============================================================================
// PKCE (Proof Key for Code Exchange) SCHEMAS
// =============================================================================

/**
 * PKCE code challenge schema
 * Used by: authorization.ts
 */
export const CODE_CHALLENGE_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'PKCE code challenge'
} as const;

/**
 * PKCE code challenge method schema
 * Used by: authorization.ts
 */
export const CODE_CHALLENGE_METHOD_SCHEMA = {
  type: 'string',
  enum: ['S256'],
  description: 'PKCE code challenge method, must be "S256"'
} as const;

/**
 * PKCE code verifier schema
 * Used by: token.ts
 */
export const CODE_VERIFIER_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'PKCE code verifier'
} as const;

// =============================================================================
// GRANT TYPE SCHEMAS
// =============================================================================

/**
 * Authorization code grant type schema
 * Used by: token.ts
 */
export const AUTHORIZATION_CODE_GRANT_SCHEMA = {
  type: 'string',
  enum: ['authorization_code'],
  description: 'OAuth2 grant type, must be "authorization_code"'
} as const;

/**
 * Refresh token grant type schema
 * Used by: token.ts
 */
export const REFRESH_TOKEN_GRANT_SCHEMA = {
  type: 'string',
  enum: ['refresh_token'],
  description: 'OAuth2 grant type, must be "refresh_token"'
} as const;

// =============================================================================
// TOKEN SCHEMAS
// =============================================================================

/**
 * Authorization code schema
 * Used by: token.ts
 */
export const AUTHORIZATION_CODE_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'Authorization code received from authorization endpoint'
} as const;

/**
 * Refresh token schema
 * Used by: token.ts
 */
export const REFRESH_TOKEN_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'Refresh token to exchange for new access token'
} as const;

/**
 * Access token schema
 * Used by: token.ts (response)
 */
export const ACCESS_TOKEN_SCHEMA = {
  type: 'string',
  description: 'OAuth2 access token'
} as const;

/**
 * Token type schema
 * Used by: token.ts (response)
 */
export const TOKEN_TYPE_SCHEMA = {
  type: 'string',
  enum: ['Bearer'],
  description: 'Token type, always "Bearer"'
} as const;

/**
 * Token expires_in schema
 * Used by: token.ts (response)
 */
export const EXPIRES_IN_SCHEMA = {
  type: 'number',
  description: 'Access token lifetime in seconds'
} as const;

// =============================================================================
// REQUEST ID SCHEMAS
// =============================================================================

/**
 * Authorization request ID schema
 * Used by: consent.ts
 */
export const REQUEST_ID_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: 'Authorization request ID'
} as const;

// =============================================================================
// CONSENT SCHEMAS
// =============================================================================

/**
 * Consent action schema
 * Used by: consent.ts
 */
export const CONSENT_ACTION_SCHEMA = {
  type: 'string',
  enum: ['approve', 'deny'],
  description: 'User consent decision'
} as const;

// =============================================================================
// USERINFO SCHEMAS
// =============================================================================

/**
 * User subject identifier schema
 * Used by: userinfo.ts
 */
export const USER_SUBJECT_SCHEMA = {
  type: 'string',
  description: 'Subject identifier - unique user ID'
} as const;

/**
 * User email schema
 * Used by: userinfo.ts
 */
export const USER_EMAIL_SCHEMA = {
  type: 'string',
  format: 'email',
  description: 'User email address'
} as const;

/**
 * User name schema
 * Used by: userinfo.ts
 */
export const USER_NAME_SCHEMA = {
  type: 'string',
  description: 'Full name of the user'
} as const;

/**
 * Username schema
 * Used by: userinfo.ts
 */
export const USERNAME_SCHEMA = {
  type: 'string',
  description: 'Preferred username'
} as const;

/**
 * Email verified schema
 * Used by: userinfo.ts
 */
export const EMAIL_VERIFIED_SCHEMA = {
  type: 'boolean',
  description: 'Whether the email address has been verified'
} as const;

/**
 * Given name schema
 * Used by: userinfo.ts
 */
export const GIVEN_NAME_SCHEMA = {
  type: 'string',
  description: 'Given name (first name)'
} as const;

/**
 * Family name schema
 * Used by: userinfo.ts
 */
export const FAMILY_NAME_SCHEMA = {
  type: 'string',
  description: 'Family name (last name)'
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

/**
 * Standard OAuth2 error response interface
 */
export interface OAuth2ErrorResponse {
  error: string;
  error_description: string;
}

/**
 * API-style error response interface
 */
export interface ApiErrorResponse {
  success: boolean;
  error: string;
  error_description: string;
}

/**
 * OAuth2 scope interface
 */
export interface OAuth2Scope {
  name: string;
  description: string;
}

/**
 * OAuth2 client information interface
 */
export interface OAuth2Client {
  id: string;
  name: string;
}

// =============================================================================
// OAUTH2 SCOPE DEFINITIONS
// =============================================================================

/**
 * Available OAuth2 scopes with descriptions
 * Used by: consent.ts for scope description mapping
 */
export const OAUTH2_SCOPE_DESCRIPTIONS: Record<string, string> = {
  'mcp:read': 'Access your MCP server installations and configurations',
  'account:read': 'Read your account information',
  'user:read': 'Read your user profile information',
  'teams:read': 'Read your team memberships and team information',
  'offline_access': 'Maintain access when you\'re not actively using the application'
} as const;

/**
 * OAuth2 client name mapping
 * Used by: consent.ts for client display names
 */
export const OAUTH2_CLIENT_NAMES: Record<string, string> = {
  'deploystack-gateway-cli': 'DeployStack Gateway CLI'
} as const;
