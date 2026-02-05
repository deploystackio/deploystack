import { EventEmitter } from 'events';
import { ProcessInfo, RuntimeProcessInfo, RuntimeStateSnapshot, MCPServerConfig } from './types';

/**
 * Runtime state management for MCP server processes
 * Maintains in-memory state of all running MCP servers
 * Adapted from gateway for multi-tenant satellite architecture (no "current team" concept)
 */
export class RuntimeState extends EventEmitter {
  private processes = new Map<string, RuntimeProcessInfo>();
  private processesByName = new Map<string, string>();
  private processesByTeam = new Map<string, Set<string>>();
  private permanentlyFailedProcesses = new Map<string, RuntimeProcessInfo>(); // Keep failed processes for reporting
  private dormantProcessConfigs = new Map<string, MCPServerConfig>(); // Keep configs for respawning dormant processes

  constructor() {
    super();
  }
  
  /**
   * Set ProcessManager to listen for restart limit exceeded events
   */
  listenToProcessManager(processManager: EventEmitter): void {
    processManager.on('restartLimitExceeded', (processInfo: ProcessInfo) => {
      this.handleRestartLimitExceeded(processInfo);
    });
  }
  
  /**
   * Handle process that exceeded restart limit
   */
  private handleRestartLimitExceeded(processInfo: ProcessInfo): void {
    // Create a permanently failed process entry
    const failedProcess: RuntimeProcessInfo = {
      ...processInfo,
      installationId: processInfo.config.installation_id,
      installationName: processInfo.config.installation_name,
      teamId: processInfo.config.team_id,
      status: 'permanently_failed',
      healthStatus: 'unhealthy',
      lastHealthCheck: Date.now()
    };
    
    // Store in permanently failed map
    this.permanentlyFailedProcesses.set(failedProcess.installationName, failedProcess);
    
    this.emit('processPermanentlyFailed', failedProcess);
  }

  /**
   * Add a process to runtime state
   */
  addProcess(processInfo: ProcessInfo, installationId: string, installationName: string, teamId: string): void {
    const runtimeInfo: RuntimeProcessInfo = {
      ...processInfo,
      installationId,
      installationName,
      teamId,
      healthStatus: 'unknown',
      lastHealthCheck: Date.now()
    };

    this.processes.set(processInfo.id, runtimeInfo);
    this.processesByName.set(installationName, processInfo.id);

    // Track by team
    if (!this.processesByTeam.has(teamId)) {
      this.processesByTeam.set(teamId, new Set());
    }
    this.processesByTeam.get(teamId)!.add(processInfo.id);

    this.emit('processAdded', runtimeInfo);
  }

  /**
   * Remove a process from runtime state
   * Also cleans up dormant config if process was in dormant state
   */
  removeProcess(processId: string): RuntimeProcessInfo | null {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      return null;
    }

    this.processes.delete(processId);
    this.processesByName.delete(processInfo.installationName);

    // Remove from team tracking
    const teamProcesses = this.processesByTeam.get(processInfo.teamId);
    if (teamProcesses) {
      teamProcesses.delete(processId);
      if (teamProcesses.size === 0) {
        this.processesByTeam.delete(processInfo.teamId);
      }
    }

    // BUGFIX: Clean up dormant config if exists
    this.dormantProcessConfigs.delete(processInfo.installationName);

