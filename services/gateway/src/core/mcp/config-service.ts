import chalk from 'chalk';
import ora from 'ora';
import { DeployStackAPI } from '../auth/api-client';
import { CredentialStorage } from '../auth/storage';
import { TeamMCPConfig } from '../../types/mcp';
import { AuthenticationError, AuthError } from '../../types/auth';

export class MCPConfigService {
  private storage: CredentialStorage;

  constructor() {
    this.storage = new CredentialStorage();
  }

  /**
   * Download merged MCP configurations using the new gateway endpoint (THREE-TIER ARCHITECTURE)
   * This method uses the new /api/gateway/me/mcp-configurations endpoint that merges
   * Template + Team + User configurations and returns ready-to-use server configs
   * @param deviceId Device ID for device-specific user configurations
   * @param api DeployStack API client
   * @param showSpinner Whether to show progress spinner
   * @returns Gateway MCP configuration with ready-to-use servers
   */
  async downloadGatewayMCPConfig(
    hardwareId: string,
    api?: DeployStackAPI,
    showSpinner: boolean = true
  ): Promise<{
    servers: Array<{
      id: string;
      name: string;
      command: string;
      args: string[];
      env: Record<string, string>;
      status: 'ready' | 'invalid';
    }>;
    deviceId: string;
    lastUpdated: string;
  }> {
    let spinner: ReturnType<typeof ora> | null = null;
    
    try {
      if (showSpinner) {
        spinner = ora('Downloading merged MCP configurations from gateway endpoint...').start();
      }

      // Use provided API client or create one
      let apiClient = api;
      if (!apiClient) {
        const credentials = await this.storage.getCredentials();
        if (!credentials) {
          throw new AuthenticationError(
            AuthError.STORAGE_ERROR,
            'No authentication found - cannot download MCP config'
          );
        }
        apiClient = new DeployStackAPI(credentials, credentials.baseUrl);
      }

      // Call the new gateway endpoint that merges all three tiers
      const response = await apiClient.getGatewayMCPConfigurations(hardwareId);
      
      if (!response.success) {
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          'Failed to download merged MCP configurations from gateway endpoint'
        );
      }

      const servers = response.data.servers || [];
      const readyServers = servers.filter(s => s.status === 'ready');
      const invalidServers = servers.filter(s => s.status === 'invalid');
      
      if (showSpinner && spinner) {
        spinner.succeed(`Gateway MCP configurations downloaded (${readyServers.length} ready, ${invalidServers.length} invalid)`);
      }

      if (invalidServers.length > 0) {
        console.log(chalk.yellow(`⚠️  ${invalidServers.length} server${invalidServers.length === 1 ? '' : 's'} marked as invalid (missing required user configurations)`));
        invalidServers.forEach(server => {
          console.log(chalk.gray(`   • ${server.name} (${server.id})`));
        });
      }

      return {
        servers,
        deviceId: hardwareId,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      if (spinner) {
        spinner.fail('Failed to download gateway MCP configurations');
      }
      throw error;
    }
  }

  /**
   * Switch team MCP configuration using new gateway endpoint
   * Clears old config and downloads new config for the team
   * @param teamId New team ID
   * @param teamName New team name
   * @param api DeployStack API client
   * @returns New MCP configuration
   */
  async switchTeamMCPConfig(
    teamId: string,
    teamName: string,
    api: DeployStackAPI
  ): Promise<TeamMCPConfig> {
    // Clear any existing MCP configuration (for any team)
    const credentials = await this.storage.getCredentials();
    if (credentials?.selectedTeam?.id) {
      await this.storage.clearMCPConfig(credentials.selectedTeam.id);
    }

    // Detect device info for hardware_id
    const { detectDeviceInfo } = await import('../../utils/device-detection');
    const deviceInfo = await detectDeviceInfo();

    // Download merged configuration using new gateway endpoint
    const gatewayConfig = await this.downloadGatewayMCPConfig(deviceInfo.hardware_id, api, true);
    
    // Convert and store the gateway config in the format expected by local storage
    const teamMCPConfig = this.convertGatewayConfigToTeamConfig(
      teamId,
      teamName,
      gatewayConfig
    );
    
    // Store the converted configuration
    await this.storeMCPConfig(teamMCPConfig);
    
    return teamMCPConfig;
  }

  /**
   * Get stored MCP configuration for a team
   * @param teamId Team ID (optional, uses selected team if not provided)
   * @returns MCP configuration or null if not found
   */
  async getMCPConfig(teamId?: string): Promise<TeamMCPConfig | null> {
    return await this.storage.getMCPConfig(teamId);
  }

