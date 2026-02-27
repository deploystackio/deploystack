import { Logger } from 'pino';
import { ProcessInfo, MCPServerConfig } from './types';
import type { EventBus } from '../services/event-bus';

/**
 * Callback type for spawning a new process
 */
export type SpawnCallback = (config: MCPServerConfig) => Promise<ProcessInfo>;

/**
 * Callback type for backend status updates
 */
export type StatusCallback = (installationId: string, status: string, statusMessage?: string) => void;

/**
 * RestartHandler manages crash detection and automatic restart logic
 * Implements exponential backoff and restart attempt limits
 */
export class RestartHandler {
  private restartAttempts = new Map<string, number[]>(); // installationName -> crash timestamps

  constructor(
    private logger: Logger,
    private eventBus?: EventBus,
    private backendStatusCallback?: StatusCallback,
    private maxRestartAttempts: number = 3
  ) {}

  /**
   * Set callback for backend status updates
   */
  setBackendStatusCallback(callback: StatusCallback): void {
    this.backendStatusCallback = callback;
  }

  /**
   * Handle process exit - determine if crash and attempt restart
   * Returns the new ProcessInfo if restarted, null otherwise
   */
  async handleProcessExit(
    processInfo: ProcessInfo,
    code: number | null,
    signal: NodeJS.Signals | null,
    spawnCallback: SpawnCallback,
    onRestartLimitExceeded: (processInfo: ProcessInfo) => void,
    onRestarted: (newProcess: ProcessInfo, oldProcess: ProcessInfo) => void,
    onRestartFailed: (processInfo: ProcessInfo, error: unknown) => void
  ): Promise<ProcessInfo | null> {
    const uptime = Date.now() - processInfo.startTime;
    const installationName = processInfo.config.installation_name;

    // Check if this is an intentional dormant shutdown (skip crash detection)
    if (processInfo.isDormantShutdown) {
      this.logger.info({
        operation: 'process_exit_dormant',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        exit_code: code,
        signal: signal,
        uptime_ms: uptime
      }, `Process terminated for dormancy (not a crash): ${installationName}`);
      return null;
    }

    // Check if this is an intentional uninstall shutdown (skip crash detection)
    if (processInfo.isUninstallShutdown) {
      this.logger.info({
        operation: 'process_exit_uninstall',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        exit_code: code,
        signal: signal,
        uptime_ms: uptime
      }, `Process terminated for uninstall (not a crash): ${installationName}`);
      return null;
    }

    // Determine if this was a crash (non-zero exit code) or intentional shutdown
    const wasCrash = code !== 0 && code !== null && processInfo.status !== 'terminating';

    if (!wasCrash) {
      this.logger.debug({
        operation: 'process_exit_normal',
        installation_name: installationName,
        exit_code: code,
        signal: signal
      }, 'Process exited normally (not a crash)');
      return null;
    }

    // This was a crash
    this.logger.error({
      operation: 'process_crashed',
      installation_name: installationName,
      team_id: processInfo.config.team_id,
      exit_code: code,
      signal: signal,
      uptime_ms: uptime
    }, `MCP process crashed: ${installationName}`);

    // Emit mcp.server.crashed event
    const crashCount = (this.restartAttempts.get(installationName) || []).length;
    const canRestart = this.shouldAttemptRestart(installationName);

    try {
      this.eventBus?.emit('mcp.server.crashed', {
        server_id: processInfo.config.installation_id,
        server_slug: processInfo.config.installation_name,
        team_id: processInfo.config.team_id,
        user_id: processInfo.config.user_id,
        process_id: processInfo.process.pid || 0,
        exit_code: code || 0,
        signal: signal || 'none',
        uptime_seconds: Math.round(uptime / 1000),
        crash_count: crashCount + 1,
        will_restart: canRestart
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to emit mcp.server.crashed event (non-fatal)');
    }

    // Check if we should attempt restart
    if (!canRestart) {
      this.logger.error({
        operation: 'restart_limit_exceeded',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        max_attempts: this.maxRestartAttempts
      }, `Max restart attempts (${this.maxRestartAttempts}) exceeded for ${installationName} - marking as permanently failed`);

      // Emit mcp.server.permanently_failed event
      try {
        this.eventBus?.emit('mcp.server.permanently_failed', {
          server_id: processInfo.config.installation_id,
          server_slug: processInfo.config.installation_name,
          team_id: processInfo.config.team_id,
          user_id: processInfo.config.user_id,
          total_crashes: (this.restartAttempts.get(installationName) || []).length,
          last_error: `Exit code: ${code}, signal: ${signal}`,
          failed_at: new Date().toISOString()
        });
      } catch (error) {
        this.logger.warn({ error }, 'Failed to emit mcp.server.permanently_failed event (non-fatal)');
      }

      // Also emit mcp.server.status_changed so backend updates installation status
      try {
        this.eventBus?.emit('mcp.server.status_changed', {
          installation_id: processInfo.config.installation_id,
          team_id: processInfo.config.team_id,
          user_id: processInfo.config.user_id || 'unknown',
          status: 'permanently_failed',
          status_message: `Process crashed ${(this.restartAttempts.get(installationName) || []).length} times in 5 minutes. Manual restart required.`,
          timestamp: new Date().toISOString()
        });

        // Track backend status emission
        if (this.backendStatusCallback) {
          this.backendStatusCallback(
            processInfo.config.installation_id,
            'permanently_failed',
            `Process crashed ${(this.restartAttempts.get(installationName) || []).length} times in 5 minutes. Manual restart required.`
          );
        }
      } catch (error) {
        this.logger.warn({ error }, 'Failed to emit mcp.server.status_changed event (non-fatal)');
      }

      // Mark as permanently failed
      onRestartLimitExceeded(processInfo);
      return null;
    }

    // Calculate restart delay
    const delay = this.calculateRestartDelay(installationName, uptime);

    this.logger.info({
      operation: 'restart_scheduled',
      installation_name: installationName,
      team_id: processInfo.config.team_id,
      delay_ms: delay,
      attempt_number: (this.restartAttempts.get(installationName) || []).length
    }, `Scheduling automatic restart in ${delay}ms`);

    // Wait for backoff period
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Attempt restart
    try {
      this.logger.info({
        operation: 'restart_attempt',
        installation_name: installationName,
        team_id: processInfo.config.team_id
      }, `Attempting automatic restart of ${installationName}`);

      const newProcessInfo = await spawnCallback(processInfo.config);

      this.logger.info({
        operation: 'restart_success',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        new_pid: newProcessInfo.process.pid
      }, `Automatic restart successful for ${installationName}`);

      // Emit mcp.server.restarted event
      try {
        this.eventBus?.emit('mcp.server.restarted', {
          server_id: processInfo.config.installation_id,
          server_slug: processInfo.config.installation_name,
          team_id: processInfo.config.team_id,
          user_id: processInfo.config.user_id,
          old_process_id: processInfo.process.pid || 0,
          new_process_id: newProcessInfo.process.pid || 0,
          restart_reason: 'crash',
          attempt_number: (this.restartAttempts.get(installationName) || []).length
        });
      } catch (error) {
        this.logger.warn({ error }, 'Failed to emit mcp.server.restarted event (non-fatal)');
      }

      onRestarted(newProcessInfo, processInfo);
      return newProcessInfo;

    } catch (error) {
      this.logger.error({
        operation: 'restart_failed',
        installation_name: installationName,
        team_id: processInfo.config.team_id,
        error: error instanceof Error ? error.message : String(error)
      }, `Automatic restart failed for ${installationName}`);

      onRestartFailed(processInfo, error);
      return null;
    }
  }

  /**
   * Check if restart should be attempted (max attempts in 5 minutes, configurable)
   */
  shouldAttemptRestart(installationName: string): boolean {
    const now = Date.now();
    const attempts = this.restartAttempts.get(installationName) || [];

    // Filter to attempts in last 5 minutes
    const recentAttempts = attempts.filter(ts => now - ts < 5 * 60 * 1000);

    // Add this attempt
    recentAttempts.push(now);
    this.restartAttempts.set(installationName, recentAttempts);

    return recentAttempts.length <= this.maxRestartAttempts;
  }

  /**
   * Calculate restart delay based on crash timing
   */
  calculateRestartDelay(installationName: string, uptime: number): number {
    // If process ran for > 60 seconds before crash, restart immediately
    if (uptime > 60 * 1000) {
      return 0;
    }

    // Process crashed quickly - use exponential backoff
    const attempts = (this.restartAttempts.get(installationName) || []).length;
    const delays = [1000, 5000, 15000]; // 1s, 5s, 15s

    return delays[Math.min(attempts - 1, delays.length - 1)] || 0;
  }

  /**
   * Clear restart attempts for an installation (on successful restart or removal)
   */
  clearRestartAttempts(installationName: string): void {
    this.restartAttempts.delete(installationName);
  }

  /**
   * Get current restart attempt count for an installation
   */
  getRestartAttemptCount(installationName: string): number {
    return (this.restartAttempts.get(installationName) || []).length;
  }

  /**
   * Set the EventBus reference (for late initialization)
   * Called when EventBus becomes available after construction
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }
}
