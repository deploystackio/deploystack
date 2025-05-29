import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { type FastifyInstance } from 'fastify';
// import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'; // Replaced by AnyDatabase
import { type AnyDatabase } from '../db'; // Import the AnyDatabase union type

import { 
  type Plugin, 
  type PluginPackage, 
  type PluginConfiguration,
  type PluginOptions 
} from './types';
import { 
  PluginLoadError, 
  PluginInitializeError, 
  PluginDuplicateError,
  PluginNotFoundError 
} from './errors';

/**
 * Plugin manager class responsible for loading and managing plugins
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginOptions: Map<string, PluginOptions> = new Map();
  private app: FastifyInstance | null = null;
  private db: AnyDatabase | null = null; // Updated type
  private pluginPaths: string[] = [];
  private initialized = false;

  /**
   * Create a new plugin manager
   * @param config Optional plugin configuration
   */
  constructor(config?: PluginConfiguration) {
    if (config?.paths) {
      this.pluginPaths = config.paths;
    }
    
    if (config?.plugins) {
      Object.entries(config.plugins).forEach(([id, options]) => {
        this.pluginOptions.set(id, options);
      });
    }
  }

  /**
   * Set the Fastify app instance that plugins will be initialized with
   */
  setApp(app: FastifyInstance): void {
    this.app = app;
  }

  /**
   * Set the database instance that plugins will be initialized with
   */
  setDatabase(db: AnyDatabase | null): void { // Updated type
    this.db = db;
  }

  /**
   * Add a plugin path to search for plugins
   */
  addPluginPath(pluginPath: string): void {
    if (!this.pluginPaths.includes(pluginPath)) {
      this.pluginPaths.push(pluginPath);
    }
  }

  /**
   * Check if a plugin is enabled
   */
  isPluginEnabled(pluginId: string): boolean {
    return this.pluginOptions.get(pluginId)?.enabled !== false;
  }

  /**
   * Get a plugin's configuration
   */
  getPluginConfig(pluginId: string): Record<string, unknown> | undefined {
    return this.pluginOptions.get(pluginId)?.config;
  }

  /**
   * Register a plugin directly
   * @param plugin The plugin to register
   */
  registerPlugin(plugin: Plugin): void {
    const { id } = plugin.meta;
    
    if (this.plugins.has(id)) {
      throw new PluginDuplicateError(id);
    }
    
    this.plugins.set(id, plugin);
  }

  /**
   * Load a plugin from a path
   * @param pluginPath Path to the plugin
   */
  async loadPlugin(pluginPath: string): Promise<Plugin> {
    try {
      console.log(`[DEBUG] Attempting to load plugin from: ${pluginPath}`);
      
      // Try to load as an ES module or CommonJS module
      let pluginPackage: PluginPackage;
      
      try {
        console.log(`[DEBUG] Trying to import as module: ${pluginPath}`);
        pluginPackage = await import(pluginPath);
      } catch (err) {
        console.log(`[DEBUG] Module import failed, trying require: ${pluginPath}`, err);
        // Using dynamic import with a constructed path to avoid require()
        // This is a workaround for the ESLint rule @typescript-eslint/no-require-imports
        pluginPackage = await import(`${pluginPath}`);
      }
      
      if (!pluginPackage.default) {
        console.log(`[DEBUG] No default export found in: ${pluginPath}`);
        throw new Error(`Plugin at ${pluginPath} does not export a default export`);
      }
      
      console.log(`[DEBUG] Found plugin class in: ${pluginPath}`);
      const PluginClass = pluginPackage.default;
      const plugin = new PluginClass();
      
      const { id } = plugin.meta;
      console.log(`[DEBUG] Instantiated plugin with ID: ${id}`);
      
      if (this.plugins.has(id)) {
        throw new PluginDuplicateError(id);
      }
      
      if (!this.isPluginEnabled(id)) {
        // Plugin is disabled, skip it
        console.log(`[DEBUG] Plugin ${id} is disabled, skipping`);
        return plugin;
      }
      
      this.plugins.set(id, plugin);
      console.log(`[DEBUG] Successfully loaded plugin: ${id}`);
      return plugin;
    } catch (error) {
      if (error instanceof PluginDuplicateError) {
        throw error;
      }
      console.error(`[DEBUG] Error loading plugin from ${pluginPath}:`, error);
      throw new PluginLoadError(path.basename(pluginPath), error);
    }
  }

  /**
   * Discover and load all plugins from the configured paths
   */
  async discoverPlugins(): Promise<void> {
    for (const pluginPath of this.pluginPaths) {
      try {
        // Check if the plugin path exists
        if (!fs.existsSync(pluginPath)) {
          console.log(`[INFO] Plugin directory not found: ${pluginPath} - creating directory`);
          fs.mkdirSync(pluginPath, { recursive: true });
          continue; // Skip processing this directory as it's empty
        }
        
        const stat = await fsPromises.stat(pluginPath);
        
        if (stat.isDirectory()) {
          // If it's a directory, check for package.json
          const entries = await fsPromises.readdir(pluginPath);
          
          for (const entry of entries) {
            const entryPath = path.join(pluginPath, entry);
            const entryStat = await fsPromises.stat(entryPath);
            
            if (entryStat.isDirectory()) {
              // Check if this directory contains a package.json
              const packageJsonPath = path.join(entryPath, 'package.json');
              try {
                await fsPromises.access(packageJsonPath);
                console.log(`[DEBUG] Found package.json in: ${entryPath}`);
                
                // Check if we're running from dist directory
                const isRunningFromDist = __dirname.includes('/dist/');
                
                // Determine the appropriate plugin file path and extension
                let pluginBasePath = entryPath;
                let pluginExtension = isRunningFromDist ? 'js' : 'ts';
                
                // If running from dist and looking at a source path, redirect to dist
                if (isRunningFromDist && pluginBasePath.includes('/src/')) {
                  pluginBasePath = pluginBasePath.replace('/src/', '/dist/');
                }
                
                const mainPath = path.join(pluginBasePath, `index.${pluginExtension}`);
                
                console.log(`[DEBUG] Attempting to load plugin main from: ${mainPath}`);
                
                // Check if the file exists
                try {
                  await fsPromises.access(mainPath);
                  console.log(`[DEBUG] Found main file: ${mainPath}`);
                  await this.loadPlugin(mainPath);
                } catch (accessErr) {
                  console.log(`[DEBUG] Main file not found: ${mainPath}, error:`, accessErr);
                  
                  // If preferred file not found, try alternative
                  const altExtension = pluginExtension === 'ts' ? 'js' : 'ts';
                  const altPath = path.join(pluginBasePath, `index.${altExtension}`);
                  
                  try {
                    await fsPromises.access(altPath);
                    console.log(`[DEBUG] Found alternative file: ${altPath}`);
                    await this.loadPlugin(altPath);
                  } catch {
                    console.log(`[DEBUG] Alternative file not found either`);
                  }
                }
              } catch {
                // No package.json, skip
                console.log(`[DEBUG] No package.json found in: ${entryPath}`);
                continue;
              }
            }
          }
        } else {
          // If it's a file, load it directly
          await this.loadPlugin(pluginPath);
        }
      } catch (error) {
        console.error(`[ERROR] Error discovering plugins at ${pluginPath}:`, error);
      }
    }
    
    console.log(`[INFO] Plugin discovery complete. ${this.plugins.size} plugins loaded.`);
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(id: string): Plugin {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new PluginNotFoundError(id);
    }
    return plugin;
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all database extensions from plugins
   */
  getDatabaseExtensions(): Plugin[] {
    return this.getAllPlugins().filter(plugin => plugin.databaseExtension);
  }

  /**
   * Initialize all loaded plugins
   */
  async initializePlugins(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (!this.app) {
      throw new Error('Cannot initialize plugins: Fastify app not set');
    }
    
    // Do not throw if db is not set. Plugins should handle a null db if they need it.
    // if (!this.db) {
    //   throw new Error('Cannot initialize plugins: Database not set');
    // }
    
    for (const plugin of this.plugins.values()) {
      try {
        // Pass the potentially null db instance to plugins.
        // Plugin's initialize method must be able to handle db: AnyDatabase | null.
        if (!this.app) { // Should not happen if initial check passes
            throw new Error("Fastify app became null unexpectedly during plugin initialization.");
        }
        await plugin.initialize(this.app, this.db); 
      } catch (error) {
        // Log individual plugin initialization errors but continue with others.
        // If a single plugin failure should halt everything, re-throw the error.
        const typedError = error as Error;
        console.error(`[ERROR] Failed to initialize plugin ${plugin.meta.id}: ${typedError.message}`, typedError.stack);
        // Optionally, re-throw: throw new PluginInitializeError(plugin.meta.id, error);
      }
    }
    
    this.initialized = true;
  }

  /**
   * Shut down all plugins
   */
  async shutdownPlugins(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.shutdown) {
        try {
          await plugin.shutdown();
        } catch (error) {
          console.error(`Error shutting down plugin ${plugin.meta.id}:`, error);
        }
      }
    }
    
    this.initialized = false;
  }
}
