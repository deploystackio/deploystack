import { rm } from 'fs/promises';
import { Logger } from 'pino';
import { ProcessInfo } from '../process/types';
import { TmpfsManager } from './tmpfs-manager';

/**
 * Callbacks for state management and event emission
 * Allows ProcessManager to control internal state while delegating termination logic
 */
export interface TerminationCallbacks {
  onStateCleanup: (processInfo: ProcessInfo) => void;  // Delete from maps
  onTerminated: (processInfo: ProcessInfo) => void;     // Emit event
}

/**
 * Handles process termination with graceful shutdown (SIGTERM → SIGKILL)
 * Manages GitHub deployment cleanup and state management via callbacks
 */
export class TerminationHandler {
  constructor(
    private logger: Logger,
    private tmpfsManager: TmpfsManager
  ) {}

  /**
   * Terminate a process gracefully (SIGTERM → SIGKILL)
   */
  async terminateProcess(
    processInfo: ProcessInfo,
    timeout: number,
    callbacks: TerminationCallbacks
  ): Promise<void> {
    if (processInfo.status === 'terminated') {
      return;
    }

    this.logger.info({
      operation: 'mcp_server_terminate_start',
      installation_name: processInfo.config.installation_name,
      process_id: processInfo.id,
      pid: processInfo.process.pid
    }, `Terminating MCP server: ${processInfo.config.installation_name}`);

    processInfo.status = 'terminating';

    // Cancel active requests
    for (const [, request] of processInfo.activeRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Process terminating'));
    }
    processInfo.activeRequests.clear();

    // Try graceful shutdown first
    if (processInfo.process && !processInfo.process.killed) {
      processInfo.process.kill('SIGTERM');

      this.logger.debug({
        operation: 'mcp_server_sigterm_sent',
        installation_name: processInfo.config.installation_name,
        pid: processInfo.process.pid
      }, `Sent SIGTERM to ${processInfo.config.installation_name}`);

      // Wait for graceful exit
      await new Promise<void>((resolve) => {
        const forceTimeout = setTimeout(() => {
          if (processInfo.process && !processInfo.process.killed) {
            this.logger.warn({
              operation: 'mcp_server_force_kill',
              installation_name: processInfo.config.installation_name,
              pid: processInfo.process.pid
            }, `Force killing ${processInfo.config.installation_name} after timeout`);

            processInfo.process.kill('SIGKILL');
          }
          resolve();
        }, timeout);

        processInfo.process.once('exit', () => {
          clearTimeout(forceTimeout);
          resolve();
        });
      });
    }

    processInfo.status = 'terminated';

    // Call state cleanup callback (ProcessManager deletes from maps)
    callbacks.onStateCleanup(processInfo);

    // Cleanup deployment directory if this was a GitHub deployment
    // ONLY delete on uninstall - preserve for dormant respawn, crash recovery, etc.
    if (processInfo.config.temp_dir && processInfo.isUninstallShutdown) {
      this.logger.debug({
        operation: 'github_cleanup_deployment',
        installation_id: processInfo.config.installation_id,
        deployment_dir: processInfo.config.temp_dir
      }, 'Cleaning up GitHub deployment directory');

      try {
        // Check if it's a tmpfs mount (deployment directories use tmpfs)
        const isTmpfs = await this.tmpfsManager.isTmpfs(processInfo.config.temp_dir);

        if (isTmpfs) {
          // Unmount tmpfs
          await this.tmpfsManager.removeTmpfs(processInfo.config.temp_dir);

          this.logger.info({
            operation: 'github_cleanup_tmpfs_success',
            installation_id: processInfo.config.installation_id,
            deployment_dir: processInfo.config.temp_dir
          }, 'GitHub deployment tmpfs unmounted successfully');
        } else {
          // Regular directory cleanup (legacy or fallback)
          await rm(processInfo.config.temp_dir, { recursive: true, force: true });

          this.logger.info({
            operation: 'github_cleanup_dir_success',
            installation_id: processInfo.config.installation_id,
            deployment_dir: processInfo.config.temp_dir
          }, 'GitHub deployment directory cleaned up successfully');
        }
      } catch (error) {
        this.logger.error({
          operation: 'github_cleanup_failed',
          installation_id: processInfo.config.installation_id,
          deployment_dir: processInfo.config.temp_dir,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to clean up GitHub deployment directory');
      }
    } else if (processInfo.config.temp_dir) {
      this.logger.debug({
        operation: 'github_preserve_deployment',
        installation_id: processInfo.config.installation_id,
        deployment_dir: processInfo.config.temp_dir,
        reason: 'Process restart/respawn or dormant wake-up'
      }, 'Preserving GitHub deployment directory for future restart');
    }

    this.logger.info({
      operation: 'mcp_server_terminate_success',
      installation_name: processInfo.config.installation_name,
      process_id: processInfo.id
    }, `Terminated MCP server: ${processInfo.config.installation_name}`);

    // Call termination callback (ProcessManager emits event)
    callbacks.onTerminated(processInfo);
  }

  /**
   * Terminate all processes in parallel
   */
  async terminateAllProcesses(
    processes: ProcessInfo[],
    terminateOne: (processInfo: ProcessInfo, timeout: number) => Promise<void>
  ): Promise<void> {
    this.logger.info({
      operation: 'mcp_terminate_all_start',
      process_count: processes.length
    }, `Terminating all ${processes.length} MCP server processes`);

    const terminationPromises = processes.map(processInfo =>
      terminateOne(processInfo, 10000).catch(error => {
        this.logger.error({
          operation: 'mcp_terminate_failed',
          installation_name: processInfo.config.installation_name,
          error: error instanceof Error ? error.message : String(error)
        }, `Failed to terminate process ${processInfo.config.installation_name}`);
      })
    );

    await Promise.all(terminationPromises);

    this.logger.info({
      operation: 'mcp_terminate_all_success',
      process_count: processes.length
    }, `Terminated all ${processes.length} MCP server processes`);
  }
}
