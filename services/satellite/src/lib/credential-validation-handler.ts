import { FastifyBaseLogger } from 'fastify';
import { SatelliteCommand, CommandResult } from '../services/command-polling-service';
import { DynamicConfigManager } from '../services/dynamic-config-manager';
import type { EventBus } from '../services/event-bus';

export interface CredentialValidationHandlerDependencies {
  logger: FastifyBaseLogger;
  configManager: DynamicConfigManager;
  eventBus: EventBus | null;
}

/**
 * Handles OAuth credential validation for HTTP/SSE MCP servers
 *
 * Validates credentials by calling the tools/list endpoint and analyzing
 * the response for authentication failures. Emits status events to backend
 * for tracking server credential health.
 */
export class CredentialValidationHandler {
  constructor(private deps: CredentialValidationHandlerDependencies) {}

  /**
   * Emit status change event to backend
   */
  private emitStatusChange(
    installationId: string,
    teamId: string,
    userId: string,
    status: 'online' | 'requires_reauth' | 'error',
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
      operation: 'credential_validation_status_emitted',
      installation_id: installationId,
      team_id: teamId,
      status,
      status_message: statusMessage
    }, `Emitted credential validation status: ${status}`);
  }

  async handleValidation(command: SatelliteCommand): Promise<CommandResult> {
    const { installation_id } = command.payload;

    // Validate installation_id is present
    if (!installation_id) {
      this.deps.logger.warn({
        operation: 'credential_validation_missing_id',
        command_id: command.id
      }, 'Credential validation command missing installation_id');

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          credential_validation: {
            valid: false,
            error: 'Missing installation_id in command payload'
          }
        }
      };
    }

    this.deps.logger.debug({
      operation: 'credential_validation',
      command_id: command.id,
      installation_id
    }, 'Processing credential validation command');

    // Find server config by installation_id
    const currentConfig = this.deps.configManager.getCurrentConfiguration();
    let serverConfig: typeof currentConfig.servers[string] | null = null;
    let serverName: string | null = null;
    let teamId: string | null = null;

    for (const [name, config] of Object.entries(currentConfig.servers)) {
      if (config.installation_id === installation_id) {
        serverConfig = config;
        serverName = name;
        teamId = config.team_id ?? null;
        break;
      }
    }

    if (!serverConfig || !serverName || !teamId) {
      this.deps.logger.warn({
        operation: 'credential_validation_config_not_found',
        command_id: command.id,
        installation_id
      }, `Server config not found for installation ${installation_id}`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          credential_validation: {
            installation_id,
            valid: false,
            error: 'Server configuration not found on this satellite'
          }
        }
      };
    }

    // After validation, these are guaranteed to be non-null
    const validatedTeamId: string = teamId;

    // Only validate HTTP/SSE servers (stdio uses different patterns)
    if (serverConfig.transport_type === 'stdio') {
      this.deps.logger.debug({
        operation: 'credential_validation_skipped_stdio',
        command_id: command.id,
        installation_id,
        server_name: serverName
      }, 'Skipping credential validation for stdio server');

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          credential_validation: {
            installation_id,
            valid: true, // stdio servers don't have HTTP credentials to validate
            skipped: true,
            reason: 'stdio_transport'
          }
        }
      };
    }

    // Validate URL exists
    if (!serverConfig.url) {
      return {
        command_id: command.id,
        status: 'completed',
        result: {
          credential_validation: {
            installation_id,
            valid: false,
            error: 'No URL configured for server'
          }
        }
      };
    }

    const startTime = Date.now();

    try {
      // Try to call tools/list with credentials
      const response = await fetch(serverConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...serverConfig.headers
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'credential-validation',
          method: 'tools/list',
          params: {}
        }),
        signal: AbortSignal.timeout(serverConfig.timeout || 15000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        // Check if response is valid JSON-RPC
        const responseData = await response.json() as { error?: { message?: string } };

        if (responseData.error) {
          // JSON-RPC error (could be auth failure)
          const errorMessage = responseData.error.message ?? 'Unknown error';
          const isAuthError = errorMessage.toLowerCase().includes('auth') ||
                              errorMessage.toLowerCase().includes('unauthorized') ||
                              errorMessage.toLowerCase().includes('forbidden') ||
                              response.status === 401 ||
                              response.status === 403;

          this.deps.logger.info({
            operation: 'credential_validation_failed',
            command_id: command.id,
            installation_id,
            server_name: serverName,
            error: errorMessage,
            is_auth_error: isAuthError,
            response_time_ms: responseTime
          }, `Credential validation failed for ${serverName}: ${errorMessage}`);

          if (isAuthError) {
            // Emit requires_reauth status
            this.emitStatusChange(installation_id, validatedTeamId, serverConfig.user_id || 'unknown', 'requires_reauth', errorMessage);
          }

          return {
            command_id: command.id,
            status: 'completed',
            result: {
              credential_validation: {
                installation_id,
                valid: false,
                error: errorMessage,
                needs_reauth: isAuthError,
                response_time_ms: responseTime
              }
            }
          };
        }

        // Success - credentials are valid
        this.deps.logger.info({
          operation: 'credential_validation_success',
          command_id: command.id,
          installation_id,
          server_name: serverName,
          response_time_ms: responseTime
        }, `Credential validation passed for ${serverName}`);

        return {
          command_id: command.id,
          status: 'completed',
          result: {
            credential_validation: {
              installation_id,
              valid: true,
              response_time_ms: responseTime
            }
          }
        };
      } else {
        // HTTP error
        const isAuthError = response.status === 401 || response.status === 403;
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        this.deps.logger.info({
          operation: 'credential_validation_http_error',
          command_id: command.id,
          installation_id,
          server_name: serverName,
          status_code: response.status,
          is_auth_error: isAuthError,
          response_time_ms: responseTime
        }, `Credential validation HTTP error for ${serverName}: ${errorMessage}`);

        if (isAuthError) {
          // Emit requires_reauth status
          this.emitStatusChange(installation_id, validatedTeamId, serverConfig.user_id || 'unknown', 'requires_reauth', errorMessage);
        }

        return {
          command_id: command.id,
          status: 'completed',
          result: {
            credential_validation: {
              installation_id,
              valid: false,
              error: errorMessage,
              needs_reauth: isAuthError,
              response_time_ms: responseTime
            }
          }
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.deps.logger.error({
        operation: 'credential_validation_error',
        command_id: command.id,
        installation_id,
        server_name: serverName,
        error: errorMessage,
        response_time_ms: responseTime
      }, `Credential validation error for ${serverName}: ${errorMessage}`);

      return {
        command_id: command.id,
        status: 'completed',
        result: {
          credential_validation: {
            installation_id,
            valid: false,
            error: errorMessage,
            response_time_ms: responseTime
          }
        }
      };
    }
  }
}
