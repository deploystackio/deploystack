/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from 'node-fetch';
import { StoredCredentials, UserInfo, TokenInfo, Team, AuthError, AuthenticationError } from '../../types/auth';
import { buildAuthConfig } from '../../utils/auth-config';
import { Device, DeviceInfo } from '../../types/device-cache';

export class DeployStackAPI {
  private credentials: StoredCredentials;
  private baseUrl: string;

  constructor(credentials: StoredCredentials, baseUrl: string = 'https://cloud.deploystack.io') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
  }

  /**
   * Get authenticated user information from the backend API
   * Makes a real-time API call to /api/oauth2/userinfo to verify token validity
   * and retrieve fresh user information including sub, email, name, etc.
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
   * Get user's teams from the backend API
   * Makes a real-time API call to /api/teams/me to fetch current team memberships
   * @returns Array of teams with user's role and ownership status
   */
  async getUserTeams(): Promise<Team[]> {
    const config = buildAuthConfig(this.baseUrl);
    const response = await this.makeRequest(config.teamsUrl);
    
    // Check if response has the expected structure
    if (!response) {
      return [];
    }
    
    // The API returns teams in response.data, not response.teams
    const teams = response.data || response.teams || [];
    
    if (!Array.isArray(teams)) {
      return [];
    }
    
    return teams;
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
   * Get merged MCP configurations for gateway (NEW THREE-TIER ENDPOINT)
   * This endpoint merges Template + Team + User configurations and returns ready-to-use server configs
   * @param deviceId Device ID for device-specific user configurations
   * @returns Gateway MCP configurations response
   */
  async getGatewayMCPConfigurations(hardwareId: string): Promise<{
    success: boolean;
    data: {
      servers: Array<{
        id: string;
        name: string;
        command: string;
        args: string[];
        env: Record<string, string>;
        status: 'ready' | 'invalid';
      }>;
    };
  }> {
    const endpoint = `${this.baseUrl}/api/gateway/me/mcp-configurations?hardware_id=${encodeURIComponent(hardwareId)}`;
    const response = await this.makeRequest(endpoint);
    return response;
  }

  /**
   * Get device by hardware ID
   * @param hardwareId Hardware fingerprint
   * @returns Device if found, null otherwise
   */
  async getDeviceByHardwareId(hardwareId: string): Promise<Device | null> {
    try {
      const endpoint = `${this.baseUrl}/api/users/me/devices`;
      const response = await this.makeRequest(endpoint);
      
      if (response.success && response.devices) {
        const device = response.devices.find((d: Device) => d.hardware_id === hardwareId);
        return device || null;
      }
      
      return null;
    } catch {
      // If we get a 404 or other error, assume no device found
      return null;
    }
  }

  /**
   * Create a new device
   * @param deviceInfo Device information
   * @returns Created device
   */
  async createDevice(deviceInfo: DeviceInfo): Promise<Device> {
    const endpoint = `${this.baseUrl}/api/users/me/devices`;
    const deviceData = {
      device_name: deviceInfo.hostname, // Default to hostname
      hostname: deviceInfo.hostname,
      hardware_id: deviceInfo.hardware_id,
      os_type: deviceInfo.os_type,
      os_version: deviceInfo.os_version,
      arch: deviceInfo.arch,
      node_version: deviceInfo.node_version,
      user_agent: deviceInfo.user_agent,
      last_login_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    };

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(deviceData)
    });

    if (response.success && response.device) {
      return response.device;
    }

    throw new AuthenticationError(
      AuthError.NETWORK_ERROR,
      'Failed to create device'
    );
  }

  /**
   * Update an existing device
   * @param deviceId Device ID
   * @param updates Device updates
   * @returns Updated device
   */
  async updateDevice(deviceId: string, updates: { device_name?: string }): Promise<Device> {
    const endpoint = `${this.baseUrl}/api/users/me/devices/${deviceId}`;
    
    // The backend only accepts device_name updates via PUT
    const updateData = {
      device_name: updates.device_name || 'Updated Device'
    };

    const response = await this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (response.success && response.device) {
      return response.device;
    }

    throw new AuthenticationError(
      AuthError.NETWORK_ERROR,
      'Failed to update device'
    );
  }
  /**
   * Update device activity (internal method)
   * This would be called during login to update last_login_at
   * For now, we'll just update the device name to trigger an update
   * @param deviceId Device ID
   * @returns Updated device
   */
  async updateDeviceActivity(deviceId: string): Promise<Device> {
    // Since the backend only supports device_name updates,
    // we'll just update with the current name to trigger last update timestamp
    const endpoint = `${this.baseUrl}/api/users/me/devices/${deviceId}`;
    
    // Get current device first to preserve the name
    const currentDevice = await this.getDeviceById(deviceId);
    
    const updateData = {
      device_name: currentDevice.device_name
    };

    const response = await this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (response.success && response.device) {
      return response.device;
    }

    throw new AuthenticationError(
      AuthError.NETWORK_ERROR,
      'Failed to update device activity'
    );
  }

  /**
   * Get device by ID
   * @param deviceId Device ID
   * @returns Device
   */
  async getDeviceById(deviceId: string): Promise<Device> {
    const endpoint = `${this.baseUrl}/api/users/me/devices/${deviceId}`;
    const response = await this.makeRequest(endpoint);
    
    if (response.success && response.device) {
      return response.device;
    }

    throw new AuthenticationError(
      AuthError.NETWORK_ERROR,
      'Device not found'
    );
  }

  /**
   * Register or update a device (convenience method)
   * @param deviceInfo Device information
   * @returns Device (created or updated)
   */
  async registerOrUpdateDevice(deviceInfo: DeviceInfo): Promise<Device> {
    // First, try to find existing device by hardware ID
    const existingDevice = await this.getDeviceByHardwareId(deviceInfo.hardware_id);
    
    if (existingDevice) {
      // Update existing device activity (this will update the timestamp)
      return await this.updateDeviceActivity(existingDevice.id);
    } else {
      // Create new device
      return await this.createDevice(deviceInfo);
    }
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
      let responseData;
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      return responseData;
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
    } catch {
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
