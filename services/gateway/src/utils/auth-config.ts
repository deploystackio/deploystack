export interface AuthConfig {
  clientId: string;
  baseUrl: string; // Store the base URL
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  teamsUrl: string;
  redirectUri: string;
  scopes: string[];
  callbackTimeout: number;
}

/**
 * Default production authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  clientId: 'deploystack-gateway-cli',
  baseUrl: 'https://cloud.deploystack.io',
  authUrl: 'https://cloud.deploystack.io/api/oauth2/auth',
  tokenUrl: 'https://cloud.deploystack.io/api/oauth2/token',
  userInfoUrl: 'https://cloud.deploystack.io/api/oauth2/userinfo',
  teamsUrl: 'https://cloud.deploystack.io/api/teams/me',
  redirectUri: 'http://localhost:8976/oauth/callback',
  scopes: [
    'mcp:read',
    'mcp:categories:read',
    'mcp:user-configs:read',
    'account:read',
    'user:read',
    'teams:read',
    'gateway:config:read',
    'offline_access'
  ],
  callbackTimeout: 120000 // 2 minutes
};

/**
 * Build authentication configuration for different environments
 * @param baseUrl Base URL for the DeployStack backend
 * @returns AuthConfig object
 */
export function buildAuthConfig(baseUrl: string): AuthConfig {
  return {
    ...DEFAULT_AUTH_CONFIG,
    baseUrl: baseUrl, // Store the base URL
    authUrl: `${baseUrl}/api/oauth2/auth`,
    tokenUrl: `${baseUrl}/api/oauth2/token`,
    userInfoUrl: `${baseUrl}/api/oauth2/userinfo`,
    teamsUrl: `${baseUrl}/api/teams/me`
  };
}

/**
 * OAuth2 scope descriptions for user display
 */
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'mcp:read': 'Access your MCP server installations and configurations',
  'mcp:categories:read': 'Read MCP server categories and organization',
  'mcp:user-configs:read': 'Access your personal MCP server configurations and device-specific settings',
  'account:read': 'Read your account information',
  'user:read': 'Read your user profile information',
  'teams:read': 'Read your team memberships and information',
  'gateway:config:read': 'Generate client-specific gateway configuration files',
  'offline_access': 'Maintain access when not actively using the application'
};
