import { FastifyBaseLogger } from 'fastify';
import { platform, arch, totalmem } from 'os';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';

export interface BackendConnectionStatus {
  backend_url: string;
  connection_status: 'connected' | 'disconnected' | 'error';
  last_check: string;
  response_time_ms?: number;
  error_message?: string;
}

export interface SatelliteRegistrationData {
  name: string;
  capabilities: string[];
  system_info: {
    os: string;
    arch: string;
    node_version: string;
    memory_mb: number;
  };
}

export interface SatelliteRegistrationResult {
  success: boolean;
  satellite?: {
    id: string;
    name: string;
    api_key: string;
  };
  message?: string;
  error?: string;
}

export interface HeartbeatPayload {
  status: 'active' | 'degraded' | 'error';
  system_metrics: {
    cpu_usage_percent: number;
    memory_usage_mb: number;
    disk_usage_percent: number;
    uptime_seconds: number;
  };
  processes: Array<{
    id: string;
    server_name: string;
    status: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
    health_status: 'healthy' | 'unhealthy' | 'unknown';
    performance_metrics?: {
      total_requests: number;
      avg_response_time_ms: number;
    };
  }>;
  error_count: number;
  version: string;
}

export interface HeartbeatResult {
  success: boolean;
  response_time_ms?: number;
  error?: string;
}

export interface PersistedSatelliteData {
  api_key: string | null;
  satellite_id: string | null;
  satellite_name: string | null;
  registered_at: string | null;
  last_verified: string | null;
}

export class BackendClient {
  private backendUrl: string;
  private logger: FastifyBaseLogger;
  private lastConnectionStatus: BackendConnectionStatus;
  private apiKey?: string;
  private persistentDataPath: string;
  private keyFilePath: string;

  constructor(backendUrl: string, logger: FastifyBaseLogger) {
    this.backendUrl = backendUrl;
    this.logger = logger;
    this.persistentDataPath = join(process.cwd(), 'persistent_data');
    this.keyFilePath = join(this.persistentDataPath, 'backend.key.json');
    this.lastConnectionStatus = {
      backend_url: backendUrl,
      connection_status: 'disconnected',
      last_check: new Date().toISOString()
    };
  }

