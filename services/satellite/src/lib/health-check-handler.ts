import { FastifyBaseLogger } from 'fastify';
import { SatelliteCommand, CommandResult } from '../services/command-polling-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';

export interface ProcessInfo {
  id: string;
  server_name: string;
  status: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  performance_metrics?: {
    total_requests: number;
    avg_response_time_ms: number;
  };
}

export interface HealthCheckResult {
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  response_time_ms?: number;
  error?: string;
}

export interface HealthCheckHandlerDependencies {
  logger: FastifyBaseLogger;
  configManager: DynamicConfigManager;
  getProcesses: () => Map<string, ProcessInfo>;
  updateProcessHealth: (processId: string, healthStatus: 'healthy' | 'unhealthy' | 'unknown') => void;
  handleCredentialValidation: (command: SatelliteCommand) => Promise<CommandResult>;
}

/**
 * Handles health check operations for HTTP/SSE MCP servers
 *
 * Responsibilities:
 * - Perform health checks on running server processes
 * - Validate server connectivity via tools/list endpoint
 * - Update process health status
 * - Route credential validation requests
 */
export class HealthCheckHandler {
  constructor(private deps: HealthCheckHandlerDependencies) {}

  /**
   * Check health of a specific HTTP MCP server
   */
  async checkServerHealth(processInfo: ProcessInfo): Promise<HealthCheckResult> {
    const serverConfig = this.deps.configManager.getMcpServerConfig(processInfo.server_name);
    if (!serverConfig) {
      return {
        health_status: 'unknown',
        error: 'Server configuration not found'
      };
    }

    const startTime = Date.now();

    try {
      // Validate URL for HTTP/SSE transport
      if (!serverConfig.url) {
        return {
          health_status: 'unknown',
          error: 'No URL configured for health check'
        };
      }

      // Perform a simple health check by sending a tools/list request
      const response = await fetch(serverConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...serverConfig.headers
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'health-check',
          method: 'tools/list',
          params: {}
        }),
        signal: AbortSignal.timeout(serverConfig.timeout || 10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          health_status: 'healthy',
          response_time_ms: responseTime
        };
      } else {
        return {
          health_status: 'unhealthy',
          response_time_ms: responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        health_status: 'unhealthy',
        response_time_ms: responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Handle health check command for all running processes
   */
  async handleHealthCheck(command: SatelliteCommand): Promise<CommandResult> {
    const payload = command.payload;

    // Check if this is a credential validation request
    if (payload.check_type === 'credential_validation' && payload.installation_id) {
      return await this.deps.handleCredentialValidation(command);
    }

    // Default: General health check
    this.deps.logger.debug({
      operation: 'command_health_check',
      command_id: command.id
    }, 'Processing health check command');

    const healthResults: Array<{
      server_name: string;
      process_id: string;
      status: string;
      health_status: string;
      response_time_ms?: number;
      error?: string;
    }> = [];

    // Check health of all running processes
    const processes = this.deps.getProcesses();
    for (const [processId, processInfo] of processes.entries()) {
      if (processInfo.status === 'running') {
        const healthResult = await this.checkServerHealth(processInfo);
        healthResults.push({
          server_name: processInfo.server_name,
          process_id: processId,
          status: processInfo.status,
          health_status: healthResult.health_status,
          response_time_ms: healthResult.response_time_ms,
          error: healthResult.error
        });

        // Update process health status
        this.deps.updateProcessHealth(processId, healthResult.health_status);
      }
    }

    this.deps.logger.info({
      operation: 'health_check_completed',
      command_id: command.id,
      servers_checked: healthResults.length,
      healthy_servers: healthResults.filter(r => r.health_status === 'healthy').length
    }, `Health check completed: ${healthResults.length} servers checked`);

    return {
      command_id: command.id,
      status: 'completed',
      result: {
        health_check_results: healthResults,
        total_servers: healthResults.length,
        healthy_servers: healthResults.filter(r => r.health_status === 'healthy').length
      }
    };
  }
}