  /**
   * Clear MCP configuration for a team
   * @param teamId Team ID (optional, uses selected team if not provided)
   */
  async clearMCPConfig(teamId?: string): Promise<void> {
    await this.storage.clearMCPConfig(teamId);
  }

  /**
   * Check if MCP configuration exists for a team
   * @param teamId Team ID (optional, uses selected team if not provided)
   * @returns true if configuration exists
   */
  async hasMCPConfig(teamId?: string): Promise<boolean> {
    const config = await this.getMCPConfig(teamId);
    return config !== null;
  }

  /**
   * Validate that stored MCP configuration is not too old
   * @param maxAgeHours Maximum age in hours (default: 24)
   * @param teamId Team ID (optional, uses selected team if not provided)
   * @returns true if configuration is fresh
   */
  async isMCPConfigFresh(maxAgeHours: number = 24, teamId?: string): Promise<boolean> {
    const config = await this.getMCPConfig(teamId);
    if (!config) {
      return false;
    }

    const lastUpdated = new Date(config.last_updated);
    const now = new Date();
    const ageHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return ageHours < maxAgeHours;
  }

  /**
   * Get summary of MCP configuration
   * @param teamId Team ID (optional, uses selected team if not provided)
   * @returns Configuration summary or null
   */
  async getMCPConfigSummary(teamId?: string): Promise<{
    teamId: string;
    teamName: string;
    serverCount: number;
    installationCount: number;
    lastUpdated: string;
  } | null> {
    const config = await this.getMCPConfig(teamId);
    if (!config) {
      return null;
    }

    return {
      teamId: config.team_id,
      teamName: config.team_name,
      serverCount: config.servers.length,
      installationCount: config.installations.length,
      lastUpdated: config.last_updated
    };
  }

  /**
   * Convert gateway configuration to team configuration for local storage
   * @param teamId Team ID
   * @param teamName Team name 
   * @param gatewayConfig Gateway configuration from new API
   * @returns Team MCP configuration for storage
   */
  convertGatewayConfigToTeamConfig(
    teamId: string,
    teamName: string,
    gatewayConfig: {
      servers: Array<{
        id: string;
        name: string;
        command: string;
        args: string[];
        env: Record<string, string>;
        status: 'ready' | 'invalid';
      }>;
      deviceId: string;
      lastUpdated: string;
    }
  ): TeamMCPConfig {
    // Convert gateway servers to TeamMCPConfig format
    const servers = gatewayConfig.servers.map(server => ({
      id: server.id,
      name: server.name,
      installation_name: server.name,
      command: server.command,
      args: server.args,
      env: server.env,
      runtime: this.detectRuntime(server.command, server.args),
      installation_type: 'local' as const,
      transport_type: 'stdio' as const,
      status: server.status
    }));

    // Create mock installations for compatibility (since gateway endpoint doesn't return installations)
    const installations = gatewayConfig.servers.map(server => ({
      id: server.id,
      team_id: teamId,
      server_id: server.id,
      created_by: 'gateway-endpoint',
      installation_name: server.name,
      installation_type: 'local' as const,
      team_args: server.args,
      team_env: server.env,
      created_at: gatewayConfig.lastUpdated,
      updated_at: gatewayConfig.lastUpdated,
      last_used_at: null,
      server: {
        id: server.id,
        name: server.name,
        description: `MCP server: ${server.name}`,
        github_url: null,
        runtime: this.detectRuntime(server.command, server.args),
        installation_methods: [{
          type: 'command' as const,
          command: server.command,
          args: server.args
        }],
        environment_variables: [],
        transport_type: 'stdio' as const
      }
    }));

    return {
      team_id: teamId,
      team_name: teamName,
      installations,
      user_configurations: [], // Empty since gateway endpoint handles user configs internally
      servers,
      last_updated: gatewayConfig.lastUpdated
    };
  }

  /**
   * Store MCP configuration (wrapper around storage)
   * @param config Team MCP configuration to store
   */
  async storeMCPConfig(config: TeamMCPConfig): Promise<void> {
    await this.storage.storeMCPConfig(config);
  }

  /**
   * Detect runtime from command and args
   * @param command Command string
   * @param _args Command arguments
   * @returns Detected runtime
   */
  private detectRuntime(command: string, _args: string[]): 'nodejs' | 'python' | 'binary' {
    if (command === 'npx' || command === 'node') {
      return 'nodejs';
    }
    if (command === 'python' || command === 'python3' || command === 'pip') {
      return 'python';
    }
    return 'binary';
  }
}
