import { EventEmitter } from 'events';
import { MCPServerConfig } from '../../types/mcp';
import { ProcessInfo } from './manager';

export interface RuntimeProcessInfo extends ProcessInfo {
  installationId: string;
  installationName: string;
  teamId: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: number;
}

export interface RuntimeStateSnapshot {
  teamId: string;
  teamName: string;
  processes: RuntimeProcessInfo[];
  totalProcesses: number;
  runningProcesses: number;
  failedProcesses: number;
  lastUpdated: number;
}

/**
 * Runtime state management for MCP server processes
 * Maintains in-memory state of all running MCP servers
 */
export class RuntimeState extends EventEmitter {
  private processes = new Map<string, RuntimeProcessInfo>();
  private processesByName = new Map<string, string>();
  private processesByTeam = new Map<string, Set<string>>();
  private currentTeamId: string | null = null;

  constructor() {
    super();
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
   * Get all processes
   */
  getAllProcesses(): RuntimeProcessInfo[] {
    return Array.from(this.processes.values());
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
   * Set current team context
   */
  setCurrentTeam(teamId: string): void {
    const oldTeamId = this.currentTeamId;
    this.currentTeamId = teamId;
    this.emit('teamChanged', teamId, oldTeamId);
  }

  /**
   * Get current team ID
   */
  getCurrentTeam(): string | null {
    return this.currentTeamId;
  }

  /**
   * Clear all processes for a team (used during team switching)
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
   * Get runtime state snapshot
   */
  getSnapshot(teamId?: string): RuntimeStateSnapshot {
    const targetTeamId = teamId || this.currentTeamId;
    if (!targetTeamId) {
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

    const processes = this.getTeamProcesses(targetTeamId);
    const runningProcesses = processes.filter(p => p.status === 'running').length;
    const failedProcesses = processes.filter(p => p.status === 'failed').length;

    return {
      teamId: targetTeamId,
      teamName: processes[0]?.teamId || '',
      processes,
      totalProcesses: processes.length,
      runningProcesses,
      failedProcesses,
      lastUpdated: Date.now()
    };
  }

  /**
   * Check if any processes are running for current team
   */
  hasRunningProcesses(teamId?: string): boolean {
    const targetTeamId = teamId || this.currentTeamId;
    if (!targetTeamId) {
      return false;
    }

    return this.getRunningTeamProcesses(targetTeamId).length > 0;
  }

  /**
   * Get process count by status
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
   * Find processes that should be running but aren't (based on expected config)
   */
  findMissingProcesses(expectedServers: MCPServerConfig[], teamId?: string): string[] {
    const targetTeamId = teamId || this.currentTeamId;
    if (!targetTeamId) {
      return expectedServers.map(s => s.installation_name);
    }

    const runningProcesses = this.getRunningTeamProcesses(targetTeamId);
    const runningNames = new Set(runningProcesses.map(p => p.installationName));
    
    return expectedServers
      .map(s => s.installation_name)
      .filter(name => !runningNames.has(name));
  }

  /**
   * Find processes that are running but shouldn't be (not in expected config)
   */
  findExtraProcesses(expectedServers: MCPServerConfig[], teamId?: string): RuntimeProcessInfo[] {
    const targetTeamId = teamId || this.currentTeamId;
    if (!targetTeamId) {
      return [];
    }

    const expectedNames = new Set(expectedServers.map(s => s.installation_name));
    const runningProcesses = this.getRunningTeamProcesses(targetTeamId);
    
    return runningProcesses.filter(p => !expectedNames.has(p.installationName));
  }
}