    this.emit('processRemoved', processInfo);
    return processInfo;
  }

  /**
   * Get process by ID
   */
  getProcess(processId: string): RuntimeProcessInfo | null {
    return this.processes.get(processId) || null;
  }

  /**
   * Get process by installation name
   */
  getProcessByName(installationName: string): RuntimeProcessInfo | null {
    const processId = this.processesByName.get(installationName);
    if (!processId) {
      return null;
    }
    return this.processes.get(processId) || null;
  }

  /**
   * Get all processes (includes permanently failed processes for reporting)
   */
  getAllProcesses(): RuntimeProcessInfo[] {
    const activeProcesses = Array.from(this.processes.values());
    const failedProcesses = Array.from(this.permanentlyFailedProcesses.values());
    return [...activeProcesses, ...failedProcesses];
  }

  /**
   * Get processes for a specific team
   */
  getTeamProcesses(teamId: string): RuntimeProcessInfo[] {
    const processIds = this.processesByTeam.get(teamId);
    if (!processIds) {
      return [];
    }

    return Array.from(processIds)
      .map(id => this.processes.get(id))
      .filter((p): p is RuntimeProcessInfo => p !== undefined);
  }

  /**
   * Get running processes for a team
   */
  getRunningTeamProcesses(teamId: string): RuntimeProcessInfo[] {
    return this.getTeamProcesses(teamId).filter(p => p.status === 'running');
  }

  /**
   * Update process status
   */
  updateProcessStatus(processId: string, status: RuntimeProcessInfo['status']): void {
    const processInfo = this.processes.get(processId);
    if (processInfo) {
      const oldStatus = processInfo.status;
      processInfo.status = status;
      processInfo.lastActivity = Date.now();
      
      this.emit('processStatusChanged', processInfo, oldStatus, status);
    }
  }

  /**
   * Update process health status
   */
  updateProcessHealth(processId: string, healthStatus: RuntimeProcessInfo['healthStatus']): void {
    const processInfo = this.processes.get(processId);
    if (processInfo) {
      const oldHealth = processInfo.healthStatus;
      processInfo.healthStatus = healthStatus;
      processInfo.lastHealthCheck = Date.now();
      
      this.emit('processHealthChanged', processInfo, oldHealth, healthStatus);
    }
  }

  /**
   * Increment message count for a process
   */
  incrementMessageCount(processId: string): void {
    const processInfo = this.processes.get(processId);
    if (processInfo) {
      processInfo.messageCount++;
      processInfo.lastActivity = Date.now();
    }
  }

  /**
   * Increment error count for a process
   */
  incrementErrorCount(processId: string): void {
    const processInfo = this.processes.get(processId);
    if (processInfo) {
      processInfo.errorCount++;
      processInfo.lastActivity = Date.now();
    }
  }

  /**
   * Clear all processes for a team (used when team uninstalls all servers)
   */
  clearTeamProcesses(teamId: string): RuntimeProcessInfo[] {
    const teamProcesses = this.getTeamProcesses(teamId);
    
    for (const processInfo of teamProcesses) {
      this.removeProcess(processInfo.id);
    }

    return teamProcesses;
  }

  /**
   * Clear all processes
   */
  clearAllProcesses(): RuntimeProcessInfo[] {
    const allProcesses = this.getAllProcesses();
    
    this.processes.clear();
    this.processesByName.clear();
    this.processesByTeam.clear();

    this.emit('allProcessesCleared', allProcesses);
    return allProcesses;
  }

  /**
   * Get runtime state snapshot for a specific team
   * Note: teamId is required (no "current team" concept in multi-tenant satellite)
   */
  getSnapshot(teamId: string): RuntimeStateSnapshot {
    if (!teamId) {
      return {
        teamId: '',
        teamName: '',
        processes: [],
        totalProcesses: 0,
        runningProcesses: 0,
        failedProcesses: 0,
        lastUpdated: Date.now()
      };
    }

    const processes = this.getTeamProcesses(teamId);
    const runningProcesses = processes.filter(p => p.status === 'running').length;
    const failedProcesses = processes.filter(p => p.status === 'failed').length;

    return {
      teamId: teamId,
      teamName: processes[0]?.teamId || '',
      processes,
      totalProcesses: processes.length,
      runningProcesses,
      failedProcesses,
      lastUpdated: Date.now()
    };
  }

  /**
   * Check if any processes are running for a team
   */
  hasRunningProcesses(teamId: string): boolean {
    if (!teamId) {
      return false;
    }

    return this.getRunningTeamProcesses(teamId).length > 0;
  }

  /**
   * Get process count by status for a team (or all teams if not specified)
   */
  getProcessCountByStatus(teamId?: string): Record<string, number> {
    const processes = teamId ? this.getTeamProcesses(teamId) : this.getAllProcesses();
    
    const counts: Record<string, number> = {
      starting: 0,
      running: 0,
      terminating: 0,
      terminated: 0,
      failed: 0
    };

    for (const process of processes) {
      counts[process.status] = (counts[process.status] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get statistics for all teams
   */
  getAllTeamsStats(): Array<{
    teamId: string;
    totalProcesses: number;
    runningProcesses: number;
    failedProcesses: number;
  }> {
    const stats: Array<{
      teamId: string;
      totalProcesses: number;
      runningProcesses: number;
      failedProcesses: number;
    }> = [];

    for (const teamId of this.processesByTeam.keys()) {
      const processes = this.getTeamProcesses(teamId);
      stats.push({
        teamId,
        totalProcesses: processes.length,
        runningProcesses: processes.filter(p => p.status === 'running').length,
        failedProcesses: processes.filter(p => p.status === 'failed').length
      });
    }

    return stats;
  }

  /**
   * Mark a process as dormant and store its config for respawning
   */
  markProcessDormant(installationName: string, config: MCPServerConfig): void {
    this.dormantProcessConfigs.set(installationName, config);
    this.emit('processDormant', installationName, config);
  }

  /**
   * Get dormant process config by installation name
   */
  getDormantConfig(installationName: string): MCPServerConfig | null {
    return this.dormantProcessConfigs.get(installationName) || null;
  }

  /**
   * Remove dormant process config (after respawning or uninstall)
   */
  removeDormantConfig(installationName: string): void {
    this.dormantProcessConfigs.delete(installationName);
  }

  /**
   * Clear dormant config for a server (returns true if it existed)
   * Used for redeploy to force fresh download from GitHub
   */
  clearDormantConfig(installationName: string): boolean {
    return this.dormantProcessConfigs.delete(installationName);
  }

  /**
   * Remove a server completely by installation name (handles both active and dormant)
   * This is the method to call when a server is being uninstalled
   */
  removeServerByName(installationName: string): { active: boolean; dormant: boolean } {
    const result = { active: false, dormant: false };

    // Check if active process exists
    const processId = this.processesByName.get(installationName);
    if (processId) {
      this.removeProcess(processId);
      result.active = true;
    }

    // Check if dormant config exists
    if (this.dormantProcessConfigs.has(installationName)) {
      this.dormantProcessConfigs.delete(installationName);
      result.dormant = true;
    }

    return result;
  }

  /**
   * Get count of dormant processes
   */
  getDormantCount(): number {
    return this.dormantProcessConfigs.size;
  }

  /**
   * Get all dormant process names
   */
  getAllDormantProcessNames(): string[] {
    return Array.from(this.dormantProcessConfigs.keys());
  }

  /**
   * Get all dormant process configs
   */
  getAllDormantConfigs(): Array<{ installationName: string; config: MCPServerConfig }> {
    return Array.from(this.dormantProcessConfigs.entries()).map(([name, config]) => ({
      installationName: name,
      config
    }));
  }

  /**
   * Check if a team has any processes (active or dormant) using a specific runtime cache
   * Used to determine if runtime cache directory can be safely deleted
   */
  hasProcessesUsingRuntimeCache(teamId: string, runtime: string): boolean {
    // Check active processes
    const teamProcesses = this.getTeamProcesses(teamId);
    if (teamProcesses.some(p => (p.config.runtime || 'node') === runtime)) {
      return true;
    }

    // Check dormant configs (processes that might respawn)
    for (const dormantConfig of this.dormantProcessConfigs.values()) {
      if (dormantConfig.team_id === teamId &&
          (dormantConfig.runtime || 'node') === runtime) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all processes for a team filtered by runtime
   * Useful for debugging and logging cache cleanup decisions
   */
  getTeamProcessesByRuntime(teamId: string, runtime: string): RuntimeProcessInfo[] {
    return this.getTeamProcesses(teamId)
      .filter(p => (p.config.runtime || 'node') === runtime);
  }
}
