import { Logger } from 'pino';
import { ProcessInfo, MCPServerConfig } from './types';
import type { RuntimeState } from './runtime-state';
import type { EventBus } from '../services/event-bus';

/**
 * Callback type for spawning a new process
 */
export type SpawnFunction = (config: MCPServerConfig) => Promise<ProcessInfo>;

/**
 * Callback type for terminating a process
 */
export type TerminateFunction = (processInfo: ProcessInfo, timeout?: number) => Promise<void>;

/**
 * Callback type for getting a process by name
 */
export type GetProcessFunction = (installationName: string) => ProcessInfo | null;

/**
 * DormantManager handles dormant process tracking and respawning
 * Manages idle process termination and on-demand respawning
 */
export class DormantManager {
  private respawningProcesses = new Map<string, Promise<ProcessInfo>>(); // installationName -> respawn promise

  constructor(
    private logger: Logger,
    private runtimeState: RuntimeState | undefined,
    private eventBus?: EventBus
  ) {}

  /**
   * Get all dormant process names from RuntimeState
   */
  getAllDormantProcessNames(): string[] {
    if (!this.runtimeState) {
      return [];
    }
    return this.runtimeState.getAllDormantProcessNames();
  }

  /**
   * Get or respawn a process if it's dormant
   * This method checks active processes first, then dormant configs, and respawns if needed
   * Prevents concurrent respawn attempts for the same process
   */
  async getOrRespawnProcess(
    installationName: string,
    getProcess: GetProcessFunction,
    spawnProcess: SpawnFunction
  ): Promise<ProcessInfo> {
    // Check if process is already active
    const existingProcess = getProcess(installationName);
    if (existingProcess && existingProcess.status === 'running') {
      return existingProcess;
    }

    // Check if process is currently being respawned
    const respawningPromise = this.respawningProcesses.get(installationName);
    if (respawningPromise) {
      this.logger.debug({
        operation: 'dormant_process_respawn_waiting',
        installation_name: installationName
      }, `Waiting for in-progress respawn: ${installationName}`);
      return await respawningPromise;
    }

    // Check if process config exists in dormant map
    if (!this.runtimeState) {
      throw new Error(`Process ${installationName} not found and RuntimeState not available`);
    }

    const dormantConfig = this.runtimeState.getDormantConfig(installationName);
    if (!dormantConfig) {
      throw new Error(`Process ${installationName} not found in active or dormant maps`);
    }

    // Start respawning process
    const respawnStartTime = Date.now();
    this.logger.info({
      operation: 'dormant_process_respawn_start',
      installation_name: installationName,
      team_id: dormantConfig.team_id
    }, `Respawning dormant process: ${installationName}`);

    // Create respawn promise to prevent concurrent attempts
    const respawnPromise = (async () => {
      try {
        // Spawn the process
        const processInfo = await spawnProcess(dormantConfig);

        // Remove from dormant map
        this.runtimeState!.removeDormantConfig(installationName);

        const dormantDuration = respawnStartTime - (processInfo.startTime - 1000); // Approximate

        this.logger.info({
          operation: 'dormant_process_respawned',
          installation_name: installationName,
          team_id: dormantConfig.team_id,
          respawn_duration_ms: Date.now() - respawnStartTime,
          dormant_duration_ms: dormantDuration,
          pid: processInfo.process.pid
        }, `Dormant process respawned successfully: ${installationName}`);

        // Emit mcp.server.respawned event
        try {
          this.eventBus?.emit('mcp.server.respawned', {
            server_id: dormantConfig.installation_id,
            server_slug: installationName,
            team_id: dormantConfig.team_id,
            user_id: dormantConfig.user_id,
            process_id: processInfo.process.pid || 0,
            dormant_duration_seconds: Math.round(dormantDuration / 1000),
            respawn_duration_ms: Date.now() - respawnStartTime
          });
        } catch (error) {
          this.logger.warn({ error }, 'Failed to emit mcp.server.respawned event (non-fatal)');
        }

        return processInfo;

      } finally {
        // Remove from respawning map
        this.respawningProcesses.delete(installationName);
      }
    })();

    // Store respawn promise
    this.respawningProcesses.set(installationName, respawnPromise);

    return await respawnPromise;
  }

  /**
   * Terminate a process and mark it as dormant for later respawning
   */
  async terminateAndMarkDormant(
    installationName: string,
    getProcess: GetProcessFunction,
    terminateProcess: TerminateFunction,
    timeout: number = 10000
  ): Promise<void> {
    const processInfo = getProcess(installationName);
    if (!processInfo) {
      this.logger.warn({
        operation: 'terminate_dormant_not_found',
        installation_name: installationName
      }, `Process not found for dormant marking: ${installationName}`);
      return;
    }

    if (!this.runtimeState) {
      this.logger.error({
        operation: 'terminate_dormant_no_runtime_state',
        installation_name: installationName
      }, 'Cannot mark process as dormant: RuntimeState not available');
      return;
    }

    const idleDuration = Date.now() - processInfo.lastActivity;

    this.logger.info({
      operation: 'process_marked_dormant_start',
      installation_name: installationName,
      team_id: processInfo.config.team_id,
      idle_duration_ms: idleDuration,
      last_activity: new Date(processInfo.lastActivity).toISOString()
    }, `Marking process as dormant due to inactivity: ${installationName}`);

    // Store config in dormant map before terminating
    this.runtimeState.markProcessDormant(installationName, processInfo.config);

    // Mark as dormant shutdown to skip crash detection
    processInfo.isDormantShutdown = true;

    // Emit mcp.server.dormant event
    try {
      this.eventBus?.emit('mcp.server.dormant', {
        server_id: processInfo.config.installation_id,
        server_slug: installationName,
        team_id: processInfo.config.team_id,
        user_id: processInfo.config.user_id,
        process_id: processInfo.process.pid || 0,
        idle_duration_seconds: Math.round(idleDuration / 1000),
        last_activity_at: new Date(processInfo.lastActivity).toISOString()
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to emit mcp.server.dormant event (non-fatal)');
    }

    // Terminate the process
    await terminateProcess(processInfo, timeout);

    this.logger.info({
      operation: 'process_marked_dormant_success',
      installation_name: installationName,
      team_id: processInfo.config.team_id
    }, `Process marked as dormant and terminated: ${installationName}`);
  }

  /**
   * Check if a process is currently being respawned
   */
  isRespawning(installationName: string): boolean {
    return this.respawningProcesses.has(installationName);
  }

  /**
   * Get count of currently respawning processes
   */
  getRespawningCount(): number {
    return this.respawningProcesses.size;
  }

  /**
   * Set the EventBus reference (for late initialization)
   * Called when EventBus becomes available after construction
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }
}
