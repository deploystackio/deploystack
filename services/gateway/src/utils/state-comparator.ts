import { MCPServerConfig } from '../types/mcp';
import { RuntimeProcessInfo, RuntimeState } from '../core/process/runtime-state';

export interface ProcessDiscrepancy {
  type: 'missing' | 'extra' | 'failed' | 'unhealthy';
  installationName: string;
  expected?: MCPServerConfig;
  actual?: RuntimeProcessInfo;
  description: string;
}

export interface StateComparisonResult {
  teamId: string;
  isHealthy: boolean;
  totalExpected: number;
  totalRunning: number;
  totalFailed: number;
  discrepancies: ProcessDiscrepancy[];
  summary: {
    missing: number;
    extra: number;
    failed: number;
    unhealthy: number;
    healthy: number;
  };
}

/**
 * Compares cached configuration (what should be running) with runtime state (what is running)
 */
export class StateComparator {
  private runtimeState: RuntimeState;

  constructor(runtimeState: RuntimeState) {
    this.runtimeState = runtimeState;
  }

  /**
   * Compare expected servers with actual running processes
   */
  compareState(expectedServers: MCPServerConfig[], teamId?: string): StateComparisonResult {
    const targetTeamId = teamId || this.runtimeState.getCurrentTeam();
    if (!targetTeamId) {
      return this.createEmptyResult('');
    }

    const runningProcesses = this.runtimeState.getTeamProcesses(targetTeamId);
    const discrepancies: ProcessDiscrepancy[] = [];

    // Create maps for easier lookup
    const expectedByName = new Map(expectedServers.map(s => [s.installation_name, s]));
    const runningByName = new Map(runningProcesses.map(p => [p.installationName, p]));

    // Find missing processes (should be running but aren't)
    for (const expectedServer of expectedServers) {
      const runningProcess = runningByName.get(expectedServer.installation_name);
      
      if (!runningProcess) {
        discrepancies.push({
          type: 'missing',
          installationName: expectedServer.installation_name,
          expected: expectedServer,
          description: `Expected MCP server "${expectedServer.installation_name}" is not running`
        });
      } else if (runningProcess.status === 'failed') {
        discrepancies.push({
          type: 'failed',
          installationName: expectedServer.installation_name,
          expected: expectedServer,
          actual: runningProcess,
          description: `MCP server "${expectedServer.installation_name}" failed to start or crashed`
        });
      } else if (runningProcess.status === 'running' && runningProcess.healthStatus === 'unhealthy') {
        discrepancies.push({
          type: 'unhealthy',
          installationName: expectedServer.installation_name,
          expected: expectedServer,
          actual: runningProcess,
          description: `MCP server "${expectedServer.installation_name}" is running but unhealthy`
        });
      }
    }

    // Find extra processes (running but not expected)
    for (const runningProcess of runningProcesses) {
      if (!expectedByName.has(runningProcess.installationName)) {
        discrepancies.push({
          type: 'extra',
          installationName: runningProcess.installationName,
          actual: runningProcess,
          description: `MCP server "${runningProcess.installationName}" is running but not in configuration`
        });
      }
    }

    // Calculate summary
    const summary = {
      missing: discrepancies.filter(d => d.type === 'missing').length,
      extra: discrepancies.filter(d => d.type === 'extra').length,
      failed: discrepancies.filter(d => d.type === 'failed').length,
      unhealthy: discrepancies.filter(d => d.type === 'unhealthy').length,
      healthy: 0
    };

    // Calculate healthy processes
    const runningHealthy = runningProcesses.filter(p => 
      p.status === 'running' && 
      p.healthStatus !== 'unhealthy' &&
      expectedByName.has(p.installationName)
    ).length;
    
    summary.healthy = runningHealthy;

    const isHealthy = discrepancies.length === 0 && expectedServers.length > 0;
    const totalRunning = runningProcesses.filter(p => p.status === 'running').length;
    const totalFailed = runningProcesses.filter(p => p.status === 'failed').length;

    return {
      teamId: targetTeamId,
      isHealthy,
      totalExpected: expectedServers.length,
      totalRunning,
      totalFailed,
      discrepancies,
      summary
    };
  }

  /**
   * Get a quick health check for the current team
   */
  getHealthStatus(expectedServers: MCPServerConfig[], teamId?: string): {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'no-config';
    message: string;
    runningCount: number;
    expectedCount: number;
  } {
    if (expectedServers.length === 0) {
      return {
        status: 'no-config',
        message: 'No MCP servers configured',
        runningCount: 0,
        expectedCount: 0
      };
    }

    const comparison = this.compareState(expectedServers, teamId);

    if (comparison.isHealthy) {
      return {
        status: 'healthy',
        message: `All ${comparison.totalExpected} MCP servers are running normally`,
        runningCount: comparison.totalRunning,
        expectedCount: comparison.totalExpected
      };
    }

    const { summary } = comparison;
    
    if (summary.healthy > 0 && (summary.missing > 0 || summary.failed > 0 || summary.unhealthy > 0)) {
      return {
        status: 'degraded',
        message: `${summary.healthy}/${comparison.totalExpected} MCP servers healthy (${summary.missing} missing, ${summary.failed} failed, ${summary.unhealthy} unhealthy)`,
        runningCount: comparison.totalRunning,
        expectedCount: comparison.totalExpected
      };
    }

    return {
      status: 'unhealthy',
      message: `No healthy MCP servers (${summary.missing} missing, ${summary.failed} failed, ${summary.unhealthy} unhealthy)`,
      runningCount: comparison.totalRunning,
      expectedCount: comparison.totalExpected
    };
  }

