import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProcessManager } from '../../process/manager';
import { RuntimeState } from '../../process/runtime-state';
import { UnifiedToolDiscoveryManager } from '../../services/unified-tool-discovery-manager';
import { DynamicConfigManager } from '../../services/dynamic-config-manager';
import { TeamIsolationService } from '../../services/team-isolation-service';

const debugSchema = {
  tags: ['Debug'],
  summary: 'Get comprehensive debug information',
  description: 'Returns detailed information about running MCP servers, discovered tools, team isolation, and system state. Requires DEPLOYSTACK_STATUS_SHOW_MCP_DEBUG_ROUTE=true.',
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
        mcp_servers: {
          type: 'object',
          properties: {
            total_configured: { type: 'number' },
            total_running: { type: 'number' },
            servers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  installation_name: { type: 'string' },
                  installation_id: { type: 'string' },
                  team_id: { type: 'string' },
                  team_slug: { type: 'string' },
                  server_slug: { type: 'string' },
                  transport_type: { type: 'string' },
                  status: { type: 'string' },
                  pid: { type: 'number' },
                  uptime_ms: { type: 'number' },
                  message_count: { type: 'number' },
                  error_count: { type: 'number' },
                  command: { type: 'string' },
                  args: { type: 'array', items: { type: 'string' } },
                  url: { type: 'string' }
                }
              }
            }
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
  // Get services from server instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processManager = (server as any).processManager as ProcessManager | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtimeState = (server as any).runtimeState as RuntimeState | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolDiscoveryManager = (server as any).toolDiscoveryManager as UnifiedToolDiscoveryManager | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dynamicConfigManager = (server as any).dynamicConfigManager as DynamicConfigManager | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamIsolationService = (server as any).teamIsolationService as TeamIsolationService | undefined;

  if (!processManager || !runtimeState || !toolDiscoveryManager || !dynamicConfigManager) {
    server.log.error('Required services not found on server instance (processManager, runtimeState, toolDiscoveryManager, or dynamicConfigManager)');
    throw new Error('Required services not initialized');
  }

  server.get('/api/status/debug', {
    schema: debugSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if debug route is enabled via environment variable
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
      // Get all running processes
      const allProcesses = processManager.getAllProcesses();
      const allRuntimeProcesses = runtimeState.getAllProcesses();
      const runtimeStatus: Record<string, { status: string; restart_count?: number }> = {};
      allRuntimeProcesses.forEach(proc => {
        runtimeStatus[proc.installationName] = {
          status: proc.status,
          restart_count: 0 // RuntimeState doesn't track restart count
        };
      });

      // Get current configuration
      const currentConfig = dynamicConfigManager.getCurrentConfiguration();
      const configStats = dynamicConfigManager.getStats();

      // Get tool discovery stats
      const toolStats = toolDiscoveryManager.getStats();
      const allTools = toolDiscoveryManager.getAllTools();

      // Build server information
      const servers = allProcesses.map(processInfo => {
        const status = runtimeStatus[processInfo.config.installation_name];
        let teamInfo = { serverSlug: 'unknown', teamSlug: 'unknown', installationId: 'unknown' };
        
        try {
          if (teamIsolationService) {
            teamInfo = teamIsolationService.extractTeamInfo(processInfo.config.installation_name);
          }
        } catch (error) {
          request.log.debug({
            operation: 'debug_team_info_extraction_failed',
            installation_name: processInfo.config.installation_name,
            error: error instanceof Error ? error.message : String(error)
          }, 'Failed to extract team info');
        }

        return {
          installation_name: processInfo.config.installation_name,
          installation_id: processInfo.config.installation_id,
          team_id: processInfo.config.team_id,
          team_slug: teamInfo.teamSlug,
          server_slug: teamInfo.serverSlug,
          transport_type: 'stdio', // ProcessManager only handles stdio processes
          status: status?.status || processInfo.status,
          pid: processInfo.process.pid,
          uptime_ms: Date.now() - processInfo.startTime,
          message_count: processInfo.messageCount,
          error_count: processInfo.errorCount,
          command: processInfo.config.command,
          args: processInfo.config.args,
          last_activity: new Date(processInfo.lastActivity).toISOString(),
          restart_count: status?.restart_count || 0
        };
      });

      // Add configured but not running servers
      const runningNames = new Set(allProcesses.map(p => p.config.installation_name));
      const configuredServers = Object.entries(currentConfig.servers)
        .filter(([_, config]) => config.enabled !== false)
        .map(([serverName, serverConfig]) => {
          if (runningNames.has(serverName)) {
            return null; // Already included in running servers
          }

          const status = runtimeStatus[serverName];
          let teamInfo = { serverSlug: 'unknown', teamSlug: 'unknown', installationId: 'unknown' };
          
          try {
            if (teamIsolationService) {
              teamInfo = teamIsolationService.extractTeamInfo(serverName);
            }
          } catch {
            // Ignore extraction errors for non-running servers
          }

          return {
            installation_name: serverName,
            installation_id: serverConfig.installation_id || 'unknown',
            team_id: serverConfig.team_id || 'unknown',
            team_slug: teamInfo.teamSlug,
            server_slug: teamInfo.serverSlug,
            transport_type: serverConfig.transport_type || serverConfig.type || 'unknown',
            status: status?.status || 'configured',
            uptime_ms: 0,
            message_count: 0,
            error_count: 0,
            command: serverConfig.command || serverConfig.url || '',
            args: serverConfig.args || [],
            url: serverConfig.url,
            restart_count: status?.restart_count || 0
          };
        })
        .filter(Boolean);

      const allServers = [...servers, ...configuredServers];

      // Build tools information
      const toolsData = allTools.map(tool => ({
        namespaced_name: tool.namespacedName,
        original_name: tool.originalName,
        server_name: tool.serverName,
        transport: tool.transport,
        description: tool.description,
        discovered_at: tool.discoveredAt?.toISOString()
      }));

      // Count tools by transport
      const httpTools = allTools.filter(t => t.transport === 'http').length;
      const stdioTools = allTools.filter(t => t.transport === 'stdio').length;

      // Count servers by transport type
      const httpServers = Object.values(currentConfig.servers)
        .filter(s => s.enabled !== false && (s.transport_type === 'http' || s.type === 'http')).length;
      const stdioServers = Object.values(currentConfig.servers)
        .filter(s => s.enabled !== false && (s.transport_type === 'stdio' || s.type === 'stdio')).length;

      // Build response
      const debugInfo = {
        timestamp: new Date().toISOString(),
        satellite_info: {
          satellite_id: process.env.SATELLITE_ID || 'unknown',
          version: '1.0.0',
          uptime_ms: process.uptime() * 1000
        },
        mcp_servers: {
          total_configured: Object.keys(currentConfig.servers).filter(k => 
            currentConfig.servers[k].enabled !== false
          ).length,
          total_running: allProcesses.length,
          servers: allServers
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
          },
          last_update: new Date().toISOString() // ConfigStats doesn't track last_update timestamp
        }
      };

      request.log.info({
        operation: 'debug_endpoint_success',
        total_servers: allServers.length,
        running_servers: allProcesses.length,
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
