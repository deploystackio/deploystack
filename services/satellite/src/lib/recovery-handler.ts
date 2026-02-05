import { FastifyBaseLogger } from 'fastify';
import { SatelliteCommand, CommandResult } from '../services/command-polling-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import { RemoteToolDiscoveryManager } from '../services/remote-tool-discovery-manager';
import type { EventBus } from '../services/event-bus';

export interface RecoveryHandlerDependencies {
  logger: FastifyBaseLogger;
  configManager: DynamicConfigManager;
  remoteToolDiscoveryManager: RemoteToolDiscoveryManager | null;
  eventBus: EventBus | null;
}

/**
 * Handles MCP server recovery by re-discovering tools for HTTP/SSE servers
 *
 * When a server recovers from offline/error state, this handler triggers
 * tool re-discovery and emits appropriate status events to track the
 * recovery progress (connecting → discovering_tools → online).
 */
export class RecoveryHandler {
  constructor(private deps: RecoveryHandlerDependencies) {}

  /**
   * Emit status change event to backend
   */
  private emitStatusChange(
    installationId: string,
    teamId: string,
    userId: string,
    status: 'connecting' | 'discovering_tools' | 'online' | 'offline' | 'error' | 'requires_reauth',
    statusMessage?: string
  ): void {
    if (!this.deps.eventBus) {
      this.deps.logger.debug({
        operation: 'status_change_no_event_bus',
        installation_id: installationId,
        status
      }, 'EventBus not available, skipping status emission');
      return;
    }

    this.deps.eventBus.emit('mcp.server.status_changed', {
      installation_id: installationId,
      team_id: teamId,
      user_id: userId,
      status,
      status_message: statusMessage,
      timestamp: new Date().toISOString()
    });

    this.deps.logger.debug({
      operation: 'recovery_status_emitted',
      installation_id: installationId,
      team_id: teamId,
      status,
      status_message: statusMessage
    }, `Emitted recovery status: ${status}`);
  }

  async handleRecovery(command: SatelliteCommand): Promise<CommandResult> {
    const { installation_id, team_id } = command.payload;

    this.deps.logger.info({
      operation: 'mcp_recovery_received',
      command_id: command.id,
      installation_id,
      team_id
    }, `Processing MCP recovery command for installation ${installation_id}`);

    // Validate required fields
    if (!installation_id) {
      const errorMsg = 'Missing installation_id in mcp_recovery payload';
      this.deps.logger.error({
        operation: 'mcp_recovery_validation_failed',
        command_id: command.id
      }, errorMsg);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMsg
      };
    }

    // Find server config by installation_id
    const currentConfig = this.deps.configManager.getCurrentConfiguration();
    let serverName: string | null = null;
    let serverConfig: typeof currentConfig.servers[string] | null = null;

    for (const [name, config] of Object.entries(currentConfig.servers)) {
      if (config.installation_id === installation_id) {
        serverName = name;
        serverConfig = config;
        break;
      }
    }

    if (!serverName || !serverConfig) {
      this.deps.logger.warn({
        operation: 'mcp_recovery_server_not_found',
        command_id: command.id,
        installation_id
      }, `Server config not found for installation ${installation_id} - may not be deployed to this satellite`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          message: 'Server not found on this satellite',
          installation_id
        }
      };
    }

    // Only handle HTTP/SSE servers (not stdio - they're handled via process lifecycle)
    if (serverConfig.transport_type === 'stdio') {
      this.deps.logger.debug({
        operation: 'mcp_recovery_skipped_stdio',
        command_id: command.id,
        installation_id,
        server_name: serverName
      }, 'Skipping recovery for stdio server - handled via process lifecycle');

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          message: 'stdio servers do not require recovery re-discovery',
          installation_id,
          server_name: serverName
        }
      };
    }

    // Check if RemoteToolDiscoveryManager is available
    if (!this.deps.remoteToolDiscoveryManager) {
      const errorMsg = 'RemoteToolDiscoveryManager not available for recovery handling';
      this.deps.logger.error({
        operation: 'mcp_recovery_no_manager',
        command_id: command.id
      }, errorMsg);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMsg
      };
    }

    // Emit 'connecting' status to backend
    const validatedTeamId = team_id || serverConfig.team_id || 'unknown';
    this.emitStatusChange(
      installation_id,
      validatedTeamId,
      serverConfig.user_id || 'unknown',
      'connecting',
      'Server recovered, satellite initiating tool re-discovery'
    );

    try {
      // Emit 'discovering_tools' status
      this.emitStatusChange(
        installation_id,
        validatedTeamId,
        serverConfig.user_id || 'unknown',
        'discovering_tools',
        'Re-discovering tools after server recovery'
      );

      // Trigger tool re-discovery
      const startTime = Date.now();
      const tools = await this.deps.remoteToolDiscoveryManager.discoverServerTools(serverName);
      const discoveryTimeMs = Date.now() - startTime;

      // Emit 'online' status on success
      this.emitStatusChange(
        installation_id,
        validatedTeamId,
        serverConfig.user_id || 'unknown',
        'online',
        `Server recovered with ${tools.length} tools`
      );

      this.deps.logger.info({
        operation: 'mcp_recovery_success',
        command_id: command.id,
        installation_id,
        server_name: serverName,
        tools_discovered: tools.length,
        discovery_time_ms: discoveryTimeMs
      }, `MCP recovery successful: ${serverName} with ${tools.length} tools (${discoveryTimeMs}ms)`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          installation_id,
          server_name: serverName,
          tools_discovered: tools.length,
          discovery_time_ms: discoveryTimeMs
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Determine appropriate error status
      const { status, message } = RemoteToolDiscoveryManager.getStatusFromError(errorMessage);

      // Emit error status to backend
      this.emitStatusChange(
        installation_id,
        validatedTeamId,
        serverConfig.user_id || 'unknown',
        status,
        message
      );

      this.deps.logger.error({
        operation: 'mcp_recovery_failed',
        command_id: command.id,
        installation_id,
        server_name: serverName,
        error: errorMessage,
        resulting_status: status
      }, `MCP recovery failed for ${serverName}: ${errorMessage}`);

      return {
        command_id: command.id,
        status: 'failed',
        error: errorMessage,
        result: {
          installation_id,
          server_name: serverName,
          resulting_status: status
        }
      };
    }
  }
}
