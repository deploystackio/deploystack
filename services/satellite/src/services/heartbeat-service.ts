import { FastifyBaseLogger } from 'fastify';
import { BackendClient } from './backend-client';
import { CommandProcessor, ProcessInfo } from './command-processor';
import { RuntimeState } from '../process/runtime-state';
import { HeartbeatDataBuilder, NormalizedHeartbeatData } from './heartbeat-data-builder';

export interface SystemMetrics {
  cpu_usage_percent: number;
  memory_usage_mb: number;
  disk_usage_percent: number;
  uptime_seconds: number;
}

export interface StdioProcessMetric {
  installation_id: string;
  installation_name: string;
  status: string;
  pid: number | undefined;
  uptime_seconds: number;
  message_count: number;
  error_count: number;
  health_status: string;
  last_activity: string;
}

export interface HeartbeatPayload {
  status: 'active' | 'degraded' | 'error';
  system_metrics: SystemMetrics;
  processes: ProcessInfo[];  // HTTP proxy processes (legacy)
  processes_by_team: Record<string, StdioProcessMetric[]>;  // stdio processes grouped by team
  normalized_data?: NormalizedHeartbeatData;  // New normalized format for scale
  error_count: number;
  version: string;
  satellite_url?: string;  // Optional - only sent on first heartbeat after startup
}

export class HeartbeatService {
  private interval?: NodeJS.Timeout;
  private satelliteId: string;
  private apiKey: string;
  private backendClient: BackendClient;
  private runtimeState: RuntimeState | null;
  private logger: FastifyBaseLogger;
  private isRunning: boolean = false;
  private heartbeatCount: number = 0;
  private commandProcessor?: CommandProcessor;
  private heartbeatDataBuilder?: HeartbeatDataBuilder;
  private hasUpdatedUrlThisSession: boolean = false;  // Flag to track if URL was sent this session

  constructor(
    satelliteId: string, 
    apiKey: string, 
    backendClient: BackendClient, 
    logger: FastifyBaseLogger,
    runtimeState?: RuntimeState
  ) {
    this.satelliteId = satelliteId;
    this.apiKey = apiKey;
    this.backendClient = backendClient;
    this.logger = logger;
    this.runtimeState = runtimeState || null;
    
    // Ensure the backend client has the API key for authenticated requests
    this.backendClient.setApiKey(apiKey);
  }

  /**
   * Set command processor for process reporting
   */
  setCommandProcessor(commandProcessor: CommandProcessor): void {
    this.commandProcessor = commandProcessor;
    this.logger.debug({
      operation: 'heartbeat_command_processor_set',
      satelliteId: this.satelliteId
    }, 'Command processor set for heartbeat process reporting');
  }

  /**
   * Set heartbeat data builder for normalized data
   */
  setHeartbeatDataBuilder(heartbeatDataBuilder: HeartbeatDataBuilder): void {
    this.heartbeatDataBuilder = heartbeatDataBuilder;
    this.logger.debug({
      operation: 'heartbeat_data_builder_set',
      satelliteId: this.satelliteId
    }, 'Heartbeat data builder set for normalized heartbeat data');
  }

