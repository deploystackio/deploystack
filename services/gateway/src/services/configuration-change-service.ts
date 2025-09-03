import chalk from 'chalk';
import inquirer from 'inquirer';
import { TeamMCPConfig, MCPServerConfig } from '../types/mcp';
import { ServerRestartService } from './server-restart-service';
import { SelectiveRestartService } from './selective-restart-service';

export interface ConfigurationChangeInfo {
  hasChanges: boolean;
  changes: string[];
  addedServers: string[];
  removedServers: string[];
  modifiedServers: string[];
}

/**
 * Service for detecting and handling MCP configuration changes
 * Provides reusable logic for comparing configurations and managing restart prompts
 */
export class ConfigurationChangeService {
  private restartService: ServerRestartService;
  private selectiveRestartService: SelectiveRestartService;

  constructor() {
    this.restartService = new ServerRestartService();
    this.selectiveRestartService = new SelectiveRestartService();
  }

  /**
   * Detect changes between old and new MCP configurations
   */
  detectConfigurationChanges(oldConfig: TeamMCPConfig | null, newConfig: TeamMCPConfig): ConfigurationChangeInfo {
    const changes: string[] = [];
    const addedServers: string[] = [];
    const removedServers: string[] = [];
    const modifiedServers: string[] = [];

    // If no old config, everything is new
    if (!oldConfig) {
      return {
        hasChanges: false, // Don't prompt for restart on first-time config
        changes: ['Initial configuration downloaded'],
        addedServers: newConfig.servers.map(s => s.installation_name),
        removedServers: [],
        modifiedServers: []
      };
    }

    // Create maps for easier comparison
    const oldServers = new Map(oldConfig.servers.map(s => [s.installation_name, s]));
    const newServers = new Map(newConfig.servers.map(s => [s.installation_name, s]));

    // Check for added servers
    for (const [name] of newServers) {
      if (!oldServers.has(name)) {
        addedServers.push(name);
        changes.push(`• ${chalk.green(name)}: Added to team configuration`);
      }
    }

    // Check for removed servers
    for (const [name] of oldServers) {
      if (!newServers.has(name)) {
        removedServers.push(name);
        changes.push(`• ${chalk.red(name)}: Removed from team configuration`);
      }
    }

    // Check for modified servers
    for (const [name, newServer] of newServers) {
      const oldServer = oldServers.get(name);
      if (oldServer && this.hasServerConfigChanged(oldServer, newServer)) {
        modifiedServers.push(name);
        const serverChanges = this.getServerChanges(oldServer, newServer);
        changes.push(`• ${chalk.yellow(name)}: ${serverChanges.join(', ')}`);
      }
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      addedServers,
      removedServers,
      modifiedServers
    };
  }

  /**
   * Check if a server configuration has changed
   */
  hasServerConfigChanged(oldServer: MCPServerConfig, newServer: MCPServerConfig): boolean {
    // Check command and args
    if (oldServer.command !== newServer.command) return true;
    if (JSON.stringify(oldServer.args) !== JSON.stringify(newServer.args)) return true;
    
    // Check environment variables
    if (JSON.stringify(oldServer.env) !== JSON.stringify(newServer.env)) return true;
    
    // Check runtime
    if (oldServer.runtime !== newServer.runtime) return true;
    
    return false;
  }

  /**
   * Get specific changes for a server
   */
  getServerChanges(oldServer: MCPServerConfig, newServer: MCPServerConfig): string[] {
    const changes: string[] = [];
    
    if (oldServer.command !== newServer.command) {
      changes.push('command updated');
    }
    
    if (JSON.stringify(oldServer.args) !== JSON.stringify(newServer.args)) {
      changes.push('arguments changed');
    }
    
    if (JSON.stringify(oldServer.env) !== JSON.stringify(newServer.env)) {
      changes.push('environment variables updated');
    }
    
    if (oldServer.runtime !== newServer.runtime) {
      changes.push('runtime changed');
    }
    
    return changes;
  }

