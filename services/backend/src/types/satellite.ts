// TypeScript types for Satellite Token Management System
// Based on the database schema defined in schema.sqlite.ts

export type TokenType = 'global' | 'team';

export interface SatelliteRegistrationToken {
  id: string;
  token_type: TokenType;
  team_id: string | null;
  token_hash: string;
  token_prefix: string;
  created_by: string;
  permissions: string[];
  used: boolean;
  used_at: string | null;
  used_by_satellite_id: string | null;
  expires_at: string;
  created_at: string;
}

export interface TokenGenerationRequest {
  expires_in_hours?: number;
}

export interface TokenGenerationResponse {
  success: boolean;
  token: string;
  expires_at: string;
  scope: TokenType;
  team_id?: string;
  team_slug?: string;
  instructions: string;
}

export interface TokenValidationResult {
  valid: boolean;
  tokenRecord?: SatelliteRegistrationToken;
  error?: string;
}

export interface JWTPayload {
  iss: string; // Issuer: 'deploystack.io'
  aud: string; // Audience: 'satellite-registration'
  exp: number; // Expiration time
  iat: number; // Issued at
  jti: string; // JWT ID
  scope: TokenType; // 'global' or 'team'
  team_id?: string; // Present for team tokens
  created_by: string; // User who created the token
  permissions: string[]; // Array of permissions
}

export interface TokenListResponse {
  tokens: Array<{
    id: string;
    token_type: TokenType;
    team_id: string | null;
    created_by: string;
    expires_at: string;
    created_at: string;
    used: boolean;
  }>;
}

export interface TokenRevokeResponse {
  success: boolean;
  error?: string;
}