  /**
   * Set API key for authenticated requests
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.logger.debug({
      operation: 'api_key_set'
    }, 'API key configured for authenticated backend communication');
  }

  /**
   * Get API key for authenticated requests
   */
  getApiKey(): string {
    return this.apiKey || '';
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Test connection to backend by making a simple health check request
   */
  async testConnection(): Promise<BackendConnectionStatus> {
    const startTime = Date.now();
    
    try {
      this.logger.debug({
        operation: 'backend_connection_test',
        backend_url: this.backendUrl
      }, 'Testing backend connection');

      // Try to connect to backend health endpoint
      const response = await fetch(`${this.backendUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // 5 second timeout
        signal: AbortSignal.timeout(5000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        this.lastConnectionStatus = {
          backend_url: this.backendUrl,
          connection_status: 'connected',
          last_check: new Date().toISOString(),
          response_time_ms: responseTime
        };

        this.logger.info({
          operation: 'backend_connection_success',
          backend_url: this.backendUrl,
          response_time_ms: responseTime,
          status_code: response.status
        }, 'Backend connection successful');

      } else {
        this.lastConnectionStatus = {
          backend_url: this.backendUrl,
          connection_status: 'error',
          last_check: new Date().toISOString(),
          response_time_ms: responseTime,
          error_message: `HTTP ${response.status}: ${response.statusText}`
        };

        this.logger.warn({
          operation: 'backend_connection_error',
          backend_url: this.backendUrl,
          status_code: response.status,
          status_text: response.statusText
        }, 'Backend connection failed with HTTP error');
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.lastConnectionStatus = {
        backend_url: this.backendUrl,
        connection_status: 'error',
        last_check: new Date().toISOString(),
        response_time_ms: responseTime,
        error_message: errorMessage
      };

      this.logger.error({
        operation: 'backend_connection_failed',
        backend_url: this.backendUrl,
        error: errorMessage,
        response_time_ms: responseTime
      }, 'Backend connection failed');
    }

    return this.lastConnectionStatus;
  }

  /**
   * Get the last known connection status without making a new request
   */
  getLastConnectionStatus(): BackendConnectionStatus {
    return { ...this.lastConnectionStatus };
  }

  /**
   * Register satellite with backend using registration token
   */
  async registerSatellite(registrationData: SatelliteRegistrationData, registrationToken: string): Promise<SatelliteRegistrationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info({
        operation: 'satellite_registration',
        backend_url: this.backendUrl,
        satellite_name: registrationData.name
      }, 'Registering satellite with backend');

      const response = await fetch(`${this.backendUrl}/api/satellites/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${registrationToken}`
        },
        body: JSON.stringify(registrationData),
        // 10 second timeout for registration
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok) {
        const result = JSON.parse(responseText) as SatelliteRegistrationResult;
        
        this.logger.info({
          operation: 'satellite_registration_success',
          backend_url: this.backendUrl,
          satellite_id: result.satellite?.id,
          satellite_name: registrationData.name,
          response_time_ms: responseTime
        }, 'Satellite registered successfully');

        return result;
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;
        
        try {
          const errorResult = JSON.parse(responseText);
          if (errorResult.error) {
            errorCode = errorResult.error;
            errorMessage = errorResult.error;
          }
        } catch {
          // Use HTTP status if JSON parsing fails
        }

        // Handle specific token-related errors with helpful English messages
        if (errorCode === 'registration_token_required') {
          errorMessage = 'Registration token missing. Please set DEPLOYSTACK_REGISTRATION_TOKEN environment variable with a valid token from the DeployStack Backend Admin Interface.';
        } else if (errorCode === 'invalid_registration_token') {
          errorMessage = 'Invalid registration token format. Please check the token format and generate a new token if needed from the DeployStack Backend Admin Interface.';
        } else if (errorCode === 'token_expired') {
          errorMessage = 'Registration token has expired. Please generate a new registration token from the DeployStack Backend Admin Interface. Global tokens are valid for 1 hour, team tokens for 24 hours.';
        } else if (errorCode === 'token_already_used') {
          errorMessage = 'Registration token has already been used. Tokens can only be used once. Please generate a new registration token from the DeployStack Backend Admin Interface.';
        } else if (errorCode === 'token_invalid_scope') {
          errorMessage = 'Registration token has invalid scope. Please use the correct token for Global or Team Satellites from the DeployStack Backend Admin Interface.';
        }

        this.logger.error({
          operation: 'satellite_registration_error',
          backend_url: this.backendUrl,
          satellite_name: registrationData.name,
          status_code: response.status,
          error_code: errorCode,
          error_message: errorMessage,
          response_time_ms: responseTime
        }, 'Satellite registration failed');

        return {
          success: false,
          error: errorMessage
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error({
        operation: 'satellite_registration_failed',
        backend_url: this.backendUrl,
        satellite_name: registrationData.name,
        error: errorMessage,
        response_time_ms: responseTime
      }, 'Satellite registration failed with exception');

      return {
        success: false,
        error: `Registration failed: ${errorMessage}`
      };
    }
  }

  /**
   * Generate satellite registration data with system information
   */
  generateRegistrationData(name?: string): SatelliteRegistrationData {
    // Use the provided name (mandatory from environment variable)
    if (!name) {
      throw new Error('Satellite name is required - must be provided via DEPLOYSTACK_SATELLITE_NAME environment variable');
    }
    const satelliteName = name;
    
    // Collect system information
    const systemInfo = {
      os: `${platform()} ${process.platform}`,
      arch: arch(),
      node_version: process.version,
      memory_mb: Math.round(totalmem() / 1024 / 1024)
    };

    // Define supported MCP server capabilities
    const capabilities = [
      'stdio', // stdio MCP servers
      'http',  // HTTP MCP servers (future)
      'sse'    // SSE MCP servers (future)
    ];

    return {
      name: satelliteName,
      capabilities,
      system_info: systemInfo
    };
  }

  /**
   * Send heartbeat to backend
   */
  async sendHeartbeat(satelliteId: string, payload: HeartbeatPayload): Promise<HeartbeatResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug({
        operation: 'heartbeat_send',
        backend_url: this.backendUrl,
        satellite_id: satelliteId,
        has_api_key: !!this.apiKey
      }, 'Sending heartbeat to backend');

      const response = await fetch(`${this.backendUrl}/api/satellites/${satelliteId}/heartbeat`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
        // 10 second timeout for heartbeat
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok) {
        this.logger.debug({
          operation: 'heartbeat_send_success',
          backend_url: this.backendUrl,
          satellite_id: satelliteId,
          response_time_ms: responseTime,
          status_code: response.status
        }, 'Heartbeat sent successfully');

        return {
          success: true,
          response_time_ms: responseTime
        };
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorResult = JSON.parse(responseText);
          if (errorResult.error) {
            errorMessage = errorResult.error;
          }
        } catch {
          // Use HTTP status if JSON parsing fails
        }

        this.logger.warn({
          operation: 'heartbeat_send_error',
          backend_url: this.backendUrl,
          satellite_id: satelliteId,
          status_code: response.status,
          error_message: errorMessage,
          response_time_ms: responseTime
        }, 'Heartbeat failed with HTTP error');

        return {
          success: false,
          response_time_ms: responseTime,
          error: errorMessage
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error({
        operation: 'heartbeat_send_failed',
        backend_url: this.backendUrl,
        satellite_id: satelliteId,
        error: errorMessage,
        response_time_ms: responseTime
      }, 'Heartbeat failed with exception');

      return {
        success: false,
        response_time_ms: responseTime,
        error: `Heartbeat failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get backend URL
   */
  getBackendUrl(): string {
    return this.backendUrl;
  }

  /**
   * Load persisted satellite data from file
   */
  async loadPersistedData(): Promise<PersistedSatelliteData | null> {
    try {
      await access(this.keyFilePath);
      const fileContent = await readFile(this.keyFilePath, 'utf-8');
      const data = JSON.parse(fileContent) as PersistedSatelliteData;
      
      this.logger.info({
        operation: 'persistent_data_loaded',
        file_path: this.keyFilePath,
        has_api_key: !!data.api_key,
        satellite_id: data.satellite_id,
        satellite_name: data.satellite_name
      }, 'Persistent satellite data loaded from file');
      
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.info({
          operation: 'persistent_data_not_found',
          file_path: this.keyFilePath
        }, 'No persistent satellite data found - will proceed with registration');
      } else {
        this.logger.warn({
          operation: 'persistent_data_load_error',
          file_path: this.keyFilePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Failed to load persistent satellite data - will proceed with registration');
      }
      return null;
    }
  }

  /**
   * Save satellite data to persistent storage
   */
  async savePersistedData(data: PersistedSatelliteData): Promise<void> {
    try {
      const fileContent = JSON.stringify(data, null, 2);
      await writeFile(this.keyFilePath, fileContent, 'utf-8');
      
      this.logger.info({
        operation: 'persistent_data_saved',
        file_path: this.keyFilePath,
        satellite_id: data.satellite_id,
        satellite_name: data.satellite_name
      }, 'Satellite data saved to persistent storage');
      
    } catch (error) {
      this.logger.error({
        operation: 'persistent_data_save_error',
        file_path: this.keyFilePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to save satellite data to persistent storage');
      throw error;
    }
  }

  /**
   * Update last verified timestamp in persistent storage
   */
  async updateLastVerified(): Promise<void> {
    try {
      const existingData = await this.loadPersistedData();
      if (existingData && existingData.api_key) {
        existingData.last_verified = new Date().toISOString();
        await this.savePersistedData(existingData);
      }
    } catch (error) {
      this.logger.warn({
        operation: 'last_verified_update_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update last verified timestamp');
    }
  }

  /**
   * Clear persistent storage (force re-registration)
   */
  async clearPersistedData(): Promise<void> {
    try {
      const emptyData: PersistedSatelliteData = {
        api_key: null,
        satellite_id: null,
        satellite_name: null,
        registered_at: null,
        last_verified: null
      };
      await this.savePersistedData(emptyData);
      
      this.logger.info({
        operation: 'persistent_data_cleared',
        file_path: this.keyFilePath
      }, 'Persistent satellite data cleared - will require re-registration');
      
    } catch (error) {
      this.logger.error({
        operation: 'persistent_data_clear_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to clear persistent storage');
      throw error;
    }
  }
}
