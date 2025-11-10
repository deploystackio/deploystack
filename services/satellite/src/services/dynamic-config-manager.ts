import { FastifyBaseLogger } from 'fastify';
import { McpServerConfig, ConfigurationUpdate } from './command-polling-service';
import { McpServersConfig } from '../types/mcp-server';
import type { EventBus } from './event-bus';
import { maskUrlForLogging } from '../utils/log-masker';

export interface DynamicMcpServersConfig {
  defaultTimeout: number;
  defaultHeaders: Record<string, string>;
  servers: Record<string, McpServerConfig>;
}

export interface ConfigurationChanges {
  hasChanges: boolean;
  addedServers: string[];
  removedServers: string[];
  modifiedServers: string[];
  unchangedServers: string[];
  configHash: string;
}

export class DynamicConfigManager {
  private logger: FastifyBaseLogger;
  private currentConfig: DynamicMcpServersConfig;
  private onConfigurationChanged?: (config: DynamicMcpServersConfig, changes?: ConfigurationChanges) => Promise<void>;
  private eventBus?: EventBus;

  constructor(logger: FastifyBaseLogger, eventBus?: EventBus) {
    this.logger = logger;
    this.eventBus = eventBus;
    
    // Initialize with default configuration (fallback)
    this.currentConfig = {
      defaultTimeout: 30000,
      defaultHeaders: {
        'Content-Type': 'application/json',
        'User-Agent': 'DeployStack-Satellite/0.1.0'
      },
      servers: {}
    };
  }

  /**
   * Set callback for configuration changes
   */
  setConfigurationChangeHandler(handler: (config: DynamicMcpServersConfig, changes?: ConfigurationChanges) => Promise<void>): void {
    this.onConfigurationChanged = handler;
  }

