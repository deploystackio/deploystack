import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import chalk from 'chalk';
import { MCPTool, ToolDiscoveryService } from './tool-discovery';
import { MCPServerConfig } from '../../types/mcp';

export interface CachedServerTools {
  tools: MCPTool[];
  serverHash: string;
  lastDiscovered: string;
  status: 'success' | 'error';
  teamSpecificEnv: Record<string, string>;
  error?: string;
}

export interface TeamToolsCache {
  teamId: string;
  teamName: string;
  configHash: string;
  lastUpdated: string;
  servers: Record<string, CachedServerTools>;
}

export class ToolCacheService {
  private cacheDir: string;

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.deploystack', 'cache');
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Get team-specific cache directory
   */
  private getTeamCacheDir(teamId: string): string {
    return path.join(this.cacheDir, 'teams', teamId);
  }

  /**
   * Get team-specific cache file path
   */
  private getTeamCacheFile(teamId: string): string {
    return path.join(this.getTeamCacheDir(teamId), 'tools-cache.json');
  }

  /**
   * Generate team-aware server hash
   */
  getTeamServerHash(teamId: string, server: MCPServerConfig): string {
    return createHash('sha256')
      .update(JSON.stringify({
        teamId,
        command: server.command,
        args: server.args,
        env: server.env || {},
        runtime: server.runtime,
        installationName: server.installation_name
      }))
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for readability
  }

