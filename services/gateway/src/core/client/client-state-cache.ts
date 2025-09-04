import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface CachedClientInfo {
  id: string;
  type: 'SSE' | 'Streamable HTTP';
  clientInfo?: {
    name: string;
    version: string;
  };
  createdAt: number;
  lastActivity: number;
  requestCount: number;
  errorCount: number;
  mcpInitialized: boolean;
  status: 'connected' | 'disconnected';
  userAgent?: string;
  remoteAddress?: string;
}

export interface ClientStateCache {
  lastUpdated: string;
  clients: Record<string, CachedClientInfo>;
}

export class ClientStateCacheService {
  private cacheDir: string;
  private cacheFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.deploystack', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'clients-state.json');
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Get cache file path
   */
  getCacheFile(): string {
    return this.cacheFile;
  }

  /**
   * Load cached client state
   */
  async getCachedClientState(): Promise<ClientStateCache | null> {
    try {
      if (!await fs.pathExists(this.cacheFile)) {
        return null;
      }

      const cache = await fs.readJson(this.cacheFile) as ClientStateCache;
      return cache;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to load client state cache:`, error));
      return null;
    }
  }

  /**
   * Save client state cache with queue to prevent race conditions
   */
  private async saveCachedClientState(cache: ClientStateCache): Promise<void> {
    // Queue the write operation to prevent concurrent writes
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.ensureDir(this.cacheDir);
        await fs.writeJson(this.cacheFile, cache, { spaces: 2 });
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to save client state cache:`, error));
        throw error;
      }
    });
    
    return this.writeQueue;
  }

  /**
   * Add or update client in cache
   */
  async updateClient(clientInfo: CachedClientInfo): Promise<void> {
    try {
      // Load existing cache or create new
      let cache: ClientStateCache = await this.getCachedClientState() || {
        lastUpdated: new Date().toISOString(),
        clients: {}
      };

      // Update client data
      cache.clients[clientInfo.id] = {
        ...clientInfo,
        lastActivity: Date.now()
      };

      // Update cache metadata
      cache.lastUpdated = new Date().toISOString();

      // Save updated cache
      await this.saveCachedClientState(cache);

      console.log(chalk.gray(`💾 Client cache updated: ${clientInfo.id} (${clientInfo.type})`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to update client cache for ${clientInfo.id}:`, error));
    }
  }

  /**
   * Update client activity
   */
  async updateClientActivity(clientId: string): Promise<void> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache || !cache.clients[clientId]) {
        return;
      }

      // Update activity and request count
      cache.clients[clientId].lastActivity = Date.now();
      cache.clients[clientId].requestCount++;
      cache.lastUpdated = new Date().toISOString();

      await this.saveCachedClientState(cache);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to update client activity for ${clientId}:`, error));
    }
  }

  /**
   * Increment client error count
   */
  async incrementClientErrorCount(clientId: string): Promise<void> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache || !cache.clients[clientId]) {
        return;
      }

      // Increment error count
      cache.clients[clientId].errorCount++;
      cache.clients[clientId].lastActivity = Date.now();
      cache.lastUpdated = new Date().toISOString();

      await this.saveCachedClientState(cache);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to increment error count for ${clientId}:`, error));
    }
  }

  /**
   * Set client as MCP initialized
   */
  async setClientMcpInitialized(clientId: string): Promise<void> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache || !cache.clients[clientId]) {
        return;
      }

      // Mark as initialized
      cache.clients[clientId].mcpInitialized = true;
      cache.clients[clientId].lastActivity = Date.now();
      cache.lastUpdated = new Date().toISOString();

      await this.saveCachedClientState(cache);

      console.log(chalk.gray(`✅ Client marked as MCP initialized: ${clientId}`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to set MCP initialized for ${clientId}:`, error));
    }
  }

  /**
   * Set client info (name, version)
   */
  async setClientInfo(clientId: string, clientInfo: { name: string; version: string }): Promise<void> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache || !cache.clients[clientId]) {
        return;
      }

      // Update client info
      cache.clients[clientId].clientInfo = clientInfo;
      cache.clients[clientId].lastActivity = Date.now();
      cache.lastUpdated = new Date().toISOString();

      await this.saveCachedClientState(cache);

      console.log(chalk.gray(`📝 Client info updated: ${clientId} (${clientInfo.name} v${clientInfo.version})`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to set client info for ${clientId}:`, error));
    }
  }

  /**
   * Remove client from cache (on disconnect)
   */
  async removeClient(clientId: string): Promise<void> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache || !cache.clients[clientId]) {
        return;
      }

      // Mark as disconnected instead of removing (for history)
      cache.clients[clientId].status = 'disconnected';
      cache.clients[clientId].lastActivity = Date.now();
      cache.lastUpdated = new Date().toISOString();

      await this.saveCachedClientState(cache);

      console.log(chalk.gray(`🔌 Client marked as disconnected: ${clientId}`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to remove client ${clientId}:`, error));
    }
  }

  /**
   * Get all active clients
   */
  async getActiveClients(): Promise<CachedClientInfo[]> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache) {
        return [];
      }

      return Object.values(cache.clients).filter(client => client.status === 'connected');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to get active clients:`, error));
      return [];
    }
  }

  /**
   * Get all clients (including disconnected)
   */
  async getAllClients(): Promise<CachedClientInfo[]> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache) {
        return [];
      }

      return Object.values(cache.clients);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to get all clients:`, error));
      return [];
    }
  }

  /**
   * Get client by ID
   */
  async getClient(clientId: string): Promise<CachedClientInfo | null> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache || !cache.clients[clientId]) {
        return null;
      }

      return cache.clients[clientId];
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to get client ${clientId}:`, error));
      return null;
    }
  }

  /**
   * Clean up old disconnected clients (older than specified hours)
   */
  async cleanupOldClients(maxAgeHours: number = 24): Promise<void> {
    try {
      const cache = await this.getCachedClientState();
      if (!cache) {
        return;
      }

      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
      const cutoffTime = Date.now() - maxAge;
      let removedCount = 0;

      // Remove old disconnected clients
      for (const [clientId, client] of Object.entries(cache.clients)) {
        if (client.status === 'disconnected' && client.lastActivity < cutoffTime) {
          delete cache.clients[clientId];
          removedCount++;
        }
      }

      if (removedCount > 0) {
        cache.lastUpdated = new Date().toISOString();
        await this.saveCachedClientState(cache);
        console.log(chalk.gray(`🗑️  Cleaned up ${removedCount} old client record${removedCount === 1 ? '' : 's'}`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to cleanup old clients:`, error));
    }
  }

  /**
   * Get cache summary
   */
  async getCacheSummary(): Promise<{
    exists: boolean;
    totalClients: number;
    activeClients: number;
    disconnectedClients: number;
    sseClients: number;
    streamableHttpClients: number;
    lastUpdated?: string;
  }> {
    try {
      const cache = await this.getCachedClientState();
      
      if (!cache) {
        return {
          exists: false,
          totalClients: 0,
          activeClients: 0,
          disconnectedClients: 0,
          sseClients: 0,
          streamableHttpClients: 0
        };
      }

      const clients = Object.values(cache.clients);
      const activeClients = clients.filter(c => c.status === 'connected');
      const disconnectedClients = clients.filter(c => c.status === 'disconnected');
      const sseClients = activeClients.filter(c => c.type === 'SSE');
      const streamableHttpClients = activeClients.filter(c => c.type === 'Streamable HTTP');

      return {
        exists: true,
        totalClients: clients.length,
        activeClients: activeClients.length,
        disconnectedClients: disconnectedClients.length,
        sseClients: sseClients.length,
        streamableHttpClients: streamableHttpClients.length,
        lastUpdated: cache.lastUpdated
      };
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to get cache summary:`, error));
      return {
        exists: false,
        totalClients: 0,
        activeClients: 0,
        disconnectedClients: 0,
        sseClients: 0,
        streamableHttpClients: 0
      };
    }
  }

  /**
   * Clear all client cache
   */
  async clearCache(): Promise<void> {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        await fs.remove(this.cacheFile);
        console.log(chalk.gray(`Client state cache cleared`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`Failed to clear client cache:`, error));
    }
  }
}