  /**
   * Update configuration from backend
   */
  async updateConfiguration(configUpdate: ConfigurationUpdate): Promise<void> {
    try {
      this.logger.info({
        operation: 'config_update_start',
        mcp_servers_count: Object.keys(configUpdate.mcp_servers || {}).length
      }, 'Updating MCP server configuration from backend');

      // Create new configuration
      const newConfig: DynamicMcpServersConfig = {
        defaultTimeout: this.currentConfig.defaultTimeout,
        defaultHeaders: { ...this.currentConfig.defaultHeaders },
        servers: {}
      };

      // Process MCP server configurations (silently build new config)
      if (configUpdate.mcp_servers) {
        for (const [serverName, serverConfig] of Object.entries(configUpdate.mcp_servers)) {
          // Validate server configuration
          if (this.validateServerConfig(serverName, serverConfig)) {
            newConfig.servers[serverName] = {
              ...serverConfig,
              // Ensure required fields
              name: serverName,
              enabled: serverConfig.enabled !== false // Default to enabled
            };
          } else {
            this.logger.warn({
              operation: 'config_server_invalid',
              server_name: serverName,
              server_config: serverConfig
            }, `Invalid MCP server configuration, skipping: ${serverName}`);
          }
        }
      }

      // Update polling intervals if provided
      if (configUpdate.polling_intervals) {
        this.logger.debug({
          operation: 'config_polling_intervals_update',
          intervals: configUpdate.polling_intervals
        }, 'Polling intervals updated from backend');
      }

      // Update resource limits if provided
      if (configUpdate.resource_limits) {
        this.logger.debug({
          operation: 'config_resource_limits_update',
          limits: configUpdate.resource_limits
        }, 'Resource limits updated from backend');
      }

      // Compare with current configuration and get detailed changes
      const changes = this.getConfigurationChanges(newConfig);

      if (changes.hasChanges) {
        const previousServerCount = Object.keys(this.currentConfig.servers).length;
        const newServerCount = Object.keys(newConfig.servers).length;

        // Log context-aware server changes
        changes.addedServers.forEach(serverName => {
          const serverConfig = newConfig.servers[serverName];
          this.logger.info({
            operation: 'config_server_added',
            server_name: serverName,
            server_url: maskUrlForLogging(serverConfig.url, serverConfig.secret_metadata?.query_params),
            enabled: serverConfig.enabled
          }, `Added MCP server configuration: ${serverName}`);
        });

        changes.modifiedServers.forEach(serverName => {
          const serverConfig = newConfig.servers[serverName];
          this.logger.info({
            operation: 'config_server_modified',
            server_name: serverName,
            server_url: maskUrlForLogging(serverConfig.url, serverConfig.secret_metadata?.query_params),
            enabled: serverConfig.enabled
          }, `Modified MCP server configuration: ${serverName}`);
        });

        changes.removedServers.forEach(serverName => {
          this.logger.info({
            operation: 'config_server_removed',
            server_name: serverName
          }, `Removed MCP server configuration: ${serverName}`);
        });

        // Log unchanged servers at debug level (optional)
        if (changes.unchangedServers.length > 0) {
          this.logger.debug({
            operation: 'config_servers_unchanged',
            unchanged_servers: changes.unchangedServers,
            unchanged_count: changes.unchangedServers.length
          }, `${changes.unchangedServers.length} MCP servers unchanged`);
        }

        this.logger.info({
          operation: 'config_update_applied',
          previous_server_count: previousServerCount,
          new_server_count: newServerCount,
          servers_added: changes.addedServers,
          servers_removed: changes.removedServers,
          servers_modified: changes.modifiedServers
        }, `Configuration updated: ${newServerCount} MCP servers (was ${previousServerCount})`);

        // Update current configuration
        this.currentConfig = newConfig;
        
        // TODO: Emit config.refreshed event when backend supports it
        // try {
        //   this.eventBus?.emit('config.refreshed', {
        //     config_hash: changes.configHash,
        //     server_count: newServerCount,
        //     teams_count: new Set(Object.values(newConfig.servers).map(s => s.team_id || 'unknown')).size,
        //     change_detected: true,
        //     fetch_duration_ms: 0
        //   });
        // } catch (error) {
        //   this.logger.warn({ error }, 'Failed to emit config.refreshed event (non-fatal)');
        // }

        // Notify configuration change handler
        if (this.onConfigurationChanged) {
          await this.onConfigurationChanged(newConfig, changes);
        }
      } else {
        this.logger.debug({
          operation: 'config_update_no_changes',
          server_count: Object.keys(newConfig.servers).length,
          unchanged_servers: changes.unchangedServers
        }, 'Configuration update received but no changes detected');
        
        // TODO: Emit config.refreshed event when backend supports it
        // try {
        //   this.eventBus?.emit('config.refreshed', {
        //     config_hash: changes.configHash,
        //     server_count: Object.keys(newConfig.servers).length,
        //     teams_count: new Set(Object.values(newConfig.servers).map(s => s.team_id || 'unknown')).size,
        //     change_detected: false,
        //     fetch_duration_ms: 0
        //   });
        // } catch (error) {
        //   this.logger.warn({ error }, 'Failed to emit config.refreshed event (non-fatal)');
        // }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error({
        operation: 'config_update_failed',
        error: errorMessage
      }, `Failed to update configuration: ${errorMessage}`);
      
      // Emit config.error event
      try {
        this.eventBus?.emit('config.error', {
          error_type: 'server_error',
          error_message: errorMessage,
          status_code: null,
          retry_in: 60 // Default retry interval
        });
      } catch (err) {
        this.logger.warn({ error: err }, 'Failed to emit config.error event (non-fatal)');
      }
      
      throw error;
    }
  }

  /**
   * Validate server configuration based on transport type
   */
  private validateServerConfig(serverName: string, config: McpServerConfig): boolean {
    // Check transport type
    const transportType = config.transport_type || config.type;
    
    if (transportType === 'stdio') {
      // For stdio transport, validate command and args
      if (!config.command || typeof config.command !== 'string') {
        this.logger.warn({
          operation: 'config_validation_failed',
          server_name: serverName,
          reason: 'missing_or_invalid_command'
        }, `Server ${serverName}: Command is required for stdio transport`);
        return false;
      }

      if (!config.args || !Array.isArray(config.args)) {
        this.logger.warn({
          operation: 'config_validation_failed',
          server_name: serverName,
          reason: 'missing_or_invalid_args'
        }, `Server ${serverName}: Args array is required for stdio transport`);
        return false;
      }

      this.logger.debug({
        operation: 'config_validation_success',
        server_name: serverName,
        transport_type: 'stdio',
        command: config.command,
        args_count: config.args.length
      }, `Server ${serverName}: stdio transport validation passed`);

    } else if (transportType === 'http' || transportType === 'sse') {
      // For HTTP/SSE transport, validate URL
      if (!config.url || typeof config.url !== 'string') {
        this.logger.warn({
          operation: 'config_validation_failed',
          server_name: serverName,
          reason: 'missing_or_invalid_url'
        }, `Server ${serverName}: URL is required for ${transportType} transport`);
        return false;
      }

      // Validate URL format
      try {
        new URL(config.url);
      } catch {
        this.logger.warn({
          operation: 'config_validation_failed',
          server_name: serverName,
          url: maskUrlForLogging(config.url, config.secret_metadata?.query_params),
          reason: 'invalid_url_format'
        }, `Server ${serverName}: Invalid URL format`);
        return false;
      }

      this.logger.debug({
        operation: 'config_validation_success',
        server_name: serverName,
        transport_type: transportType,
        url: maskUrlForLogging(config.url, config.secret_metadata?.query_params)
      }, `Server ${serverName}: ${transportType} transport validation passed`);

    } else {
      this.logger.warn({
        operation: 'config_validation_failed',
        server_name: serverName,
        transport_type: transportType,
        reason: 'unsupported_transport_type'
      }, `Server ${serverName}: Unsupported transport type '${transportType}'. Supported: stdio, http, sse`);
      return false;
    }

    // Validate timeout if provided
    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      this.logger.warn({
        operation: 'config_validation_failed',
        server_name: serverName,
        timeout: config.timeout,
        reason: 'invalid_timeout'
      }, `Server ${serverName}: Timeout must be a positive number`);
      return false;
    }

    return true;
  }

  /**
   * Check if configuration has changed
   */
  private hasConfigurationChanged(oldConfig: DynamicMcpServersConfig, newConfig: DynamicMcpServersConfig): boolean {
    // Compare server count
    const oldServerNames = Object.keys(oldConfig.servers).sort();
    const newServerNames = Object.keys(newConfig.servers).sort();
    
    if (oldServerNames.length !== newServerNames.length) {
      return true;
    }

    // Compare server names
    if (JSON.stringify(oldServerNames) !== JSON.stringify(newServerNames)) {
      return true;
    }

    // Compare individual server configurations
    for (const serverName of newServerNames) {
      const oldServer = oldConfig.servers[serverName];
      const newServer = newConfig.servers[serverName];

      if (JSON.stringify(oldServer) !== JSON.stringify(newServer)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get list of added servers
   */
  private getAddedServers(oldServers: Record<string, McpServerConfig>, newServers: Record<string, McpServerConfig>): string[] {
    return Object.keys(newServers).filter(name => !(name in oldServers));
  }

  /**
   * Get list of removed servers
   */
  private getRemovedServers(oldServers: Record<string, McpServerConfig>, newServers: Record<string, McpServerConfig>): string[] {
    return Object.keys(oldServers).filter(name => !(name in newServers));
  }

  /**
   * Get list of modified servers
   */
  private getModifiedServers(oldServers: Record<string, McpServerConfig>, newServers: Record<string, McpServerConfig>): string[] {
    const modified: string[] = [];
    
    for (const serverName of Object.keys(newServers)) {
      if (serverName in oldServers) {
        const oldServer = oldServers[serverName];
        const newServer = newServers[serverName];
        
        if (JSON.stringify(oldServer) !== JSON.stringify(newServer)) {
          modified.push(serverName);
        }
      }
    }
    
    return modified;
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): DynamicMcpServersConfig {
    return { ...this.currentConfig };
  }

  /**
   * Convert to legacy McpServersConfig format for compatibility
   */
  toLegacyConfig(): McpServersConfig {
    return {
      defaultTimeout: this.currentConfig.defaultTimeout,
      defaultHeaders: { ...this.currentConfig.defaultHeaders },
      servers: Object.fromEntries(
        Object.entries(this.currentConfig.servers).map(([name, config]) => [
          name,
          {
            name: config.name,
            type: config.type,
            url: maskUrlForLogging(config.url, config.secret_metadata?.query_params),
            description: config.description,
            timeout: config.timeout,
            enabled: config.enabled,
            headers: config.headers
          }
        ])
      )
    };
  }

  /**
   * Get enabled MCP servers
   */
  getEnabledMcpServers(): Record<string, McpServerConfig> {
    return Object.fromEntries(
      Object.entries(this.currentConfig.servers)
        .filter(([, config]) => config.enabled !== false)
    );
  }

  /**
   * Get MCP server configuration by name
   */
  getMcpServerConfig(serverName: string): McpServerConfig | undefined {
    return this.currentConfig.servers[serverName];
  }

  /**
   * Check if MCP server exists and is enabled
   */
  isMcpServerEnabled(serverName: string): boolean {
    const config = this.getMcpServerConfig(serverName);
    return config ? config.enabled !== false : false;
  }

  /**
   * Get all available MCP server names
   */
  getMcpServerNames(): string[] {
    return Object.keys(this.currentConfig.servers);
  }

  /**
   * Get enabled MCP server names only
   */
  getEnabledMcpServerNames(): string[] {
    return Object.keys(this.getEnabledMcpServers());
  }

  /**
   * Generate configuration hash for change detection
   */
  private generateConfigHash(config: DynamicMcpServersConfig): string {
    // Create a stable hash of the configuration
    const hashData = {
      servers: Object.keys(config.servers).sort().reduce((acc, key) => {
        acc[key] = config.servers[key];
        return acc;
      }, {} as Record<string, McpServerConfig>)
    };
    
    // Simple hash function (you could use crypto.createHash for production)
    const configString = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get detailed configuration changes
   */
  getConfigurationChanges(newConfig: DynamicMcpServersConfig): ConfigurationChanges {
    const oldServers = this.currentConfig.servers;
    const newServers = newConfig.servers;
    
    const addedServers = this.getAddedServers(oldServers, newServers);
    const removedServers = this.getRemovedServers(oldServers, newServers);
    const modifiedServers = this.getModifiedServers(oldServers, newServers);
    
    // Get unchanged servers
    const unchangedServers = Object.keys(newServers).filter(name => 
      name in oldServers && 
      !modifiedServers.includes(name) && 
      !addedServers.includes(name)
    );
    
    const hasChanges = addedServers.length > 0 || removedServers.length > 0 || modifiedServers.length > 0;
    const configHash = this.generateConfigHash(newConfig);
    
    return {
      hasChanges,
      addedServers,
      removedServers,
      modifiedServers,
      unchangedServers,
      configHash
    };
  }

  /**
   * Get current configuration hash
   */
  getCurrentConfigHash(): string {
    return this.generateConfigHash(this.currentConfig);
  }

  /**
   * Get configuration statistics
   */
  getStats(): {
    total_servers: number;
    enabled_servers: number;
    disabled_servers: number;
    servers_by_status: Record<string, string[]>;
  } {
    const allServers = Object.entries(this.currentConfig.servers);
    const enabledServers = allServers.filter(([, config]) => config.enabled !== false);
    const disabledServers = allServers.filter(([, config]) => config.enabled === false);

    return {
      total_servers: allServers.length,
      enabled_servers: enabledServers.length,
      disabled_servers: disabledServers.length,
      servers_by_status: {
        enabled: enabledServers.map(([name]) => name),
        disabled: disabledServers.map(([name]) => name)
      }
    };
  }
}
