import chalk from 'chalk';
import ora from 'ora';
import { ToolCacheService } from '../core/mcp/tool-cache';
import { MCPServerConfig, TeamMCPConfig } from '../types/mcp';
import { MCPTool } from '../core/mcp/tool-discovery';

export interface ToolDiscoveryOptions {
  showProgress?: boolean;
  showSpinner?: boolean;
  continueOnError?: boolean;
  forceRefresh?: boolean;
}

export interface ToolDiscoveryResult {
  totalTools: number;
  serversProcessed: number;
  serversSucceeded: number;
  serversFailed: number;
  errors: Array<{
    serverName: string;
    error: string;
  }>;
}

export class ToolDiscoveryManager {
  private toolCacheService: ToolCacheService;

  constructor() {
    this.toolCacheService = new ToolCacheService();
  }

  /**
   * Discover tools from a single MCP server
   */
  async discoverServerTools(
    teamId: string,
    teamName: string,
    serverConfig: MCPServerConfig,
    options: ToolDiscoveryOptions = {}
  ): Promise<MCPTool[]> {
    const {
      showProgress = true,
      forceRefresh = true
    } = options;

    if (showProgress) {
      console.log(chalk.blue(`🔄 Refreshing tools from ${serverConfig.installation_name}...`));
    }

    try {
      const tools = await this.toolCacheService.refreshServerTools(
        teamId,
        teamName,
        serverConfig.installation_name,
        serverConfig
      );

      if (showProgress) {
        console.log(chalk.green(`✅ Found ${tools.length} tool${tools.length === 1 ? '' : 's'} (cache updated)`));
      }

      return tools;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (showProgress) {
        console.log(chalk.red(`❌ Failed to discover tools: ${errorMessage}`));
      }

      // Try to get cached tools as fallback
      if (!forceRefresh) {
        const cachedTools = await this.toolCacheService.getServerTools(teamId, serverConfig.installation_name);
        if (cachedTools && cachedTools.length > 0) {
          if (showProgress) {
            console.log(chalk.yellow(`⚠️  Using cached tools (${cachedTools.length} tools)`));
          }
          return cachedTools;
        }
      }

      throw error;
    }
  }

  /**
   * Discover tools from multiple MCP servers
   */
  async discoverAllServerTools(
    teamId: string,
    teamName: string,
    servers: MCPServerConfig[],
    options: ToolDiscoveryOptions = {}
  ): Promise<ToolDiscoveryResult> {
    const {
      showProgress = true,
      showSpinner = true,
      continueOnError = true
    } = options;

    let spinner: ReturnType<typeof ora> | null = null;
    let totalTools = 0;
    let serversProcessed = 0;
    let serversSucceeded = 0;
    let serversFailed = 0;
    const errors: Array<{ serverName: string; error: string }> = [];

    if (showProgress && servers.length > 0) {
      console.log(chalk.blue(`🔍 Discovering tools from ${servers.length} MCP server${servers.length === 1 ? '' : 's'}...`));
    }

    if (showSpinner && servers.length > 0) {
      spinner = ora('Discovering tools from MCP servers...').start();
    }

    for (const serverConfig of servers) {
      try {
        if (spinner) {
          spinner.text = `Discovering tools from ${serverConfig.installation_name}...`;
        }

        const tools = await this.toolCacheService.refreshServerTools(
          teamId,
          teamName,
          serverConfig.installation_name,
          serverConfig
        );

        totalTools += tools.length;
        serversProcessed++;
        serversSucceeded++;

        if (spinner) {
          spinner.text = `Discovered ${tools.length} tools from ${serverConfig.installation_name} (${serversProcessed}/${servers.length})`;
        } else if (showProgress) {
          console.log(chalk.green(`✅ Discovered ${tools.length} tools from ${serverConfig.installation_name}`));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Cache the error
        await this.toolCacheService.cacheServerError(
          teamId,
          teamName,
          serverConfig.installation_name,
          serverConfig,
          errorMessage
        );

        errors.push({
          serverName: serverConfig.installation_name,
          error: errorMessage
        });

        serversProcessed++;
        serversFailed++;

        if (continueOnError) {
          if (showProgress && !spinner) {
            console.warn(chalk.yellow(`⚠️  Failed to discover tools from ${serverConfig.installation_name}: ${errorMessage}`));
          }
        } else {
          if (spinner) {
            spinner.fail(`Failed to discover tools from ${serverConfig.installation_name}`);
          }
          throw error;
        }
      }
    }

    if (spinner) {
      if (serversFailed === 0) {
        spinner.succeed(`Tool discovery completed (${serversProcessed}/${servers.length} servers processed)`);
      } else {
        spinner.succeed(`Tool discovery completed with ${serversFailed} error${serversFailed === 1 ? '' : 's'} (${serversSucceeded}/${servers.length} servers succeeded)`);
      }
    }

    // Show summary
    if (showProgress) {
      if (totalTools > 0) {
        console.log(chalk.green(`🛠️  Discovered and cached ${totalTools} tool${totalTools === 1 ? '' : 's'} from ${serversSucceeded} server${serversSucceeded === 1 ? '' : 's'}`));
        console.log(chalk.gray(`💾 Tools cached for fast gateway startup`));
      } else {
        console.log(chalk.yellow(`⚠️  No tools discovered from any MCP servers`));
      }

      // Show errors if any
      if (errors.length > 0 && continueOnError) {
        console.log(chalk.yellow(`\n⚠️  Errors encountered:`));
        errors.forEach(({ serverName, error }) => {
          console.log(chalk.gray(`   ${serverName}: ${error}`));
        });
      }
    }

    return {
      totalTools,
      serversProcessed,
      serversSucceeded,
      serversFailed,
      errors
    };
  }

  /**
   * Discover tools from team configuration
   */
  async discoverTeamTools(
    teamConfig: TeamMCPConfig,
    options: ToolDiscoveryOptions = {}
  ): Promise<ToolDiscoveryResult> {
    if (!teamConfig.servers || teamConfig.servers.length === 0) {
      if (options.showProgress) {
        console.log(chalk.gray(`ℹ️  No MCP servers configured for team ${teamConfig.team_name}`));
      }
      
      return {
        totalTools: 0,
        serversProcessed: 0,
        serversSucceeded: 0,
        serversFailed: 0,
        errors: []
      };
    }

    return await this.discoverAllServerTools(
      teamConfig.team_id,
      teamConfig.team_name,
      teamConfig.servers,
      options
    );
  }

  /**
   * Get cached tools for a team (for fast gateway startup)
   */
  async getCachedTeamTools(teamId: string): Promise<Array<MCPTool & { serverName: string; namespacedName: string }>> {
    return await this.toolCacheService.getAllTeamTools(teamId);
  }

  /**
   * Get cached tools for a specific server
   */
  async getCachedServerTools(teamId: string, serverName: string): Promise<MCPTool[] | null> {
    return await this.toolCacheService.getServerTools(teamId, serverName);
  }

  /**
   * Check if server cache is valid
   */
  async isServerCacheValid(teamId: string, serverName: string, serverConfig: MCPServerConfig): Promise<boolean> {
    return await this.toolCacheService.isServerCacheValid(teamId, serverName, serverConfig);
  }

  /**
   * Get cache summary for a team
   */
  async getCacheSummary(teamId: string) {
    return await this.toolCacheService.getCacheSummary(teamId);
  }

  /**
   * Invalidate team cache
   */
  async invalidateTeamCache(teamId: string): Promise<void> {
    await this.toolCacheService.invalidateTeamCache(teamId);
  }
}
