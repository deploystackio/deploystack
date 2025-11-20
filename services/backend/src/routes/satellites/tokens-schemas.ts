/**
 * Shared schemas for satellite OAuth token endpoints
 *
 * These schemas are used by both the token retrieval and token status endpoints
 * to ensure consistent validation and response structures.
 */

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Request schema for token retrieval endpoint
 * Requires installation ID, user ID, and team ID to identify the tokens
 */
export const RETRIEVE_TOKENS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    installation_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server installation ID'
    },
    user_id: {
      type: 'string',
      minLength: 1,
      description: 'User ID who owns the tokens'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID for team isolation'
    }
  },
  required: ['installation_id', 'user_id', 'team_id'],
  additionalProperties: false
} as const;

/**
 * Request schema for token status endpoint
 * Same as retrieval but used to check token status without decryption
 */
export const TOKEN_STATUS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    installation_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server installation ID'
    },
    user_id: {
      type: 'string',
      minLength: 1,
      description: 'User ID who owns the tokens'
    },
    team_id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID for team isolation'
    }
  },
  required: ['installation_id', 'user_id', 'team_id'],
  additionalProperties: false
} as const;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Success response schema for token retrieval
 * Returns decrypted OAuth tokens
 */
export const RETRIEVE_TOKENS_SUCCESS_SCHEMA = {
  type: 'object',
  properties: {
    access_token: {
      type: 'string',
      description: 'Decrypted OAuth access token'
    },
    refresh_token: {
      type: ['string', 'null'],
      description: 'Decrypted OAuth refresh token (null if not available)'
    },
    token_type: {
      type: 'string',
      description: 'Token type (usually "Bearer")'
    },
    expires_at: {
      type: ['string', 'null'],
      format: 'date-time',
      description: 'Token expiration timestamp (ISO 8601 format)'
    },
    scope: {
      type: ['string', 'null'],
      description: 'OAuth scopes granted to the token'
    }
  },
  required: ['access_token', 'token_type']
} as const;

/**
 * Success response schema for token status check
 * Returns token metadata without decryption
 */
export const TOKEN_STATUS_SUCCESS_SCHEMA = {
  type: 'object',
  properties: {
    exists: {
      type: 'boolean',
      description: 'Whether tokens exist for this installation'
    },
    expired: {
      type: ['boolean', 'null'],
      description: 'Whether the token is expired (null if no expiration time)'
    },
    expires_at: {
      type: ['string', 'null'],
      format: 'date-time',
      description: 'Token expiration timestamp (ISO 8601 format)'
    },
    can_refresh: {
      type: 'boolean',
      description: 'Whether the token can be refreshed (has refresh_token)'
    }
  },
  required: ['exists', 'can_refresh']
} as const;

/**
 * Error response schema
 * Used for all error responses (403, 404, 500)
 */
export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates failure'
    },
    error: {
      type: 'string',
      description: 'Error message describing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Request body interface for token retrieval
 */
export interface RetrieveTokensRequest {
  installation_id: string;
  user_id: string;
  team_id: string;
}

/**
 * Request body interface for token status
 */
export interface TokenStatusRequest {
  installation_id: string;
  user_id: string;
  team_id: string;
}

/**
 * Success response interface for token retrieval
 */
export interface RetrieveTokensSuccess {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scope: string | null;
}

/**
 * Success response interface for token status
 */
export interface TokenStatusSuccess {
  exists: boolean;
  expired: boolean | null;
  expires_at: string | null;
  can_refresh: boolean;
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: boolean;
  error: string;
}
