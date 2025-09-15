import { FastifyBaseLogger } from 'fastify';
import { platform, arch, totalmem } from 'os';

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

export class BackendClient {
  private backendUrl: string;
  private logger: FastifyBaseLogger;
  private lastConnectionStatus: BackendConnectionStatus;
  private apiKey?: string;

  constructor(backendUrl: string, logger: FastifyBaseLogger) {
    this.backendUrl = backendUrl;
    this.logger = logger;
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
   * Register satellite with backend
   */
  async registerSatellite(registrationData: SatelliteRegistrationData): Promise<SatelliteRegistrationResult> {
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
          'Content-Type': 'application/json'
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
        
        try {
          const errorResult = JSON.parse(responseText);
          if (errorResult.error) {
            errorMessage = errorResult.error;
          }
        } catch {
          // Use HTTP status if JSON parsing fails
        }

        this.logger.error({
          operation: 'satellite_registration_error',
          backend_url: this.backendUrl,
          satellite_name: registrationData.name,
          status_code: response.status,
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
}
