import { Logger } from 'pino';
import { ProcessManager } from '../process/manager';
import { RuntimeState } from '../process/runtime-state';
import { UnifiedToolDiscoveryManager } from './unified-tool-discovery-manager';
import { DynamicConfigManager } from './dynamic-config-manager';
import { TeamIsolationService } from './team-isolation-service';

/**
 * Normalized heartbeat data structure optimized for scale
 * Designed for 1000+ teams with 3+ MCP servers each
 */
export interface NormalizedHeartbeatData {
  timestamp: string;
  satellite_info: {
    satellite_id: string;
    version: string;
    uptime_ms: number;
  };
  summary: {
    total_teams: number;
    total_servers: number;
    total_tools: number;
    running_servers: number;
    healthy_servers: number;
  };
  teams: Record<string, TeamData>;
  servers: Record<string, ServerData>;
  tools: Record<string, ToolData>;
}

interface TeamData {
  team_id: string;
  team_slug: string;
  server_ids: string[];
}

interface ServerData {
  installation_name: string;
  installation_id: string;
  server_slug: string;
  transport_type: 'stdio' | 'http';
  status: string;
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  tool_ids: string[];
  // Metrics
  uptime_ms?: number;
  message_count?: number;
  error_count?: number;
  pid?: number;
}

interface ToolData {
  namespaced_name: string;
  original_name: string;
  transport: 'stdio' | 'http';
  description: string;
}

/**
 * HeartbeatDataBuilder
 * 
 * Builds normalized, DRY heartbeat data optimized for large-scale deployments.
 * Eliminates data repetition by using reference IDs between teams, servers, and tools.
 */
export class HeartbeatDataBuilder {
  constructor(
    private processManager: ProcessManager,
    private runtimeState: RuntimeState,
    private toolDiscoveryManager: UnifiedToolDiscoveryManager,
    private dynamicConfigManager: DynamicConfigManager,
    private teamIsolationService: TeamIsolationService | undefined,
    private logger: Logger
  ) {}