  /**
   * Handle configuration changes with interactive restart prompt
   * Uses selective restart when possible, falls back to full restart
   */
  async handleConfigurationChanges(
    changeInfo: ConfigurationChangeInfo,
    newServerConfigs?: MCPServerConfig[]
  ): Promise<void> {
    console.log(chalk.blue('\n🔄 Configuration changes detected:'));
    changeInfo.changes.forEach(change => console.log(`   ${change}`));

    // Check if gateway is running
    const isRunning = this.restartService.isServerRunning();
    
    if (!isRunning) {
      console.log(chalk.gray('💡 Gateway is not currently running. Changes will take effect when you start it.'));
      return;
    }

    // Try selective restart first if we have server configs
    if (newServerConfigs && await this.selectiveRestartService.isGatewayRunning()) {
      console.log(chalk.blue('\nSelective restart available - only affected servers will be restarted.'));
      
      const { useSelectiveRestart } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useSelectiveRestart',
          message: 'Use selective restart (faster, no interruption to unchanged servers)?',
          default: true
        }
      ]);

      if (useSelectiveRestart) {
        try {
          const result = await this.selectiveRestartService.performSelectiveRestart(
            changeInfo,
            newServerConfigs,
            { showProgress: true }
          );

          if (result.success) {
            console.log(chalk.green('\n✅ Selective restart completed successfully'));
            console.log(chalk.gray('All changes applied without full gateway restart'));
            return;
          } else {
            console.log(chalk.yellow('\nSelective restart completed with errors'));
            console.log(chalk.gray('Falling back to full gateway restart...'));
          }
        } catch (error) {
          console.log(chalk.red(`❌ Selective restart failed: ${error instanceof Error ? error.message : String(error)}`));
          console.log(chalk.gray('Falling back to full gateway restart...'));
        }
      }
    }

    // Fall back to full gateway restart
    console.log(chalk.yellow('\nFull gateway restart required for changes to take effect.'));

    const { shouldRestart } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldRestart',
        message: 'Do you want to restart the DeployStack Gateway now?',
        default: true
      }
    ]);

    if (shouldRestart) {
      console.log(chalk.blue('\n🔄 Restarting gateway with updated configuration...'));
      
      try {
        const result = await this.restartService.restartGatewayServer();
        
        if (result.restarted) {
          console.log(chalk.green('✅ Gateway restarted successfully with new configuration'));
          
          if (result.mcpServersStarted !== undefined) {
            console.log(chalk.blue(`🤖 Ready to serve ${result.mcpServersStarted} MCP server${result.mcpServersStarted === 1 ? '' : 's'}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to restart gateway: ${error instanceof Error ? error.message : String(error)}`));
        console.log(chalk.gray('💡 You can restart manually with "deploystack restart"'));
      }
    } else {
      console.log(chalk.gray('💡 Configuration updated. Restart gateway manually with "deploystack restart" when ready.'));
    }
  }

  /**
   * Handle configuration changes with custom restart logic (for MCP command)
   * This version allows the caller to handle configuration storage and restart logic
   */
  async handleConfigurationChangesWithCustomRestart(
    changeInfo: ConfigurationChangeInfo,
    onRestart: () => Promise<void>
  ): Promise<void> {
    console.log(chalk.blue('\n🔄 Configuration changes detected:'));
    changeInfo.changes.forEach(change => console.log(`   ${change}`));

    console.log(chalk.yellow('\n⚠️  Gateway restart required for changes to take effect.'));

    // Check if gateway is running
    const isRunning = this.restartService.isServerRunning();
    
    if (!isRunning) {
      console.log(chalk.gray('💡 Gateway is not currently running. Changes will take effect when you start it.'));
      return;
    }

    // Prompt user for restart
    const { shouldRestart } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldRestart',
        message: 'Do you want to restart the DeployStack Gateway now?',
        default: true
      }
    ]);

    if (shouldRestart) {
      console.log(chalk.blue('\n🔄 Restarting gateway with updated configuration...'));
      await onRestart();
    } else {
      console.log(chalk.gray('💡 Configuration updated. Restart gateway manually with "deploystack restart" when ready.'));
    }
  }
}