  /**
   * Get processes that need attention (missing, failed, unhealthy)
   */
  getProcessesNeedingAttention(expectedServers: MCPServerConfig[], teamId?: string): ProcessDiscrepancy[] {
    const comparison = this.compareState(expectedServers, teamId);
    return comparison.discrepancies.filter(d => d.type !== 'extra');
  }

  /**
   * Get extra processes that should be stopped
   */
  getExtraProcesses(expectedServers: MCPServerConfig[], teamId?: string): ProcessDiscrepancy[] {
    const comparison = this.compareState(expectedServers, teamId);
    return comparison.discrepancies.filter(d => d.type === 'extra');
  }

  /**
   * Check if a specific server is running as expected
   */
  isServerHealthy(serverName: string, expectedServers: MCPServerConfig[], teamId?: string): {
    isHealthy: boolean;
    status: 'missing' | 'failed' | 'unhealthy' | 'healthy' | 'not-expected';
    process?: RuntimeProcessInfo;
    expected?: MCPServerConfig;
  } {
    const targetTeamId = teamId || this.runtimeState.getCurrentTeam();
    if (!targetTeamId) {
      return { isHealthy: false, status: 'missing' };
    }

    const expectedServer = expectedServers.find(s => s.installation_name === serverName);
    const runningProcess = this.runtimeState.getProcessByName(serverName);

    if (!expectedServer) {
      return {
        isHealthy: false,
        status: 'not-expected',
        process: runningProcess || undefined
      };
    }

    if (!runningProcess) {
      return {
        isHealthy: false,
        status: 'missing',
        expected: expectedServer
      };
    }

    if (runningProcess.status === 'failed') {
      return {
        isHealthy: false,
        status: 'failed',
        process: runningProcess,
        expected: expectedServer
      };
    }

    if (runningProcess.status === 'running' && runningProcess.healthStatus === 'unhealthy') {
      return {
        isHealthy: false,
        status: 'unhealthy',
        process: runningProcess,
        expected: expectedServer
      };
    }

    if (runningProcess.status === 'running') {
      return {
        isHealthy: true,
        status: 'healthy',
        process: runningProcess,
        expected: expectedServer
      };
    }

    return {
      isHealthy: false,
      status: 'missing',
      expected: expectedServer
    };
  }

  /**
   * Get detailed status report for display
   */
  getStatusReport(expectedServers: MCPServerConfig[], teamId?: string): {
    overall: StateComparisonResult;
    serverDetails: Array<{
      name: string;
      status: 'healthy' | 'missing' | 'failed' | 'unhealthy' | 'extra';
      runtime?: string;
      uptime?: number;
      messageCount?: number;
      errorCount?: number;
      lastActivity?: number;
      pid?: number;
    }>;
  } {
    const overall = this.compareState(expectedServers, teamId);
    const serverDetails: Array<{
      name: string;
      status: 'healthy' | 'missing' | 'failed' | 'unhealthy' | 'extra';
      runtime?: string;
      uptime?: number;
      messageCount?: number;
      errorCount?: number;
      lastActivity?: number;
      pid?: number;
    }> = [];

    // Add expected servers
    for (const expectedServer of expectedServers) {
      const serverHealth = this.isServerHealthy(expectedServer.installation_name, expectedServers, teamId);
      
      serverDetails.push({
        name: expectedServer.installation_name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: serverHealth.status as any,
        runtime: expectedServer.runtime,
        uptime: serverHealth.process ? Date.now() - serverHealth.process.startTime : undefined,
        messageCount: serverHealth.process?.messageCount,
        errorCount: serverHealth.process?.errorCount,
        lastActivity: serverHealth.process?.lastActivity,
        pid: serverHealth.process?.process.pid
      });
    }

    // Add extra processes
    const extraProcesses = this.getExtraProcesses(expectedServers, teamId);
    for (const extra of extraProcesses) {
      if (extra.actual) {
         
        serverDetails.push({
          name: extra.actual.installationName,
          status: 'extra',
          runtime: extra.actual.config.runtime,
          uptime: Date.now() - extra.actual.startTime,
          messageCount: extra.actual.messageCount,
          errorCount: extra.actual.errorCount,
          lastActivity: extra.actual.lastActivity,
          pid: extra.actual.process.pid
        });
      }
    }

    return {
      overall,
      serverDetails
    };
  }

  /**
   * Create empty result for when no team is selected
   */
  private createEmptyResult(teamId: string): StateComparisonResult {
    return {
      teamId,
      isHealthy: true,
      totalExpected: 0,
      totalRunning: 0,
      totalFailed: 0,
      discrepancies: [],
      summary: {
        missing: 0,
        extra: 0,
        failed: 0,
        unhealthy: 0,
        healthy: 0
      }
    };
  }
}
