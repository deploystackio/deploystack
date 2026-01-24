import { FastifyBaseLogger } from 'fastify';
import { BackendClient } from './backend-client';

export interface SatelliteCommand {
  id: string;
  command_type: 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache';
  priority: 'immediate' | 'high' | 'normal' | 'low';
  payload: {
    installation_id?: string;  // Primary identifier for MCP installations
    server_name?: string;      // Keep for backward compatibility
    event?: string;            // Event type (e.g., "mcp_installation_created")
    team_id?: string;          // Team context
    team_context?: {
      team_id: string;
      team_slug: string;
    };
    server_config?: {
      command: string;
      environment?: Record<string, string>;
      url?: string;
      headers?: Record<string, string>;
    };
    [key: string]: unknown;
  };
  correlation_id: string;
}

export interface CommandPollResponse {
  commands: SatelliteCommand[];
  polling_mode: 'immediate' | 'normal' | 'error';
  next_poll_interval: number;
}

export interface CommandResult {
  command_id: string;
  status: 'acknowledged' | 'executing' | 'completed' | 'failed';
  result?: {
    process_id?: string;
    local_port?: number;
    startup_time_ms?: number;
    error_message?: string;
    [key: string]: unknown;
  };
  error?: string;
}

export interface McpServerConfig {
  name: string;
  type?: 'http' | 'stdio' | 'sse';
  transport_type?: 'http' | 'stdio' | 'sse';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
  timeout?: number;
  enabled: boolean;
  headers?: Record<string, string>;
  url_query_params?: Record<string, string>;
  installation_id?: string;
  instance_id?: string;
  team_id?: string;
  team_slug?: string;
  server_name?: string;
  server_slug?: string;
  installation_name?: string;

  /** OAuth support - Only for HTTP/SSE transport */
  requires_oauth?: boolean;
  user_id?: string; // User who authorized the OAuth connection OR per-user instance owner

  /** Installation settings */
  settings?: {
    request_logging_enabled?: boolean;
    // Future settings go here
  };

  /** Metadata about which fields contain secrets (for secure logging) */
  secret_metadata?: {
    /** Names of query parameters that are secrets */
    query_params?: string[];
    /** Names of headers that are secrets */
    headers?: string[];
    /** Names of environment variables that are secrets */
    env?: string[];
  };

  /** Server source - for GitHub deployment detection */
  source?: 'manual' | 'github' | 'official_registry' | null;

  /** GitHub repository information (parsed from github: URLs) */
  github_owner?: string;
  github_repo?: string;
  github_ref?: string;

  /** Temporary directory path (for cleanup after process termination) */
  temp_dir?: string;
}

export interface ConfigurationUpdate {
  mcp_servers: Record<string, McpServerConfig>;
  polling_intervals?: {
    normal: number;
    immediate: number;
    error_backoff_max: number;
  };
  resource_limits?: {
    max_processes: number;
    max_memory_per_process: string;
  };
}

export class CommandPollingService {
  private interval?: NodeJS.Timeout;
  private satelliteId: string;
  private backendClient: BackendClient;
  private logger: FastifyBaseLogger;
  private isRunning: boolean = false;
  private pollCount: number = 0;
  private currentPollingMode: 'immediate' | 'normal' | 'error' = 'normal';
  private currentInterval: number = 60; // Default 60 seconds, configurable via environment
  private lastPollTime?: Date;
  private onConfigurationUpdate?: (config: ConfigurationUpdate) => Promise<void>;
  private onCommandReceived?: (command: SatelliteCommand) => Promise<CommandResult>;

  constructor(satelliteId: string, backendClient: BackendClient, logger: FastifyBaseLogger) {
    this.satelliteId = satelliteId;
    this.backendClient = backendClient;
    this.logger = logger;
    
    // Configure polling interval from environment variable
    const envInterval = process.env.DEPLOYSTACK_BACKEND_POLLING_INTERVAL;
    if (envInterval) {
      const parsedInterval = parseInt(envInterval, 10);
      if (!isNaN(parsedInterval) && parsedInterval > 0) {
        this.currentInterval = parsedInterval;
        this.logger.debug({
          operation: 'polling_interval_configured',
          satelliteId: this.satelliteId,
          interval_seconds: this.currentInterval,
          source: 'environment_variable'
        }, `Command polling interval configured from environment: ${this.currentInterval}s`);
      } else {
        this.logger.warn({
          operation: 'polling_interval_invalid',
          satelliteId: this.satelliteId,
          env_value: envInterval,
          fallback_interval: this.currentInterval
        }, `Invalid DEPLOYSTACK_BACKEND_POLLING_INTERVAL value, using default: ${this.currentInterval}s`);
      }
    }
  }

  /**
   * Set callback for configuration updates
   */
  setConfigurationUpdateHandler(handler: (config: ConfigurationUpdate) => Promise<void>): void {
    this.onConfigurationUpdate = handler;
  }

