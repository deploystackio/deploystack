import { Job, JobStats } from './base-job';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';
import { IDLE_TIMEOUT_MS, SPAWN_GRACE_PERIOD_MS } from '../config/process';
import { FastifyBaseLogger } from 'fastify';

/**
 * Idle Process Cleanup Job
 * 
 * Monitors stdio MCP server processes and terminates those that have been idle
 * for longer than the configured timeout. Dormant process configs are stored
 * for automatic respawning when needed.
 */
export class IdleProcessCleanupJob implements Job {
  public readonly name = 'idle-process-cleanup';
  public readonly interval = 30000; // 30 seconds

  private isActive = false;
  private intervalHandle?: NodeJS.Timeout;
  private executionCount = 0;
  private errorCount = 0;
  private lastExecution?: Date;

  constructor(
    private processManager: ProcessManager,
    private runtimeState: RuntimeState,
    private logger: FastifyBaseLogger
  ) {}

  /**
   * Start the idle process cleanup job
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.logger.info({
      operation: 'idle_cleanup_job_start',
      interval_ms: this.interval,
      idle_timeout_ms: IDLE_TIMEOUT_MS,
      spawn_grace_period_ms: SPAWN_GRACE_PERIOD_MS
    }, `Starting idle process cleanup job (interval: ${this.interval / 1000}s, idle timeout: ${IDLE_TIMEOUT_MS / 1000}s, grace period: ${SPAWN_GRACE_PERIOD_MS / 1000}s)`);

    this.isActive = true;
    
    // Run immediately on start
    void this.executeCleanup();
    
    // Then run on interval
    this.intervalHandle = setInterval(() => {
      void this.executeCleanup();
    }, this.interval);
  }

  /**
   * Stop the idle process cleanup job
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.logger.info({
      operation: 'idle_cleanup_job_stop',
      execution_count: this.executionCount,
      error_count: this.errorCount
    }, 'Stopping idle process cleanup job');

    this.isActive = false;
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  /**
   * Check if job is running
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get job statistics
   */
  getStats(): JobStats {
    return {
      name: this.name,
      isRunning: this.isActive,
      executionCount: this.executionCount,
      errorCount: this.errorCount,
      lastExecution: this.lastExecution,
      nextExecution: this.isActive && this.lastExecution
        ? new Date(this.lastExecution.getTime() + this.interval)
        : undefined,
      averageExecutionTime: undefined // Could track if needed
    };
  }

  /**
   * Execute idle process cleanup check
   */
  private async executeCleanup(): Promise<void> {
    const startTime = Date.now();
    this.lastExecution = new Date(startTime);
    this.executionCount++;

    try {
      const now = Date.now();
      const allProcesses = this.processManager.getAllProcesses();
      
      let idleCount = 0;
      let terminatedCount = 0;

      for (const processInfo of allProcesses) {
        // Skip processes that are not running (starting, initializing, terminating, etc.)
        if (processInfo.status !== 'running') {
          this.logger.debug({
            operation: 'idle_cleanup_skip_not_running',
            installation_name: processInfo.config.installation_name,
            status: processInfo.status
          }, `Skipping non-running process: ${processInfo.config.installation_name}`);
          continue;
        }

        // PROTECTION 1: Skip recently spawned processes (grace period)
        const processAge = now - processInfo.startTime;
        if (processAge < SPAWN_GRACE_PERIOD_MS) {
          this.logger.debug({
            operation: 'idle_cleanup_skip_grace_period',
            installation_name: processInfo.config.installation_name,
            process_age_ms: processAge,
            grace_period_ms: SPAWN_GRACE_PERIOD_MS
          }, `Skipping process in grace period: ${processInfo.config.installation_name}`);
          continue;
        }

        // PROTECTION 2: Skip if there are active requests in flight
        if (processInfo.activeRequests && processInfo.activeRequests.size > 0) {
          this.logger.debug({
            operation: 'idle_cleanup_skip_active_requests',
            installation_name: processInfo.config.installation_name,
            active_request_count: processInfo.activeRequests.size
          }, `Skipping process with active requests: ${processInfo.config.installation_name}`);
          continue;
        }

        // Check if process has been idle too long
        const idleDuration = now - processInfo.lastActivity;
        if (idleDuration < IDLE_TIMEOUT_MS) {
          continue;
        }

        // Process is idle - mark as dormant and terminate
        idleCount++;
        
        try {
          // Mark this as an intentional dormant shutdown (not a crash)
          processInfo.isDormantShutdown = true;
          
          await this.processManager.terminateAndMarkDormant(
            processInfo.config.installation_name
          );
          terminatedCount++;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error({
            operation: 'idle_cleanup_terminate_failed',
            installation_name: processInfo.config.installation_name,
            error: errorMessage
          }, `Failed to terminate idle process: ${errorMessage}`);
        }
      }

      const duration = Date.now() - startTime;
      
      if (terminatedCount > 0) {
        this.logger.info({
          operation: 'idle_process_check_completed',
          total_processes: allProcesses.length,
          idle_count: idleCount,
          terminated_count: terminatedCount,
          dormant_count: this.runtimeState.getDormantCount(),
          duration_ms: duration
        }, `Idle check: terminated ${terminatedCount} idle process(es)`);
      } else {
        this.logger.debug({
          operation: 'idle_process_check_completed',
          total_processes: allProcesses.length,
          idle_count: idleCount,
          terminated_count: terminatedCount,
          dormant_count: this.runtimeState.getDormantCount(),
          duration_ms: duration
        }, `Idle check: no processes terminated`);
      }

    } catch (error) {
      this.errorCount++;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        operation: 'idle_cleanup_job_error',
        error: errorMessage,
        execution_count: this.executionCount,
        error_count: this.errorCount
      }, `Idle process cleanup job failed: ${errorMessage}`);
    }
  }
}
