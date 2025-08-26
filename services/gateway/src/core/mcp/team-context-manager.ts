import chalk from 'chalk';
import { EventEmitter } from 'events';
import { RuntimeState, RuntimeProcessInfo } from '../process/runtime-state';
import { ProcessManager } from '../process/manager';
import { MCPConfigService } from './index';
import { DeployStackAPI } from '../auth/api-client';
import { TeamMCPConfig } from '../../types/mcp';

export interface TeamSwitchResult {
  success: boolean;
  oldTeamId: string | null;
  newTeamId: string;
  newTeamName: string;
  processesTerminated: number;
  processesStarted: number;
  errors: string[];
}

/**
 * Manages team context switching with MCP process lifecycle
 */
export class TeamContextManager extends EventEmitter {
  private runtimeState: RuntimeState;
  private processManager: ProcessManager;
  private mcpConfigService: MCPConfigService;

  constructor(
    runtimeState: RuntimeState,
    processManager: ProcessManager,
    mcpConfigService: MCPConfigService
  ) {
    super();
    this.runtimeState = runtimeState;
    this.processManager = processManager;
    this.mcpConfigService = mcpConfigService;
  }

  /**
   * Switch to a new team context
   * This involves stopping all current MCP servers and starting new team's servers
   */
  async switchTeam(
    newTeamId: string,
    newTeamName: string,
    api: DeployStackAPI,
    options: {
      forceRefresh?: boolean;
      continueOnError?: boolean;
      showProgress?: boolean;
    } = {}
  ): Promise<TeamSwitchResult> {
    const {
      forceRefresh = false,
      continueOnError = true,
      showProgress = true
    } = options;

    const oldTeamId = this.runtimeState.getCurrentTeam();
    const errors: string[] = [];

    if (showProgress) {
      console.log(chalk.blue(`🔄 Switching team context: ${oldTeamId || 'none'} → ${newTeamId}`));
    }

    this.emit('teamSwitchStarted', { oldTeamId, newTeamId, newTeamName });

    // Step 1: Stop all current team's MCP servers
    let processesTerminated = 0;
    if (oldTeamId) {
      try {
        if (showProgress) {
          console.log(chalk.gray('   Stopping current team\'s MCP servers...'));
        }

        const oldProcesses = await this.stopTeamProcesses(oldTeamId, showProgress);
        processesTerminated = oldProcesses.length;

        if (showProgress && processesTerminated > 0) {
          console.log(chalk.green(`✅ Stopped ${processesTerminated} MCP server${processesTerminated === 1 ? '' : 's'}`));
        }
      } catch (error) {
        const errorMsg = `Failed to stop old team processes: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        
        if (showProgress) {
          console.warn(chalk.yellow(`⚠️  ${errorMsg}`));
        }

        if (!continueOnError) {
          return {
            success: false,
            oldTeamId,
            newTeamId,
            newTeamName,
            processesTerminated,
            processesStarted: 0,
            errors
          };
        }
      }
    }

    // Step 2: Update team context
    this.runtimeState.setCurrentTeam(newTeamId);

    // Step 3: Download new team's MCP configuration
    let newTeamConfig: TeamMCPConfig;
    try {
      if (showProgress) {
        console.log(chalk.gray('   Downloading new team\'s MCP configuration...'));
      }

      // Detect device info for hardware_id
      const { detectDeviceInfo } = await import('../../utils/device-detection');
      const deviceInfo = await detectDeviceInfo();

      // Download merged configuration using new gateway endpoint
      const gatewayConfig = await this.mcpConfigService.downloadGatewayMCPConfig(
        deviceInfo.hardware_id,
        api,
        forceRefresh
      );
      
      // Convert and store the gateway config in the format expected by local storage
      newTeamConfig = this.mcpConfigService.convertGatewayConfigToTeamConfig(
        newTeamId,
        newTeamName,
        gatewayConfig
      );
      
      // Store the converted configuration
      await this.mcpConfigService.storeMCPConfig(newTeamConfig);

      if (showProgress) {
        console.log(chalk.green(`✅ Downloaded configuration for ${newTeamConfig.servers.length} MCP server${newTeamConfig.servers.length === 1 ? '' : 's'}`));
      }
    } catch (error) {
      const errorMsg = `Failed to download new team configuration: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);

      if (showProgress) {
        console.error(chalk.red(`❌ ${errorMsg}`));
      }

      // Rollback team context
      if (oldTeamId) {
        this.runtimeState.setCurrentTeam(oldTeamId);
      }

      return {
        success: false,
        oldTeamId,
        newTeamId,
        newTeamName,
        processesTerminated,
        processesStarted: 0,
        errors
      };
    }

    // Step 4: Start new team's MCP servers
    let processesStarted = 0;
    if (newTeamConfig.servers.length > 0) {
      try {
        if (showProgress) {
          console.log(chalk.gray('   Starting new team\'s MCP servers...'));
        }

        const startedProcesses = await this.startTeamProcesses(newTeamConfig, showProgress);
        processesStarted = startedProcesses.length;

        if (showProgress) {
          if (processesStarted > 0) {
            console.log(chalk.green(`✅ Started ${processesStarted} MCP server${processesStarted === 1 ? '' : 's'}`));
          } else {
            console.log(chalk.yellow('⚠️  No MCP servers were started'));
          }
        }
      } catch (error) {
        const errorMsg = `Failed to start new team processes: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);

        if (showProgress) {
          console.warn(chalk.yellow(`⚠️  ${errorMsg}`));
        }

        // Don't rollback here - partial success is acceptable
      }
    } else {
      if (showProgress) {
        console.log(chalk.gray('   No MCP servers configured for new team'));
      }
    }

    const success = errors.length === 0 || continueOnError;

    this.emit('teamSwitchCompleted', {
      success,
      oldTeamId,
      newTeamId,
      newTeamName,
      processesTerminated,
      processesStarted,
      errors
    });

    return {
      success,
      oldTeamId,
      newTeamId,
      newTeamName,
      processesTerminated,
      processesStarted,
      errors
    };
  }

  /**
   * Stop all MCP processes for a specific team
   */
  async stopTeamProcesses(teamId: string, showProgress: boolean = false): Promise<RuntimeProcessInfo[]> {
    const teamProcesses = this.runtimeState.getTeamProcesses(teamId);
    
    if (teamProcesses.length === 0) {
      return [];
    }

    if (showProgress) {
      console.log(chalk.gray(`   Stopping ${teamProcesses.length} MCP server${teamProcesses.length === 1 ? '' : 's'}...`));
    }

    const terminationPromises = teamProcesses.map(async (processInfo) => {
      try {
        if (showProgress) {
          console.log(chalk.gray(`     Stopping ${processInfo.installationName}...`));
        }

        await this.processManager.terminateProcess(processInfo, 5000);
        this.runtimeState.removeProcess(processInfo.id);

        if (showProgress) {
          console.log(chalk.green(`     ✅ Stopped ${processInfo.installationName}`));
        }

        return processInfo;
      } catch (error) {
        if (showProgress) {
          console.warn(chalk.yellow(`     ⚠️  Failed to stop ${processInfo.installationName}: ${error instanceof Error ? error.message : String(error)}`));
        }

        // Force remove from runtime state even if termination failed
        this.runtimeState.removeProcess(processInfo.id);
        return processInfo;
      }
    });

    const results = await Promise.allSettled(terminationPromises);
    const stoppedProcesses = results
      .filter((result): result is PromiseFulfilledResult<RuntimeProcessInfo> => result.status === 'fulfilled')
      .map(result => result.value);

    return stoppedProcesses;
  }

  /**
   * Start all MCP processes for a team configuration
   */
  async startTeamProcesses(teamConfig: TeamMCPConfig, showProgress: boolean = false): Promise<RuntimeProcessInfo[]> {
    if (teamConfig.servers.length === 0) {
      return [];
    }

    if (showProgress) {
      console.log(chalk.gray(`   Starting ${teamConfig.servers.length} MCP server${teamConfig.servers.length === 1 ? '' : 's'}...`));
    }

    const startedProcesses: RuntimeProcessInfo[] = [];

    for (const serverConfig of teamConfig.servers) {
      try {
        if (showProgress) {
          console.log(chalk.gray(`     Starting ${serverConfig.installation_name}...`));
        }

        const processInfo = await this.processManager.spawnProcess(serverConfig);
        
        // Find the installation ID from the team config
        const installation = teamConfig.installations.find(
          inst => inst.installation_name === serverConfig.installation_name
        );
        const installationId = installation?.id || serverConfig.installation_name;

        this.runtimeState.addProcess(
          processInfo,
          installationId,
          serverConfig.installation_name,
          teamConfig.team_id
        );

        const runtimeInfo = this.runtimeState.getProcess(processInfo.id);
        if (runtimeInfo) {
          startedProcesses.push(runtimeInfo);
        }

        if (showProgress) {
          console.log(chalk.green(`     ✅ Started ${serverConfig.installation_name}`));
        }

      } catch (error) {
        if (showProgress) {
          console.warn(chalk.yellow(`     ⚠️  Failed to start ${serverConfig.installation_name}: ${error instanceof Error ? error.message : String(error)}`));
        }
        // Continue with other servers
      }
    }

    return startedProcesses;
  }

  /**
   * Get current team's running processes
   */
  getCurrentTeamProcesses(): RuntimeProcessInfo[] {
    const currentTeamId = this.runtimeState.getCurrentTeam();
    if (!currentTeamId) {
      return [];
    }
    return this.runtimeState.getTeamProcesses(currentTeamId);
  }

  /**
   * Get current team's running process count
   */
  getCurrentTeamProcessCount(): number {
    return this.getCurrentTeamProcesses().length;
  }

  /**
   * Check if current team has any running processes
   */
  hasCurrentTeamProcesses(): boolean {
    return this.getCurrentTeamProcessCount() > 0;
  }

  /**
   * Restart a specific MCP server for the current team
   */
  async restartTeamProcess(installationName: string, showProgress: boolean = false): Promise<RuntimeProcessInfo | null> {
    const currentTeamId = this.runtimeState.getCurrentTeam();
    if (!currentTeamId) {
      throw new Error('No team context set');
    }

    const processInfo = this.runtimeState.getProcessByName(installationName);
    if (!processInfo) {
      throw new Error(`Process ${installationName} not found`);
    }

    if (processInfo.teamId !== currentTeamId) {
      throw new Error(`Process ${installationName} belongs to different team`);
    }

    if (showProgress) {
      console.log(chalk.blue(`🔄 Restarting ${installationName}...`));
    }

    try {
      // Stop the process
      await this.processManager.terminateProcess(processInfo, 5000);
      this.runtimeState.removeProcess(processInfo.id);

      if (showProgress) {
        console.log(chalk.gray(`   Stopped ${installationName}`));
      }

      // Start it again
      const newProcessInfo = await this.processManager.spawnProcess(processInfo.config);
      this.runtimeState.addProcess(
        newProcessInfo,
        processInfo.installationId,
        processInfo.installationName,
        processInfo.teamId
      );

      const newRuntimeInfo = this.runtimeState.getProcess(newProcessInfo.id);

      if (showProgress) {
        console.log(chalk.green(`✅ Restarted ${installationName}`));
      }

      return newRuntimeInfo;
    } catch (error) {
      if (showProgress) {
        console.error(chalk.red(`❌ Failed to restart ${installationName}: ${error instanceof Error ? error.message : String(error)}`));
      }
      throw error;
    }
  }

  /**
   * Get team switch status
   */
  getTeamSwitchStatus(): {
    currentTeamId: string | null;
    processCount: number;
    runningProcesses: number;
    failedProcesses: number;
  } {
    const currentTeamId = this.runtimeState.getCurrentTeam();
    const processes = currentTeamId ? this.runtimeState.getTeamProcesses(currentTeamId) : [];
    
    return {
      currentTeamId,
      processCount: processes.length,
      runningProcesses: processes.filter(p => p.status === 'running').length,
      failedProcesses: processes.filter(p => p.status === 'failed').length
    };
  }
}