  /**
   * Set callback for command processing
   */
  setCommandHandler(handler: (command: SatelliteCommand) => Promise<CommandResult>): void {
    this.onCommandReceived = handler;
  }

  /**
   * Start the command polling service
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn({
        operation: 'command_polling_already_running',
        satelliteId: this.satelliteId
      }, 'Command polling service is already running');
      return;
    }

    this.logger.info({
      operation: 'command_polling_service_start',
      satelliteId: this.satelliteId,
      initial_interval_seconds: this.currentInterval,
      has_api_key: !!this.getApiKey(),
      api_key_length: this.getApiKey().length
    }, 'Starting command polling service');

    // Set isRunning BEFORE starting operations
    this.isRunning = true;

    this.logger.debug({
      operation: 'command_polling_service_state_set',
      satelliteId: this.satelliteId,
      isRunning: this.isRunning
    }, 'Command polling service state set to running');

    // Poll immediately on startup
    this.logger.debug({
      operation: 'initial_poll_starting',
      satelliteId: this.satelliteId
    }, 'Starting initial poll...');

    this.pollForCommands().catch(error => {
      this.logger.error({
        operation: 'initial_poll_failed',
        satelliteId: this.satelliteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Initial command poll failed during startup');
    });

    // Set up recurring polling
    this.logger.debug({
      operation: 'scheduling_recurring_polls',
      satelliteId: this.satelliteId
    }, 'Setting up recurring polling...');

    this.scheduleNextPoll();

    this.logger.info({
      operation: 'command_polling_service_started',
      satelliteId: this.satelliteId,
      polling_mode: this.currentPollingMode,
      interval_seconds: this.currentInterval,
      isRunning: this.isRunning
    }, 'Command polling service started successfully');
  }

  /**
   * Stop the command polling service
   */
  stop(): void {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = undefined;
    }

