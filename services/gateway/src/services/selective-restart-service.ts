import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import { ConfigurationChangeInfo } from './configuration-change-service';
import { MCPServerConfig } from '../types/mcp';

export interface SelectiveRestartOptions {
  gatewayUrl?: string;
  timeout?: number;
  showProgress?: boolean;
}

export interface SelectiveRestartResult {
  success: boolean;
  addedServers: string[];
  removedServers: string[];
  restartedServers: string[];
  errors: Array<{
    serverName: string;
    operation: 'add' | 'remove' | 'restart';
    error: string;
  }>;
}

/**
 * Service for performing selective MCP server restarts without full gateway restart
 * Communicates with the running gateway to manage individual child processes
 */
export class SelectiveRestartService {
  private gatewayUrl: string;
  private timeout: number;

  constructor(options: SelectiveRestartOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || 'http://localhost:9095';
    this.timeout = options.timeout || 30000;
  }

  /**
   * Check if the gateway is running and supports selective restart
   */
  async isGatewayRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.gatewayUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Perform selective restart based on configuration changes
   */
  async performSelectiveRestart(
    changeInfo: ConfigurationChangeInfo,
    newServerConfigs: MCPServerConfig[],
    options: SelectiveRestartOptions = {}
  ): Promise<SelectiveRestartResult> {
    const { showProgress = true } = options;
    
    const result: SelectiveRestartResult = {
      success: true,
      addedServers: [],
      removedServers: [],
      restartedServers: [],
      errors: []
    };

    if (!changeInfo.hasChanges) {
      if (showProgress) {
        console.log(chalk.green('✅ No configuration changes detected - all servers are up to date'));
      }
      return result;
    }

    // Check if gateway is running
    const isRunning = await this.isGatewayRunning();
    if (!isRunning) {
      throw new Error('Gateway is not running. Cannot perform selective restart.');
    }

    if (showProgress) {
      console.log(chalk.blue('\nPerforming selective MCP server restart...'));
    }

    // Step 1: Remove servers that are no longer needed
    if (changeInfo.removedServers.length > 0) {
      await this.removeServers(changeInfo.removedServers, result, showProgress);
    }

    // Step 2: Restart modified servers
    if (changeInfo.modifiedServers.length > 0) {
      const modifiedConfigs = newServerConfigs.filter(config => 
        changeInfo.modifiedServers.includes(config.installation_name)
      );
      await this.restartServers(modifiedConfigs, result, showProgress);
    }

    // Step 3: Add new servers
    if (changeInfo.addedServers.length > 0) {
      const addedConfigs = newServerConfigs.filter(config => 
        changeInfo.addedServers.includes(config.installation_name)
      );
      await this.addServers(addedConfigs, result, showProgress);
    }

    // Determine overall success
    result.success = result.errors.length === 0;

    if (showProgress) {
      this.printSummary(result);
    }

    return result;
  }

  /**
   * Remove servers from the running gateway
   */
  private async removeServers(
    serverNames: string[],
    result: SelectiveRestartResult,
    showProgress: boolean
  ): Promise<void> {
    if (showProgress) {
      console.log(chalk.red(`\nRemoving ${serverNames.length} server${serverNames.length === 1 ? '' : 's'}...`));
    }

    for (const serverName of serverNames) {
      let spinner: ReturnType<typeof ora> | null = null;
      
      try {
        if (showProgress) {
          spinner = ora(`Stopping ${serverName}...`).start();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.gatewayUrl}/api/mcp/servers/${encodeURIComponent(serverName)}`, {
          method: 'DELETE',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        result.removedServers.push(serverName);
        
        if (spinner) {
          spinner.succeed(`Stopped ${serverName}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          serverName,
          operation: 'remove',
          error: errorMessage
        });

        if (spinner) {
          spinner.fail(`Failed to stop ${serverName}`);
        }
        
        if (showProgress) {
          console.log(chalk.gray(`   Error: ${errorMessage}`));
        }
      }
    }
  }

  /**
   * Restart modified servers
   */
  private async restartServers(
    serverConfigs: MCPServerConfig[],
    result: SelectiveRestartResult,
    showProgress: boolean
  ): Promise<void> {
    if (showProgress) {
      console.log(chalk.yellow(`\nRestarting ${serverConfigs.length} modified server${serverConfigs.length === 1 ? '' : 's'}...`));
    }

    for (const config of serverConfigs) {
      let spinner: ReturnType<typeof ora> | null = null;
      
      try {
        if (showProgress) {
          spinner = ora(`Restarting ${config.installation_name}...`).start();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.gatewayUrl}/api/mcp/servers/${encodeURIComponent(config.installation_name)}/restart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ config }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        result.restartedServers.push(config.installation_name);
        
        if (spinner) {
          spinner.succeed(`Restarted ${config.installation_name}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          serverName: config.installation_name,
          operation: 'restart',
          error: errorMessage
        });

        if (spinner) {
          spinner.fail(`Failed to restart ${config.installation_name}`);
        }
        
        if (showProgress) {
          console.log(chalk.gray(`   Error: ${errorMessage}`));
        }
      }
    }
  }

  /**
   * Add new servers to the running gateway
   */
  private async addServers(
    serverConfigs: MCPServerConfig[],
    result: SelectiveRestartResult,
    showProgress: boolean
  ): Promise<void> {
    if (showProgress) {
      console.log(chalk.green(`\nAdding ${serverConfigs.length} new server${serverConfigs.length === 1 ? '' : 's'}...`));
    }

    for (const config of serverConfigs) {
      let spinner: ReturnType<typeof ora> | null = null;
      
      try {
        if (showProgress) {
          spinner = ora(`Starting ${config.installation_name}...`).start();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.gatewayUrl}/api/mcp/servers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ config }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        result.addedServers.push(config.installation_name);
        
        if (spinner) {
          spinner.succeed(`Started ${config.installation_name}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          serverName: config.installation_name,
          operation: 'add',
          error: errorMessage
        });

        if (spinner) {
          spinner.fail(`Failed to start ${config.installation_name}`);
        }
        
        if (showProgress) {
          console.log(chalk.gray(`   Error: ${errorMessage}`));
        }
      }
    }
  }

  /**
   * Print summary of selective restart operation
   */
  private printSummary(result: SelectiveRestartResult): void {
    console.log(chalk.blue('\nSelective Restart Summary:'));
    
    if (result.addedServers.length > 0) {
      console.log(chalk.green(`   Added: ${result.addedServers.length} server${result.addedServers.length === 1 ? '' : 's'}`));
    }
    
    if (result.removedServers.length > 0) {
      console.log(chalk.red(`   Removed: ${result.removedServers.length} server${result.removedServers.length === 1 ? '' : 's'}`));
    }
    
    if (result.restartedServers.length > 0) {
      console.log(chalk.yellow(`   Restarted: ${result.restartedServers.length} server${result.restartedServers.length === 1 ? '' : 's'}`));
    }
    
    if (result.errors.length > 0) {
      console.log(chalk.red(`   Errors: ${result.errors.length}`));
      result.errors.forEach(error => {
        console.log(chalk.gray(`      • ${error.serverName} (${error.operation}): ${error.error}`));
      });
    }

    if (result.success) {
      console.log(chalk.green('\n✅ Selective restart completed successfully'));
      console.log(chalk.gray('All changes applied without full gateway restart'));
    } else {
      console.log(chalk.yellow('\nSelective restart completed with errors'));
      console.log(chalk.gray('Some servers may require manual intervention'));
    }
  }
}
