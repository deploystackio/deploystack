import { GlobalSettingsService, GlobalSetting } from '../services/globalSettingsService';

/**
 * In-Memory Cache for Global Settings
 *
 * Provides instant access to global settings without database queries.
 * - Loaded once on server startup
 * - Invalidated (reloaded) when settings are written via GlobalSettingsService
 *
 * NOTE: This cache is for single-instance deployments only.
 * Multi-instance deployments would require Redis or pub/sub for cache synchronization.
 */
export class GlobalSettingsCache {
  private static cache: Map<string, GlobalSetting> = new Map();
  private static initialized: boolean = false;
  private static loading: Promise<void> | null = null;

  /**
   * Load all settings from database into memory.
   * Called on server startup and after any write operation.
   */
  static async load(): Promise<void> {
    // Prevent concurrent loads
    if (this.loading) {
      return this.loading;
    }

    this.loading = this.doLoad();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private static async doLoad(): Promise<void> {
    try {
      const settings = await GlobalSettingsService.getAll();

      // Clear and rebuild cache
      this.cache.clear();
      for (const setting of settings) {
        this.cache.set(setting.key, setting);
      }

      this.initialized = true;
    } catch (error) {
      // If load fails, mark as not initialized so fallback to DB works
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Get a setting from cache.
   * Returns null if not found.
   */
  static get(key: string): GlobalSetting | null {
    return this.cache.get(key) ?? null;
  }

  /**
   * Get all settings from cache.
   */
  static getAll(): GlobalSetting[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get all settings in a specific group.
   */
  static getByGroup(groupId: string): GlobalSetting[] {
    return Array.from(this.cache.values()).filter(
      (setting) => setting.group_id === groupId
    );
  }

  /**
   * Check if a setting exists in cache.
   */
  static exists(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Invalidate cache and reload from database.
   * Call this after any write operation (set, update, delete).
   */
  static async invalidate(): Promise<void> {
    await this.load();
  }

  /**
   * Check if cache is initialized and ready.
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the number of cached settings (for debugging/monitoring).
   */
  static size(): number {
    return this.cache.size;
  }

  /**
   * Clear the cache without reloading.
   * Use with caution - mainly for testing.
   */
  static clear(): void {
    this.cache.clear();
    this.initialized = false;
  }
}
