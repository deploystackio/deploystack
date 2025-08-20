import chalk from 'chalk';
import ora from 'ora';
import { DeployStackAPI } from '../auth/api-client';
import { CredentialStorage } from '../auth/storage';
import { processMCPInstallations, filterValidInstallations } from './config-processor';
import { TeamMCPConfig } from '../../types/mcp';
import { AuthenticationError, AuthError } from '../../types/auth';

export class MCPConfigService {
  private storage: CredentialStorage;

  constructor() {
    this.storage = new CredentialStorage();
  }

  /**
   * Download and store MCP configuration for a team
   * @param teamId Team ID
   * @param teamName Team name (optional, will be set from API if not provided)
   * @param api DeployStack API client
   * @param showSpinner Whether to show progress spinner
   * @returns Downloaded MCP configuration
   */
  async downloadAndStoreMCPConfig(
    teamId: string,
    teamName?: string,
    api?: DeployStackAPI,
    showSpinner: boolean = true
  ): Promise<TeamMCPConfig> {
    let spinner: ReturnType<typeof ora> | null = null;
    
    try {
      if (showSpinner) {
        spinner = ora('Downloading MCP server configurations...').start();
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

      // Download MCP installations for the team
      const response = await apiClient.getTeamMCPInstallations(teamId);
      
      if (!response.success) {
        throw new AuthenticationError(
          AuthError.NETWORK_ERROR,
          'Failed to download MCP installations from API'
        );
      }

      const installations = response.data || [];
      
      if (showSpinner && spinner) {
        spinner.text = `Downloading user configurations for ${installations.length} installation${installations.length === 1 ? '' : 's'}...`;
      }

      // Download user configurations for each installation
      const allUserConfigurations = [];
      for (const installation of installations) {
        try {
          const userConfigResponse = await apiClient.getUserConfigurations(teamId, installation.id);
          if (userConfigResponse.success && userConfigResponse.data) {
            allUserConfigurations.push(...userConfigResponse.data);
          }
        } catch (error) {
          // Log warning but continue - user configs are optional
          console.log(chalk.yellow(`⚠️  Could not fetch user configurations for installation ${installation.installation_name}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }

      if (showSpinner && spinner) {
        spinner.text = `Processing ${installations.length} installation${installations.length === 1 ? '' : 's'} with ${allUserConfigurations.length} user configuration${allUserConfigurations.length === 1 ? '' : 's'}...`;
      }

      // Filter and validate installations
      const validInstallations = filterValidInstallations(installations);
      
      if (validInstallations.length < installations.length) {
        const invalidCount = installations.length - validInstallations.length;
        console.log(chalk.yellow(`⚠️  Skipped ${invalidCount} invalid installation${invalidCount === 1 ? '' : 's'}`));
      }

      // Process installations into server configurations with three-tier architecture
      const config = processMCPInstallations(teamId, teamName || `Team ${teamId}`, validInstallations, allUserConfigurations);

      if (showSpinner && spinner) {
        spinner.text = 'Storing MCP configuration securely...';
      }

      // Store the configuration securely
      await this.storage.storeMCPConfig(config);

      if (showSpinner && spinner) {
        spinner.succeed(`MCP configuration downloaded and stored (${config.servers.length} server${config.servers.length === 1 ? '' : 's'})`);
      }

      return config;
    } catch (error) {
      if (spinner) {
        spinner.fail('Failed to download MCP configuration');
      }
      throw error;
    }
  }

  /**
   * Switch team MCP configuration
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

    // Download and store new configuration
    return await this.downloadAndStoreMCPConfig(teamId, teamName, api, true);
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
}
