import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../../utils/pkce';
import { buildAuthConfig } from '../../utils/auth-config';
import { CallbackServer } from './callback-server';
import { BrowserManager } from './browser';
import { detectDeviceInfo } from '../../utils/device-detection';
import {
  AuthenticationResult,
  AuthenticationOptions,
  OAuth2ClientOptions,
  StoredCredentials,
  UserInfo,
  TokenResponse,
  AuthError,
  AuthenticationError
} from '../../types/auth';

export class OAuth2Client {
  private callbackServer: CallbackServer;
  private browserManager: BrowserManager;
  private config: ReturnType<typeof buildAuthConfig>;

  constructor(options: OAuth2ClientOptions = {}) {
    this.callbackServer = new CallbackServer();
    this.browserManager = new BrowserManager();
    this.config = buildAuthConfig(options.baseUrl || 'https://cloud.deploystack.io');
  }

  /**
   * Perform complete OAuth2 authentication flow
   * @param options Authentication options
   * @returns Authentication result with credentials and user info
   */
  async authenticate(options: AuthenticationOptions & { spinner?: ReturnType<typeof ora> } = {}): Promise<AuthenticationResult> {
    const {
      openBrowser = true,
      timeout = 120000,
      spinner
    } = options;

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    console.log(chalk.gray('🔐 Starting OAuth2 authentication flow...'));

    // Start callback server
    const callbackPromise = this.callbackServer.start(this.config.callbackTimeout);

    try {
      // Generate authorization URL
      const authUrl = this.buildAuthorizationUrl({
        codeChallenge,
        state
      });

      console.log(chalk.blue(`🌐 Opening browser to: ${authUrl}`));

      // Open browser
      await this.browserManager.openBrowserWithFallback(authUrl, !openBrowser);

      console.log(chalk.yellow('⏳ Waiting for authentication...'));

      // Wait for callback with timeout
      const callbackResult = await Promise.race([
        callbackPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new AuthenticationError(
            AuthError.TIMEOUT,
            'Authentication timeout - no response received within the specified time'
          )), timeout)
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]) as any;

      if (callbackResult.error) {
        throw new AuthenticationError(
          AuthError.ACCESS_DENIED,
          `Authentication failed: ${callbackResult.error}${callbackResult.error_description ? ` - ${callbackResult.error_description}` : ''}`
        );
      }

      // Verify state parameter
      if (callbackResult.state !== state) {
        throw new AuthenticationError(
          AuthError.INVALID_GRANT,
          'Invalid state parameter - possible CSRF attack'
        );
      }

      if (spinner) {
        spinner.text = 'Processing authorization code...';
      } else {
        console.log(chalk.green('✅ Authorization code received'));
        console.log(chalk.gray('🔄 Exchanging code for tokens...'));
      }

      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForTokens({
        code: callbackResult.code,
        codeVerifier
      }, spinner);

      if (spinner) {
        spinner.text = 'Fetching user information...';
      } else {
        console.log(chalk.green('✅ Tokens received'));
        console.log(chalk.gray('👤 Fetching user information...'));
      }

      // Get user information
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      if (!spinner) {
        console.log(chalk.green('✅ User information retrieved'));
      }

      // Build credentials object
      const credentials: StoredCredentials = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        userEmail: userInfo.email,
        baseUrl: this.config.baseUrl, // Store the backend URL used during login
        accounts: [] // Will be populated from user info if available
      };

      return {
        credentials,
        userInfo
      };

    } finally {
      // Always stop the callback server
      await this.callbackServer.stop();
    }
  }

  /**
   * Build the OAuth2 authorization URL
   * @param params PKCE parameters
   * @returns Authorization URL
   */
  private buildAuthorizationUrl(params: {
    codeChallenge: string;
    state: string;
  }): string {
    const url = new URL(this.config.authUrl);
    
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', this.config.scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return url.toString();
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * @param params Code exchange parameters
   * @param spinner Optional spinner for progress updates
   * @returns Token response
   */
  private async exchangeCodeForTokens(params: {
    code: string;
    codeVerifier: string;
  }, spinner?: ReturnType<typeof ora>): Promise<TokenResponse> {
    try {
      // Detect device information for automatic registration
      const deviceInfo = await detectDeviceInfo();
      
      // Add device_name field required by backend schema
      const deviceInfoWithName = {
        device_name: deviceInfo.hostname, // Use hostname as default device name
        ...deviceInfo
      };
      
      const requestBody = {
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        code_verifier: params.codeVerifier,
        device_info: deviceInfoWithName
      };

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DeployStack-Gateway-CLI/0.2.0'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorData = await response.json().catch(() => ({ error: 'unknown_error' })) as any;
        throw new AuthenticationError(
          AuthError.INVALID_GRANT,
          errorData.error_description || errorData.error || 'Token exchange failed'
        );
      }

      const tokenResponse = await response.json() as TokenResponse;
      
      // Log device registration success if device info is included in response
      if (tokenResponse.device) {
        if (spinner) {
          spinner.text = 'Registering device...';
        } else {
          console.log(chalk.green(`📱 Device registered: ${tokenResponse.device.device_name}`));
        }
      }

      return tokenResponse;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError(
        AuthError.NETWORK_ERROR,
        `Failed to exchange authorization code: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      );
    }
  }

  /**
   * Get user information using access token
   * @param accessToken Access token
   * @returns User information
   */
  private async getUserInfo(accessToken: string): Promise<UserInfo> {
    try {
      const response = await fetch(this.config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'DeployStack-Gateway-CLI/0.2.0'
        }
      });

      if (!response.ok) {
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          'Failed to get user information'
        );
      }

      return await response.json() as UserInfo;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError(
        AuthError.NETWORK_ERROR,
        `Failed to get user information: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      );
    }
  }

  /**
   * Refresh an expired access token
   * @param refreshToken Refresh token
   * @returns New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DeployStack-Gateway-CLI/0.2.0'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId
        })
      });

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorData = await response.json().catch(() => ({ error: 'unknown_error' })) as any;
        throw new AuthenticationError(
          AuthError.INVALID_GRANT,
          errorData.error_description || errorData.error || 'Token refresh failed'
        );
      }

      return await response.json() as TokenResponse;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError(
        AuthError.NETWORK_ERROR,
        `Failed to refresh token: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      );
    }
  }
}
