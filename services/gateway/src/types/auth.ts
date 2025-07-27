export interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userEmail: string;
  baseUrl: string; // Store the backend URL used during login
  accounts: Array<{
    id: string;
    name: string;
  }>;
}

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  email_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface TokenInfo {
  scopes: string[];
  expiresAt: number;
  clientId: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  role: 'team_admin' | 'team_user';
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamsResponse {
  success: boolean;
  teams: Team[];
}

export interface AuthenticationResult {
  credentials: StoredCredentials;
  userInfo: UserInfo;
}

export interface AuthenticationOptions {
  openBrowser?: boolean;
  timeout?: number;
}

export interface OAuthCallbackResult {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

export interface OAuth2ClientOptions {
  baseUrl?: string;
}

export enum AuthError {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_GRANT = 'INVALID_GRANT',
  ACCESS_DENIED = 'ACCESS_DENIED',
  TIMEOUT = 'TIMEOUT',
  BROWSER_ERROR = 'BROWSER_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN'
}

export class AuthenticationError extends Error {
  constructor(
    public readonly code: AuthError,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
