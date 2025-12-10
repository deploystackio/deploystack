/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProcessManager } from '../../process/manager';
import { RuntimeState } from '../../process/runtime-state';
import { UnifiedToolDiscoveryManager } from '../../services/unified-tool-discovery-manager';
import { DynamicConfigManager } from '../../services/dynamic-config-manager';
import { TeamIsolationService } from '../../services/team-isolation-service';
import { getVersionString } from '../../config/version';

interface ServerInfo {
  installation_name: string;
  installation_id: string;
  team_id: string;
  team_slug: string;
  server_slug: string;
  transport_type: string;
  status: string;
  command: string;
  args: string[];
  pid?: number;
  uptime_ms?: number;
  message_count?: number;
  error_count?: number;
  last_activity?: string;
  restart_count?: number;
  url?: string;
  message?: string;
}

interface TeamServers {
  running: ServerInfo[];
  dormant: ServerInfo[];
  configured: ServerInfo[];
}

const serverInfoSchema = {
  type: 'object',
  properties: {
    installation_name: { type: 'string' },
    installation_id: { type: 'string' },
    team_id: { type: 'string' },
    team_slug: { type: 'string' },
    server_slug: { type: 'string' },
    transport_type: { type: 'string' },
    status: { type: 'string' },
    command: { type: 'string' },
    args: { type: 'array', items: { type: 'string' } },
    pid: { type: 'number' },
    uptime_ms: { type: 'number' },
    message_count: { type: 'number' },
    error_count: { type: 'number' },
    last_activity: { type: 'string' },
    restart_count: { type: 'number' },
    url: { type: 'string' },
    message: { type: 'string' }
  }
};

const debugSchema = {
  tags: ['Debug'],
  summary: 'Get comprehensive debug information grouped by team',
  description: 'Returns detailed information about MCP servers grouped by team, showing running, dormant, and configured servers separately. Includes discovered tools and system state. Requires DEPLOYSTACK_STATUS_SHOW_MCP_DEBUG_ROUTE=true.',
  response: {
    200: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        satellite_info: {
          type: 'object',
          properties: {
            satellite_id: { type: 'string' },
            version: { type: 'string' },
            uptime_ms: { type: 'number' }
          }
        },
        servers_by_team: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              running: {
                type: 'array',
                items: serverInfoSchema
              },
              dormant: {
                type: 'array',
                items: serverInfoSchema
              },
              configured: {
                type: 'array',
                items: serverInfoSchema
              }
            }
          }
        },
        summary: {
          type: 'object',
          properties: {
            total_teams: { type: 'number' },
            total_running: { type: 'number' },
            total_dormant: { type: 'number' },
            total_configured: { type: 'number' },
            total_servers: { type: 'number' }
          }
        },
        tools: {
          type: 'object',
          properties: {
            total_tools: { type: 'number' },
            tools_by_transport: {
              type: 'object',
              properties: {
                http: { type: 'number' },
                stdio: { type: 'number' }
              }
            },
            tools_by_server: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            all_tools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  namespaced_name: { type: 'string' },
                  original_name: { type: 'string' },
                  server_name: { type: 'string' },
                  transport: { type: 'string' },
                  description: { type: 'string' },
                  discovered_at: { type: 'string' }
                }
              }
            }
          }
        },
        configuration: {
          type: 'object',
          properties: {
            total_servers_configured: { type: 'number' },
            enabled_servers: { type: 'number' },
            disabled_servers: { type: 'number' },
            servers_by_transport: {
              type: 'object',
              properties: {
                http: { type: 'number' },
                stdio: { type: 'number' }
              }
            }
          }
        }
      }
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }
};