  /**
   * Start the heartbeat service with 30-second intervals
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn({
        operation: 'heartbeat_already_running',
        satelliteId: this.satelliteId
      }, 'Heartbeat service is already running');
      return;
    }

    this.logger.info({
      operation: 'heartbeat_service_start',
      satelliteId: this.satelliteId,
      interval_seconds: 30
    }, 'Starting heartbeat service (30s interval)');

    // Send initial heartbeat immediately
    this.sendHeartbeat();

    // Set up recurring heartbeat every 30 seconds
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);

    this.isRunning = true;
  }

  /**
   * Stop the heartbeat service
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    this.isRunning = false;
    this.logger.info({
      operation: 'heartbeat_service_stop',
      satelliteId: this.satelliteId,
      total_heartbeats: this.heartbeatCount
    }, 'Heartbeat service stopped');
  }

  /**
   * Send a heartbeat to the backend
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      this.heartbeatCount++;
      
      this.logger.debug({
        operation: 'heartbeat_send_start',
        satelliteId: this.satelliteId,
        heartbeat_number: this.heartbeatCount
      }, 'Sending heartbeat to backend');

      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      
      // Get current processes from command processor (HTTP proxies)
      const processes: ProcessInfo[] = this.commandProcessor ? 
        this.commandProcessor.getAllProcesses() : [];

      // Collect stdio processes grouped by team
      const processesByTeam = this.collectStdioProcessesByTeam();

      // Build normalized data if builder is available
      let normalizedData: NormalizedHeartbeatData | undefined;
      if (this.heartbeatDataBuilder) {
        try {
          normalizedData = this.heartbeatDataBuilder.buildHeartbeatData();
          this.logger.debug({
            operation: 'normalized_heartbeat_built',
            teams_count: normalizedData.summary.total_teams,
            servers_count: normalizedData.summary.total_servers,
            tools_count: normalizedData.summary.total_tools
          }, 'Built normalized heartbeat data for backend');
        } catch (error) {
          this.logger.error({
            operation: 'normalized_heartbeat_build_failed',
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to build normalized heartbeat data');
        }
      }

      // Check if this is the first heartbeat - include satellite_url to update backend
      let satelliteUrl: string | undefined;
      if (!this.hasUpdatedUrlThisSession) {
        // Read satellite URL from environment
        // Send empty string if not set to signal backend to auto-detect
        satelliteUrl = process.env.DEPLOYSTACK_SATELLITE_URL || '';

        if (satelliteUrl && satelliteUrl !== '') {
          this.logger.info({
            operation: 'satellite_url_first_heartbeat',
            satellite_url: satelliteUrl,
            heartbeat_number: this.heartbeatCount
          }, 'Sending explicit satellite URL in first heartbeat to update backend');
        } else {
          this.logger.info({
            operation: 'satellite_url_autodetect',
            heartbeat_number: this.heartbeatCount
          }, 'Sending empty URL to signal backend to auto-detect from request headers');
        }
      }

      // Create heartbeat payload
      const payload: HeartbeatPayload = {
        status: 'active',
        system_metrics: systemMetrics,
        processes: processes,
        processes_by_team: processesByTeam,
        normalized_data: normalizedData,
        error_count: 0,
        version: '0.1.0',
        satellite_url: satelliteUrl  // Only present on first heartbeat
      };

      // Send heartbeat via backend client
      const result = await this.backendClient.sendHeartbeat(this.satelliteId, payload);

      if (result.success) {
        this.logger.debug({
          operation: 'heartbeat_send_success',
          satelliteId: this.satelliteId,
          heartbeat_number: this.heartbeatCount,
          response_time_ms: result.response_time_ms
        }, `Heartbeat sent successfully (#${this.heartbeatCount})`);

        // Mark URL as updated after first successful heartbeat
        if (!this.hasUpdatedUrlThisSession) {
          this.hasUpdatedUrlThisSession = true;
          this.logger.info({
            operation: 'satellite_url_update_complete',
            satelliteId: this.satelliteId,
            heartbeat_number: this.heartbeatCount
          }, 'Satellite URL update sent - subsequent heartbeats will not include URL');
        }
      } else {
        this.logger.warn({
          operation: 'heartbeat_send_failed',
          satelliteId: this.satelliteId,
          heartbeat_number: this.heartbeatCount,
          error: result.error
        }, `Heartbeat failed: ${result.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'heartbeat_send_exception',
        satelliteId: this.satelliteId,
        heartbeat_number: this.heartbeatCount,
        error: errorMessage
      }, `Heartbeat exception: ${errorMessage}`);
    }
  }

  /**
   * Collect stdio processes grouped by team
   */
  private collectStdioProcessesByTeam(): Record<string, StdioProcessMetric[]> {
    if (!this.runtimeState) {
      return {};
    }

    const allProcesses = this.runtimeState.getAllProcesses();
    const processesByTeam: Record<string, StdioProcessMetric[]> = {};

    for (const proc of allProcesses) {
      if (!processesByTeam[proc.teamId]) {
        processesByTeam[proc.teamId] = [];
      }

      processesByTeam[proc.teamId].push({
        installation_id: proc.installationId,
        installation_name: proc.installationName,
        status: proc.status,
        pid: proc.process.pid,
        uptime_seconds: Math.floor((Date.now() - proc.startTime) / 1000),
        message_count: proc.messageCount,
        error_count: proc.errorCount,
        health_status: proc.healthStatus,
        last_activity: new Date(proc.lastActivity).toISOString()
      });
    }

    this.logger.debug({
      operation: 'stdio_processes_collected',
      team_count: Object.keys(processesByTeam).length,
      total_processes: allProcesses.length
    }, `Collected ${allProcesses.length} stdio processes across ${Object.keys(processesByTeam).length} teams`);

    return processesByTeam;
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      // Get uptime
      const uptimeSeconds = Math.round(process.uptime());

      // TODO: Implement CPU and disk usage collection
      // For now, return basic metrics with placeholders
      return {
        cpu_usage_percent: 0, // TODO: Implement CPU usage monitoring
        memory_usage_mb: memoryUsedMB,
        disk_usage_percent: 0, // TODO: Implement disk usage monitoring
        uptime_seconds: uptimeSeconds
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'system_metrics_collection_failed',
        error: errorMessage
      }, `Failed to collect system metrics: ${errorMessage}`);

      // Return default metrics on error
      return {
        cpu_usage_percent: 0,
        memory_usage_mb: 0,
        disk_usage_percent: 0,
        uptime_seconds: Math.round(process.uptime())
      };
    }
  }

  /**
   * Get heartbeat service status
   */
  getStatus(): { isRunning: boolean; heartbeatCount: number; satelliteId: string } {
    return {
      isRunning: this.isRunning,
      heartbeatCount: this.heartbeatCount,
      satelliteId: this.satelliteId
    };
  }
}