  /**
   * Load team's cached tools
   */
  async getCachedTools(teamId: string): Promise<TeamToolsCache | null> {
    try {
      const cacheFile = this.getTeamCacheFile(teamId);
      
      if (!await fs.pathExists(cacheFile)) {
        return null;
      }

      const cache = await fs.readJson(cacheFile) as TeamToolsCache;
      return cache;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to load cache for team ${teamId}:`, error));
      return null;
    }
  }

  /**
   * Check if team's cache is fresh
   */
  async isCacheFresh(teamId: string, maxAgeHours: number = 24): Promise<boolean> {
    const cache = await this.getCachedTools(teamId);
    if (!cache) {
      return false;
    }

    const cacheAge = Date.now() - new Date(cache.lastUpdated).getTime();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
    
    return cacheAge < maxAge;
  }

  /**
   * Cache tools for a specific server within team context
   */
  async cacheServerTools(
    teamId: string, 
    teamName: string,
    serverName: string, 
    tools: MCPTool[], 
    serverConfig: MCPServerConfig,
    configHash?: string
  ): Promise<void> {
    try {
      const cacheDir = this.getTeamCacheDir(teamId);
      await fs.ensureDir(cacheDir);

      // Load existing cache or create new
      let cache: TeamToolsCache = await this.getCachedTools(teamId) || {
        teamId,
        teamName,
        configHash: configHash || '',
        lastUpdated: new Date().toISOString(),
        servers: {}
      };

      // Update team name and config hash if provided
      if (teamName) cache.teamName = teamName;
      if (configHash) cache.configHash = configHash;

      // Update specific server data
      cache.servers[serverName] = {
        tools,
        serverHash: this.getTeamServerHash(teamId, serverConfig),
        lastDiscovered: new Date().toISOString(),
        status: 'success',
        teamSpecificEnv: serverConfig.env || {}
      };

      // Update cache metadata
      cache.lastUpdated = new Date().toISOString();

      // Save updated cache
      const cacheFile = this.getTeamCacheFile(teamId);
      await fs.writeJson(cacheFile, cache, { spaces: 2 });

      console.log(chalk.gray(`💾 Cache updated for server: ${serverName} (${tools.length} tools)`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to cache tools for ${serverName}:`, error));
    }
  }

  /**
   * Cache server error
   */
  async cacheServerError(
    teamId: string,
    teamName: string,
    serverName: string,
    serverConfig: MCPServerConfig,
    error: string,
    configHash?: string
  ): Promise<void> {
    try {
      const cacheDir = this.getTeamCacheDir(teamId);
      await fs.ensureDir(cacheDir);

      // Load existing cache or create new
      let cache: TeamToolsCache = await this.getCachedTools(teamId) || {
        teamId,
        teamName,
        configHash: configHash || '',
        lastUpdated: new Date().toISOString(),
        servers: {}
      };

      // Update team name and config hash if provided
      if (teamName) cache.teamName = teamName;
      if (configHash) cache.configHash = configHash;

      // Update specific server data with error
      cache.servers[serverName] = {
        tools: [],
        serverHash: this.getTeamServerHash(teamId, serverConfig),
        lastDiscovered: new Date().toISOString(),
        status: 'error',
        teamSpecificEnv: serverConfig.env || {},
        error
      };

      // Update cache metadata
      cache.lastUpdated = new Date().toISOString();

      // Save updated cache
      const cacheFile = this.getTeamCacheFile(teamId);
      await fs.writeJson(cacheFile, cache, { spaces: 2 });

      console.log(chalk.gray(`💾 Cache updated with error for server: ${serverName}`));
    } catch (cacheError) {
      console.warn(chalk.yellow(`⚠️  Failed to cache error for ${serverName}:`, cacheError));
    }
  }

  /**
   * Force refresh specific server's tools
   */
  async refreshServerTools(
    teamId: string,
    teamName: string,
    serverName: string,
    serverConfig: MCPServerConfig,
    configHash?: string
  ): Promise<MCPTool[]> {
    const toolDiscovery = new ToolDiscoveryService();
    const result = await toolDiscovery.discoverTools(serverConfig);

    if (result.error) {
      // Cache the error
      await this.cacheServerError(teamId, teamName, serverName, serverConfig, result.error, configHash);
      throw new Error(`Tool discovery failed: ${result.error}`);
    }

    // Update cache with fresh data
    await this.cacheServerTools(teamId, teamName, serverName, result.tools, serverConfig, configHash);

    return result.tools;
  }

  /**
   * Get cached tools for a specific server
   */
  async getServerTools(teamId: string, serverName: string): Promise<MCPTool[] | null> {
    const cache = await this.getCachedTools(teamId);
    if (!cache || !cache.servers[serverName]) {
      return null;
    }

    const serverCache = cache.servers[serverName];
    if (serverCache.status === 'error') {
      return null;
    }

    return serverCache.tools;
  }

  /**
   * Check if server cache is valid (hash matches)
   */
  async isServerCacheValid(teamId: string, serverName: string, serverConfig: MCPServerConfig): Promise<boolean> {
    const cache = await this.getCachedTools(teamId);
    if (!cache || !cache.servers[serverName]) {
      return false;
    }

    const currentHash = this.getTeamServerHash(teamId, serverConfig);
    return cache.servers[serverName].serverHash === currentHash;
  }

  /**
   * Invalidate specific team's cache
   */
  async invalidateTeamCache(teamId: string): Promise<void> {
    try {
      const cacheFile = this.getTeamCacheFile(teamId);
      if (await fs.pathExists(cacheFile)) {
        await fs.remove(cacheFile);
        console.log(chalk.gray(`🗑️  Invalidated cache for team: ${teamId}`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to invalidate cache for team ${teamId}:`, error));
    }
  }

  /**
   * Invalidate all teams cache
   */
  async invalidateAllCache(): Promise<void> {
    try {
      const teamsDir = path.join(this.cacheDir, 'teams');
      if (await fs.pathExists(teamsDir)) {
        await fs.remove(teamsDir);
        console.log(chalk.gray(`🗑️  Invalidated all team caches`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to invalidate all caches:`, error));
    }
  }

  /**
   * Handle team switching
   */
  async handleTeamSwitch(oldTeamId: string | null, newTeamId: string): Promise<void> {
    // Note: We don't clear old team cache on switch, just prepare for new team
    // This allows users to switch back and forth without losing cache
    console.log(chalk.gray(`🔄 Switching team context: ${oldTeamId || 'none'} → ${newTeamId}`));
  }

  /**
   * Get cache summary for a team
   */
  async getCacheSummary(teamId: string): Promise<{
    exists: boolean;
    fresh: boolean;
    serverCount: number;
    totalTools: number;
    lastUpdated?: string;
    servers: Array<{
      name: string;
      toolCount: number;
      status: 'success' | 'error';
      lastDiscovered: string;
      error?: string;
    }>;
  }> {
    const cache = await this.getCachedTools(teamId);
    
    if (!cache) {
      return {
        exists: false,
        fresh: false,
        serverCount: 0,
        totalTools: 0,
        servers: []
      };
    }

    const fresh = await this.isCacheFresh(teamId);
    const servers = Object.entries(cache.servers).map(([name, data]) => ({
      name,
      toolCount: data.tools.length,
      status: data.status,
      lastDiscovered: data.lastDiscovered,
      error: data.error
    }));

    const totalTools = servers.reduce((sum, server) => sum + server.toolCount, 0);

    return {
      exists: true,
      fresh,
      serverCount: servers.length,
      totalTools,
      lastUpdated: cache.lastUpdated,
      servers
    };
  }

  /**
   * Get all cached tools for a team (flattened with namespacing)
   */
  async getAllTeamTools(teamId: string): Promise<Array<MCPTool & { serverName: string; namespacedName: string }>> {
    const cache = await this.getCachedTools(teamId);
    if (!cache) {
      return [];
    }

    const allTools: Array<MCPTool & { serverName: string; namespacedName: string }> = [];

    for (const [serverName, serverData] of Object.entries(cache.servers)) {
      if (serverData.status === 'success') {
        for (const tool of serverData.tools) {
          allTools.push({
            ...tool,
            serverName,
            namespacedName: `${serverName}-${tool.name}`
          });
        }
      }
    }

    return allTools;
  }
}
