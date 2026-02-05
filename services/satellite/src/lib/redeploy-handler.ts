import { FastifyBaseLogger } from 'fastify';
import { SatelliteCommand, CommandResult } from '../services/command-polling-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { ProcessManager } from '../process';
import { StdioToolDiscoveryManager } from '../services/stdio-tool-discovery-manager';
import { RemoteToolDiscoveryManager } from '../services/remote-tool-discovery-manager';

export interface RedeployHandlerDependencies {
  logger: FastifyBaseLogger;
  configManager: DynamicConfigManager;
  processManager: ProcessManager | null;
  stdioDiscoveryManager: StdioToolDiscoveryManager | null;
  remoteToolDiscoveryManager: RemoteToolDiscoveryManager | null;
  onConfigurationUpdate: () => Promise<void>;
}

/**
 * Handles MCP server redeployment logic for both stdio and HTTP/SSE servers
 *
 * Responsibilities:
 * - Validate redeploy command payload
 * - Find ALL instances for an installation (not just one user)
 * - Stop ALL instances and delete shared deployment directory (stdio)
 * - Trigger tool re-discovery for ALL instances (HTTP/SSE)
 * - Coordinate config refresh to respawn instances with fresh code
 */
export class RedeployHandler {
  constructor(private deps: RedeployHandlerDependencies) {}

  async handleRedeploy(command: SatelliteCommand): Promise<CommandResult> {
    const { installation_id, team_id, user_id } = command.payload;

    this.deps.logger.info({
      operation: 'mcp_redeploy_received',
      command_id: command.id,
      installation_id,
      team_id,
      user_id
    }, `Processing MCP redeploy command for installation ${installation_id}`);

    // Validate required fields
    if (!installation_id) {
      const errorMsg = 'Missing installation_id in mcp_redeploy payload';
      this.deps.logger.error({
        operation: 'mcp_redeploy_validation_failed',
        command_id: command.id
      }, errorMsg);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMsg
      };
    }

    // Find ALL server instances for this installation (all users)
    const currentConfig = this.deps.configManager.getCurrentConfiguration();
    const instanceNames: string[] = [];
    const serverConfigs: Array<typeof currentConfig.servers[string]> = [];

    for (const [name, config] of Object.entries(currentConfig.servers)) {
      if (config.installation_id === installation_id) {
        instanceNames.push(name);
        serverConfigs.push(config);
      }
    }

    if (instanceNames.length === 0) {
      this.deps.logger.warn({
        operation: 'mcp_redeploy_installation_not_found',
        command_id: command.id,
        installation_id
      }, `No instances found for installation ${installation_id} on this satellite`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          message: 'Installation not found on this satellite',
          installation_id
        }
      };
    }

    const firstConfig = serverConfigs[0];

    // Handle stdio servers (GitHub deployments)
    if (firstConfig.transport_type === 'stdio') {
      if (!this.deps.processManager) {
        const errorMsg = 'ProcessManager not available for stdio server redeploy';
        this.deps.logger.error({
          operation: 'mcp_redeploy_no_process_manager',
          command_id: command.id
        }, errorMsg);

        return {
          command_id: command.id,
          status: 'failed',
          error: errorMsg
        };
      }

      this.deps.logger.info({
        operation: 'mcp_redeploy_stdio_cleanup',
        command_id: command.id,
        installation_id,
        instance_count: instanceNames.length,
        instance_names: instanceNames
      }, `Stopping ${instanceNames.length} instance(s) and deleting deployment directory`);

      const restartStartTime = Date.now();

      try {
        // Stop ALL instances for this installation
        for (const instanceName of instanceNames) {
          this.deps.logger.debug({
            operation: 'mcp_redeploy_removing_instance',
            instance_name: instanceName
          }, `Removing instance: ${instanceName}`);

          await this.deps.processManager.removeServerCompletely(instanceName);
        }

        // Clear tools from cache
        if (this.deps.stdioDiscoveryManager) {
          // Clear tools for ALL instances
          for (const instanceName of instanceNames) {
            this.deps.stdioDiscoveryManager.clearServerTools(instanceName);
          }
        }

        // Wait briefly for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Trigger config refresh (downloads fresh from GitHub and respawns ALL instances)
        await this.deps.onConfigurationUpdate();

        const restartTimeMs = Date.now() - restartStartTime;

        this.deps.logger.info({
          operation: 'mcp_redeploy_success',
          command_id: command.id,
          installation_id,
          instance_count: instanceNames.length,
          restart_time_ms: restartTimeMs
        }, `Redeployed ${instanceNames.length} instance(s) with fresh code (${restartTimeMs}ms)`);

        return {
          command_id: command.id,
          status: 'completed',
          result: {
            redeploy_triggered: true,
            installation_id,
            instance_count: instanceNames.length,
            instance_names: instanceNames,
            restart_time_ms: restartTimeMs
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.deps.logger.error({
          operation: 'mcp_redeploy_failed',
          command_id: command.id,
          installation_id,
          error: errorMessage
        }, `Failed to redeploy installation: ${errorMessage}`);

        return {
          command_id: command.id,
          status: 'failed',
          error: errorMessage
        };
      }
    }

    // Handle HTTP/SSE servers (trigger re-discovery for all instances)
    if (!this.deps.remoteToolDiscoveryManager) {
      const errorMsg = 'RemoteToolDiscoveryManager not available for HTTP/SSE server redeploy';
      this.deps.logger.error({
        operation: 'mcp_redeploy_no_discovery_manager',
        command_id: command.id
      }, errorMsg);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMsg
      };
    }

    // HTTP/SSE redeploy - trigger tool re-discovery for all instances
    this.deps.logger.info({
      operation: 'mcp_redeploy_http_start',
      command_id: command.id,
      installation_id,
      instance_count: instanceNames.length
    }, `Triggering tool re-discovery for ${instanceNames.length} HTTP/SSE instance(s)`);

    try {
      const startTime = Date.now();
      const results = [];

      for (const instanceName of instanceNames) {
        const tools = await this.deps.remoteToolDiscoveryManager.discoverServerTools(instanceName);
        results.push({ instance_name: instanceName, tools_discovered: tools.length });
      }

      const discoveryTimeMs = Date.now() - startTime;

      this.deps.logger.info({
        operation: 'mcp_redeploy_http_success',
        command_id: command.id,
        installation_id,
        instance_count: instanceNames.length,
        discovery_time_ms: discoveryTimeMs,
        results
      }, `HTTP/SSE redeploy successful for ${instanceNames.length} instance(s)`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          redeploy_triggered: true,
          installation_id,
          instance_count: instanceNames.length,
          discovery_time_ms: discoveryTimeMs,
          results
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.logger.error({
        operation: 'mcp_redeploy_http_failed',
        command_id: command.id,
        installation_id,
        error: errorMessage
      }, `HTTP/SSE redeploy failed: ${errorMessage}`);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMessage
      };
    }
  }
}
