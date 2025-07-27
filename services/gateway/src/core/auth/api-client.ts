import fetch from 'node-fetch';
import { StoredCredentials, UserInfo, TokenInfo, Team, TeamsResponse, AuthError, AuthenticationError } from '../../types/auth';
import { buildAuthConfig } from '../../utils/auth-config';

export class DeployStackAPI {
  private credentials: StoredCredentials;
  private baseUrl: string;

  constructor(credentials: StoredCredentials, baseUrl: string = 'https://cloud.deploystack.io') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
  }

  /**
   * Get authenticated user information
   * @returns User information
   */
  async getUserInfo(): Promise<UserInfo> {
    const config = buildAuthConfig(this.baseUrl);
    const response = await this.makeRequest(config.userInfoUrl);
    return response as UserInfo;
  }

  /**
   * Get token information and scopes
   * @returns Token information
   */
  async getTokenInfo(): Promise<TokenInfo> {
    // For now, return the scopes from our configuration
    // In a real implementation, this might call a token introspection endpoint
    const config = buildAuthConfig(this.baseUrl);
    return {
      scopes: config.scopes,
      expiresAt: this.credentials.expiresAt,
      clientId: config.clientId
    };
  }

  /**
   * Get user's teams
   * @returns Array of teams
   */
  async getUserTeams(): Promise<Team[]> {
    const config = buildAuthConfig(this.baseUrl);
    const response = await this.makeRequest(config.teamsUrl) as TeamsResponse;
    return response.teams;
  }

  /**
   * Get details for a specific team
   * @param teamId Team ID
   * @returns Team details
   */
  async getTeamDetails(teamId: string): Promise<Team> {
    const config = buildAuthConfig(this.baseUrl);
    const response = await this.makeRequest(`${config.teamsUrl}/${teamId}`);
    return (response as { team: Team }).team;
  }

  /**
   * Make an authenticated API request
   * @param endpoint API endpoint URL
   * @param options Request options
   * @returns Response data
   */
  private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DeployStack-Gateway-CLI/0.2.0',
          ...options.headers
        }
      });

      if (!response.ok) {
        await this.handleErrorResponse(response as any);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError(
        AuthError.NETWORK_ERROR,
        `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      );
    }
  }

  /**
   * Handle error responses from the API
   * @param response Failed response
   */
  private async handleErrorResponse(response: any): Promise<never> {
    let errorData: any = {};
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { error: await response.text() };
      }
    } catch (parseError) {
      errorData = { error: 'Unknown error' };
    }

    switch (response.status) {
      case 401:
        throw new AuthenticationError(
          AuthError.TOKEN_EXPIRED,
          'Authentication expired. Please run "deploystack login" again.'
        );
      
      case 403:
        throw new AuthenticationError(
          AuthError.INVALID_TOKEN,
          'Access denied. Your token may not have the required permissions.'
        );
      
      case 404:
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          'Resource not found. The API endpoint may have changed.'
        );
      
      case 429:
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          'Rate limit exceeded. Please try again later.'
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          'Server error. Please try again later.'
        );
      
      default:
        const message = errorData.error_description || errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          message
        );
    }
  }

  /**
   * Check if the current token is still valid
   * @returns true if token is valid
   */
  isTokenValid(): boolean {
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minutes buffer
    return this.credentials.expiresAt > (now + buffer);
  }

  /**
   * Get the user's email from stored credentials
   * @returns User email
   */
  getUserEmail(): string {
    return this.credentials.userEmail;
  }

  /**
   * Get the user's accounts from stored credentials
   * @returns User accounts
   */
  getUserAccounts(): Array<{ id: string; name: string }> {
    return this.credentials.accounts || [];
  }
}