  /**
   * Build normalized heartbeat data structure
   */
  buildHeartbeatData(): NormalizedHeartbeatData {
    const startTime = Date.now();
    
    // Get all data sources
    const allProcesses = this.processManager.getAllProcesses();
    const allRuntimeProcesses = this.runtimeState.getAllProcesses();
    const currentConfig = this.dynamicConfigManager.getCurrentConfiguration();
    const allTools = this.toolDiscoveryManager.getAllTools();

    // Build normalized structures
    const teams: Record<string, TeamData> = {};
    const servers: Record<string, ServerData> = {};
    const tools: Record<string, ToolData> = {};

    // Build runtime status lookup
    const runtimeStatus: Record<string, { status: string }> = {};
    allRuntimeProcesses.forEach(proc => {
      runtimeStatus[proc.installationName] = { status: proc.status };
    });

    // Process running servers
    let healthyCount = 0;
    for (const processInfo of allProcesses) {
      const installationName = processInfo.config.installation_name;
      const serverId = installationName; // Use installation_name as unique server ID

      // Extract team info
      let teamInfo = { serverSlug: 'unknown', teamSlug: 'unknown', installationId: 'unknown' };
      try {
        if (this.teamIsolationService) {
          teamInfo = this.teamIsolationService.extractTeamInfo(installationName);
        }
      } catch (error) {
        this.logger.debug({
          operation: 'heartbeat_team_info_extraction_failed',
          installation_name: installationName,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to extract team info');
      }

      const teamId = processInfo.config.team_id;
      const teamSlug = teamInfo.teamSlug;
      const teamKey = `${teamSlug}_${teamId}`;

      // Initialize team if not exists
      if (!teams[teamKey]) {
        teams[teamKey] = {
          team_id: teamId,
          team_slug: teamSlug,
          server_ids: []
        };
      }

      // Add server to team
      teams[teamKey].server_ids.push(serverId);

      // Determine health status
      const isHealthy = processInfo.status === 'running' && processInfo.errorCount === 0;
      if (isHealthy) healthyCount++;

      // Get tool IDs for this server
      const serverTools = allTools.filter(t => t.serverName === installationName);
      const toolIds = serverTools.map(t => t.namespacedName);

      // Add server data
      servers[serverId] = {
        installation_name: installationName,
        installation_id: processInfo.config.installation_id,
        server_slug: teamInfo.serverSlug,
        transport_type: 'stdio',
        status: runtimeStatus[installationName]?.status || processInfo.status,
        health_status: isHealthy ? 'healthy' : (processInfo.status === 'running' ? 'unhealthy' : 'unknown'),
        tool_ids: toolIds,
        uptime_ms: Date.now() - processInfo.startTime,
        message_count: processInfo.messageCount,
        error_count: processInfo.errorCount,
        pid: processInfo.process.pid
      };

      // Add tools (avoid duplicates)
      for (const tool of serverTools) {
        if (!tools[tool.namespacedName]) {
          // Normalize transport type (sse is a variant of http)
          const normalizedTransport = tool.transport === 'sse' ? 'http' : tool.transport;
          
          tools[tool.namespacedName] = {
            namespaced_name: tool.namespacedName,
            original_name: tool.originalName,
            transport: normalizedTransport as 'stdio' | 'http',
            description: tool.description
          };
        }
      }
    }

    // Process configured but not running servers
    const runningNames = new Set(allProcesses.map(p => p.config.installation_name));
    for (const [serverName, serverConfig] of Object.entries(currentConfig.servers)) {
      if (serverConfig.enabled === false || runningNames.has(serverName)) {
        continue; // Skip disabled or already processed
      }

      const serverId = serverName;

      // Extract team info
      let teamInfo = { serverSlug: 'unknown', teamSlug: 'unknown', installationId: 'unknown' };
      try {
        if (this.teamIsolationService) {
          teamInfo = this.teamIsolationService.extractTeamInfo(serverName);
        }
      } catch {
        // Ignore extraction errors for non-running servers
      }

      const teamId = serverConfig.team_id || 'unknown';
      const teamSlug = teamInfo.teamSlug;
      const teamKey = `${teamSlug}_${teamId}`;

      // Initialize team if not exists
      if (!teams[teamKey]) {
        teams[teamKey] = {
          team_id: teamId,
          team_slug: teamSlug,
          server_ids: []
        };
      }

      // Add server to team
      teams[teamKey].server_ids.push(serverId);

      // Normalize transport type (convert 'sse' to 'http')
      let transportType = serverConfig.transport_type || serverConfig.type || 'unknown';
      if (transportType === 'sse') {
        transportType = 'http'; // SSE is a variant of HTTP transport
      }

      // Add configured server
      servers[serverId] = {
        installation_name: serverName,
        installation_id: serverConfig.installation_id || 'unknown',
        server_slug: teamInfo.serverSlug,
        transport_type: transportType as 'stdio' | 'http',
        status: runtimeStatus[serverName]?.status || 'configured',
        health_status: 'unknown',
        tool_ids: []
      };
    }

    // Add HTTP tools (they may not have running processes)
    const httpTools = allTools.filter(t => t.transport === 'http' || t.transport === 'sse');
    for (const tool of httpTools) {
      if (!tools[tool.namespacedName]) {
        // Normalize transport type (sse is a variant of http)
        const normalizedTransport = tool.transport === 'sse' ? 'http' : tool.transport;
        
        tools[tool.namespacedName] = {
          namespaced_name: tool.namespacedName,
          original_name: tool.originalName,
          transport: normalizedTransport as 'stdio' | 'http',
          description: tool.description
        };
      }

      // Ensure server exists and has this tool
      const serverId = tool.serverName;
      if (servers[serverId]) {
        if (!servers[serverId].tool_ids.includes(tool.namespacedName)) {
          servers[serverId].tool_ids.push(tool.namespacedName);
        }
      }
    }

    const buildTime = Date.now() - startTime;

    this.logger.debug({
      operation: 'heartbeat_data_built',
      teams_count: Object.keys(teams).length,
      servers_count: Object.keys(servers).length,
      tools_count: Object.keys(tools).length,
      build_time_ms: buildTime
    }, 'Normalized heartbeat data built');

    return {
      timestamp: new Date().toISOString(),
      satellite_info: {
        satellite_id: process.env.SATELLITE_ID || 'unknown',
        version: '1.0.0',
        uptime_ms: Math.round(process.uptime() * 1000)
      },
      summary: {
        total_teams: Object.keys(teams).length,
        total_servers: Object.keys(servers).length,
        total_tools: Object.keys(tools).length,
        running_servers: allProcesses.length,
        healthy_servers: healthyCount
      },
      teams,
      servers,
      tools
    };
  }

  /**
   * Build legacy format for backward compatibility
   * (This is what the current debug endpoint returns)
   */
  buildLegacyFormat(): Record<string, unknown> {
    // This would be the current debug.ts format
    // Keep for backward compatibility if needed
    throw new Error('Not implemented - use buildHeartbeatData() for new format');
  }
}