export async function registerDebugRoutes(server: FastifyInstance) {
  const processManager = (server as any).processManager as ProcessManager | undefined;
  const runtimeState = (server as any).runtimeState as RuntimeState | undefined;
  const toolDiscoveryManager = (server as any).toolDiscoveryManager as UnifiedToolDiscoveryManager | undefined;
  const dynamicConfigManager = (server as any).dynamicConfigManager as DynamicConfigManager | undefined;
  const teamIsolationService = (server as any).teamIsolationService as TeamIsolationService | undefined;

  if (!processManager || !runtimeState || !toolDiscoveryManager || !dynamicConfigManager) {
    server.log.error('Required services not found on server instance');
    throw new Error('Required services not initialized');
  }

  server.get('/api/status/debug', {
    schema: debugSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const debugRouteEnabled = process.env.DEPLOYSTACK_STATUS_SHOW_MCP_DEBUG_ROUTE === 'true';

    if (!debugRouteEnabled) {
      request.log.warn({
        operation: 'debug_endpoint_disabled',
        client_ip: request.ip,
        endpoint: '/api/status/debug'
      }, 'Debug endpoint access denied - route disabled via environment variable');

      return reply.code(403).send({
        error: 'Access Denied',
        message: 'Debug endpoint is disabled. Set DEPLOYSTACK_STATUS_SHOW_MCP_DEBUG_ROUTE=true to enable.'
      });
    }

    request.log.info({
      operation: 'debug_endpoint_access',
      endpoint: '/api/status/debug'
    }, 'Debug information requested');

    try {
      const allProcesses = processManager.getAllProcesses();
      const allRuntimeProcesses = runtimeState.getAllProcesses();
      const dormantConfigs = runtimeState.getAllDormantConfigs();
      const currentConfig = dynamicConfigManager.getCurrentConfiguration();
      const configStats = dynamicConfigManager.getStats();
      const toolStats = toolDiscoveryManager.getStats();
      const allTools = toolDiscoveryManager.getAllTools();

      const runtimeStatus: Record<string, { status: string; restart_count?: number }> = {};
      allRuntimeProcesses.forEach(proc => {
        runtimeStatus[proc.installationName] = {
          status: proc.status,
          restart_count: 0
        };
      });

      const extractTeamInfoSafely = (installationName: string) => {
        try {
          if (teamIsolationService) {
            return teamIsolationService.extractTeamInfo(installationName);
          }
        } catch (error) {
          request.log.debug({
            operation: 'debug_team_info_extraction_failed',
            installation_name: installationName,
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to extract team info');
        }
        return { serverSlug: 'unknown', teamSlug: 'unknown', installationId: 'unknown' };
      };

      const serversByTeam: Record<string, TeamServers> = {};

      for (const processInfo of allProcesses) {
        const teamId = processInfo.config.team_id;
        if (!serversByTeam[teamId]) {
          serversByTeam[teamId] = { running: [], dormant: [], configured: [] };
        }

        const status = runtimeStatus[processInfo.config.installation_name];
        const teamInfo = extractTeamInfoSafely(processInfo.config.installation_name);

        serversByTeam[teamId].running.push({
          installation_name: processInfo.config.installation_name,
          installation_id: processInfo.config.installation_id,
          team_id: processInfo.config.team_id,
          team_slug: teamInfo.teamSlug,
          server_slug: teamInfo.serverSlug,
          transport_type: 'stdio',
          status: status?.status || processInfo.status,
          pid: processInfo.process.pid,
          uptime_ms: Date.now() - processInfo.startTime,
          message_count: processInfo.messageCount,
          error_count: processInfo.errorCount,
          command: processInfo.config.command,
          args: processInfo.config.args,
          last_activity: new Date(processInfo.lastActivity).toISOString(),
          restart_count: status?.restart_count || 0
        });
      }

      for (const { installationName, config } of dormantConfigs) {
        const teamId = config.team_id;
        if (!serversByTeam[teamId]) {
          serversByTeam[teamId] = { running: [], dormant: [], configured: [] };
        }

        const teamInfo = extractTeamInfoSafely(installationName);

        serversByTeam[teamId].dormant.push({
          installation_name: installationName,
          installation_id: config.installation_id,
          team_id: config.team_id,
          team_slug: teamInfo.teamSlug,
          server_slug: teamInfo.serverSlug,
          transport_type: 'stdio',
          status: 'dormant',
          command: config.command,
          args: config.args,
          message: 'Process terminated due to inactivity, will respawn on next request'
        });
      }

      const runningNames = new Set(allProcesses.map(p => p.config.installation_name));
      const dormantNames = new Set(dormantConfigs.map(d => d.installationName));

      for (const [serverName, serverConfig] of Object.entries(currentConfig.servers)) {
        if (serverConfig.enabled === false) continue;
        if (runningNames.has(serverName) || dormantNames.has(serverName)) continue;

        const teamId = serverConfig.team_id || 'unknown';
        if (!serversByTeam[teamId]) {
          serversByTeam[teamId] = { running: [], dormant: [], configured: [] };
        }

        const teamInfo = extractTeamInfoSafely(serverName);

        serversByTeam[teamId].configured.push({
          installation_name: serverName,
          installation_id: serverConfig.installation_id || 'unknown',
          team_id: teamId,
          team_slug: teamInfo.teamSlug,
          server_slug: teamInfo.serverSlug,
          transport_type: serverConfig.transport_type || serverConfig.type || 'unknown',
          status: 'configured',
          command: serverConfig.command || serverConfig.url || '',
          args: serverConfig.args || [],
          url: serverConfig.url,
          message: 'Server configured but not yet started'
        });
      }

      let totalRunning = 0;
      let totalDormant = 0;
      let totalConfigured = 0;
      for (const teamData of Object.values(serversByTeam)) {
        totalRunning += teamData.running.length;
        totalDormant += teamData.dormant.length;
        totalConfigured += teamData.configured.length;
      }

      const toolsData = allTools.map(tool => ({
        namespaced_name: tool.namespacedName,
        original_name: tool.originalName,
        server_name: tool.serverName,
        transport: tool.transport,
        description: tool.description,
        discovered_at: tool.discoveredAt?.toISOString()
      }));

      const httpTools = allTools.filter(t => t.transport === 'http').length;
      const stdioTools = allTools.filter(t => t.transport === 'stdio').length;

      const httpServers = Object.values(currentConfig.servers)
        .filter(s => s.enabled !== false && (s.transport_type === 'http' || s.type === 'http')).length;
      const stdioServers = Object.values(currentConfig.servers)
        .filter(s => s.enabled !== false && (s.transport_type === 'stdio' || s.type === 'stdio')).length;

      // Phase 10: Get server availability status
      const serverStatusMap = toolDiscoveryManager.getAllServerStatuses();
      const serverStatusStats = toolDiscoveryManager.getServerStatusStats();
      const serverStatusData: Record<string, { status: string; last_updated: string; message?: string }> = {};
      for (const [serverSlug, entry] of serverStatusMap) {
        serverStatusData[serverSlug] = {
          status: entry.status,
          last_updated: entry.lastUpdated.toISOString(),
          message: entry.message
        };
      }

      const debugInfo = {
        timestamp: new Date().toISOString(),
        satellite_info: {
          satellite_id: process.env.SATELLITE_ID || 'unknown',
          version: getVersionString(),
          uptime_ms: process.uptime() * 1000
        },
        servers_by_team: serversByTeam,
        summary: {
          total_teams: Object.keys(serversByTeam).length,
          total_running: totalRunning,
          total_dormant: totalDormant,
          total_configured: totalConfigured,
          total_servers: totalRunning + totalDormant + totalConfigured
        },
        // Phase 10: Server availability status
        server_status: {
          stats: serverStatusStats,
          servers: serverStatusData
        },
        tools: {
          total_tools: allTools.length,
          tools_by_transport: {
            http: httpTools,
            stdio: stdioTools
          },
          tools_by_server: toolStats.stdio.tools_by_server,
          all_tools: toolsData
        },
        configuration: {
          total_servers_configured: configStats.total_servers,
          enabled_servers: configStats.enabled_servers,
          disabled_servers: configStats.disabled_servers,
          servers_by_transport: {
            http: httpServers,
            stdio: stdioServers
          }
        }
      };

      request.log.info({
        operation: 'debug_endpoint_success',
        total_teams: Object.keys(serversByTeam).length,
        total_running: totalRunning,
        total_dormant: totalDormant,
        total_configured: totalConfigured,
        total_tools: allTools.length
      }, 'Debug information retrieved successfully');

      return reply.code(200).send(debugInfo);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      request.log.error({
        operation: 'debug_endpoint_error',
        error: errorMessage
      }, 'Failed to retrieve debug information');

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: errorMessage
      });
    }
  });

  const debugRouteEnabled = process.env.DEPLOYSTACK_STATUS_SHOW_MCP_DEBUG_ROUTE === 'true';
  server.log.info({
    operation: 'routes_registered',
    routes: ['/api/status/debug'],
    enabled: debugRouteEnabled
  }, `Debug routes registered (${debugRouteEnabled ? 'enabled' : 'disabled'})`);
}