    this.isRunning = false;
    this.logger.info({
      operation: 'command_polling_service_stop',
      satelliteId: this.satelliteId,
      total_polls: this.pollCount
    }, 'Command polling service stopped');
  }

  /**
   * Schedule the next poll based on current polling mode
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning) {
      this.logger.warn({
        operation: 'schedule_poll_skipped',
        satelliteId: this.satelliteId,
        reason: 'service_not_running'
      }, 'Skipping poll scheduling - service not running');
      return;
    }

    this.logger.debug({
      operation: 'schedule_next_poll',
      satelliteId: this.satelliteId,
      interval_seconds: this.currentInterval,
      polling_mode: this.currentPollingMode
    }, `Scheduling next poll in ${this.currentInterval} seconds`);

    this.interval = setTimeout(() => {
      this.logger.debug({
        operation: 'poll_timer_triggered',
        satelliteId: this.satelliteId,
        poll_number: this.pollCount + 1
      }, 'Poll timer triggered, starting poll');
      
      this.pollForCommands().catch(error => {
        this.logger.error({
          operation: 'scheduled_poll_failed',
          satelliteId: this.satelliteId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Scheduled poll failed with exception');
      });
      
      this.scheduleNextPoll();
    }, this.currentInterval * 1000);
  }

  /**
   * Poll backend for commands and configuration
   */
  private async pollForCommands(): Promise<void> {
    try {
      this.pollCount++;
      this.lastPollTime = new Date();
      
      this.logger.debug({
        operation: 'command_poll_start',
        satelliteId: this.satelliteId,
        poll_number: this.pollCount,
        polling_mode: this.currentPollingMode,
        interval_seconds: this.currentInterval
      }, `Polling backend for commands (#${this.pollCount})`);

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (this.lastPollTime) {
        queryParams.set('last_poll', this.lastPollTime.toISOString());
      }
      queryParams.set('limit', '10');

      // Poll for commands
      const response = await fetch(`${this.backendClient.getBackendUrl()}/api/satellites/${this.satelliteId}/commands?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const pollResponse = await response.json() as CommandPollResponse;

      // Update polling mode and interval based on backend response
      this.updatePollingStrategy(pollResponse.polling_mode, pollResponse.next_poll_interval);

      this.logger.debug({
        operation: 'command_poll_success',
        satelliteId: this.satelliteId,
        poll_number: this.pollCount,
        commands_received: pollResponse.commands.length,
        polling_mode: pollResponse.polling_mode,
        next_interval: pollResponse.next_poll_interval
      }, `Poll successful: ${pollResponse.commands.length} commands received`);

      // Process received commands
      if (pollResponse.commands.length > 0) {
        await this.processCommands(pollResponse.commands);
      }

      // Note: Configuration updates are now handled only via 'configure' commands
      // No automatic config polling - config is pulled only when commanded

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'command_poll_failed',
        satelliteId: this.satelliteId,
        poll_number: this.pollCount,
        error: errorMessage
      }, `Command polling failed: ${errorMessage}`);

      // Switch to error mode with exponential backoff
      this.updatePollingStrategy('error', Math.min(this.currentInterval * 2, 300));
    }
  }

  /**
   * Update polling strategy based on backend response
   * Note: Backend interval suggestions are ignored - satellite uses configured interval
   */
  private updatePollingStrategy(mode: 'immediate' | 'normal' | 'error', interval: number): void {
    const previousMode = this.currentPollingMode;
    const configuredInterval = this.currentInterval;

    this.currentPollingMode = mode;
    // Ignore backend interval suggestion - keep using configured interval

    // Log what backend suggested but explain we're ignoring it
    this.logger.debug({
      operation: 'polling_strategy_backend_suggestion',
      satelliteId: this.satelliteId,
      backend_suggested_mode: mode,
      backend_suggested_interval: interval,
      configured_interval: configuredInterval,
      action: 'ignored_backend_interval'
    }, `Backend suggested ${interval}s interval, but using configured ${configuredInterval}s interval`);

    if (previousMode !== mode) {
      this.logger.info({
        operation: 'polling_mode_update',
        satelliteId: this.satelliteId,
        previous_mode: previousMode,
        new_mode: mode,
        interval_seconds: configuredInterval
      }, `Polling mode updated: ${mode} mode, keeping configured ${configuredInterval}s interval`);

      if (this.interval) {
        clearTimeout(this.interval);
        this.interval = undefined;
      }

      if (this.isRunning) {
        this.scheduleNextPoll();
      }
    }
  }

  /**
   * Process received commands
   */
  private async processCommands(commands: SatelliteCommand[]): Promise<void> {
    for (const command of commands) {
      try {
        this.logger.debug({
          operation: 'command_processing_start',
          satelliteId: this.satelliteId,
          command_id: command.id,
          command_type: command.command_type,
          priority: command.priority,
          correlation_id: command.correlation_id
        }, `Processing command: ${command.command_type} (${command.priority})`);

        // Process command if handler is available
        if (this.onCommandReceived) {
          const result = await this.onCommandReceived(command);
          await this.reportCommandResult(result);
        } else {
          this.logger.warn({
            operation: 'command_handler_missing',
            satelliteId: this.satelliteId,
            command_id: command.id
          }, 'No command handler registered, skipping command');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.logger.error({
          operation: 'command_processing_failed',
          satelliteId: this.satelliteId,
          command_id: command.id,
          error: errorMessage
        }, `Command processing failed: ${errorMessage}`);

        // Report command failure
        await this.reportCommandResult({
          command_id: command.id,
          status: 'failed',
          error: errorMessage
        });
      }
    }
  }

  /**
   * Report command execution result to backend
   */
  private async reportCommandResult(result: CommandResult): Promise<void> {
    try {
      this.logger.debug({
        operation: 'command_result_report',
        satelliteId: this.satelliteId,
        command_id: result.command_id,
        status: result.status
      }, `Reporting command result: ${result.status}`);

      const response = await fetch(`${this.backendClient.getBackendUrl()}/api/satellites/${this.satelliteId}/command-result`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(result),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        this.logger.debug({
          operation: 'command_result_report_success',
          satelliteId: this.satelliteId,
          command_id: result.command_id
        }, 'Command result reported successfully');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'command_result_report_failed',
        satelliteId: this.satelliteId,
        command_id: result.command_id,
        error: errorMessage
      }, `Failed to report command result: ${errorMessage}`);
    }
  }

  /**
   * Check for configuration updates from backend
   */
  private async checkForConfigurationUpdates(): Promise<void> {
    try {
      this.logger.debug({
        operation: 'config_update_check',
        satelliteId: this.satelliteId
      }, 'Checking for configuration updates');

      const response = await fetch(`${this.backendClient.getBackendUrl()}/api/satellites/${this.satelliteId}/config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        const config = await response.json() as ConfigurationUpdate;
        
        this.logger.debug({
          operation: 'config_update_received',
          satelliteId: this.satelliteId,
          mcp_servers_count: Object.keys(config.mcp_servers || {}).length
        }, 'Configuration update received');

        // Process configuration update if handler is available
        if (this.onConfigurationUpdate) {
          await this.onConfigurationUpdate(config);
        }
      } else if (response.status !== 304) { // 304 = Not Modified is OK
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'config_update_check_failed',
        satelliteId: this.satelliteId,
        error: errorMessage
      }, `Configuration update check failed: ${errorMessage}`);
    }
  }

  /**
   * Get API key from backend client
   */
  private getApiKey(): string {
    return this.backendClient.getApiKey();
  }

  /**
   * Get polling service status
   */
  getStatus(): { 
    isRunning: boolean; 
    pollCount: number; 
    satelliteId: string; 
    currentPollingMode: string;
    currentInterval: number;
    lastPollTime?: Date;
  } {
    return {
      isRunning: this.isRunning,
      pollCount: this.pollCount,
      satelliteId: this.satelliteId,
      currentPollingMode: this.currentPollingMode,
      currentInterval: this.currentInterval,
      lastPollTime: this.lastPollTime
    };
  }
}
