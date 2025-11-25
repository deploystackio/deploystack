/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import { type AnyDatabase } from '../db';

import { 
  type Plugin, 
  type PluginPackage, 
  type PluginConfiguration,
  type PluginOptions,
  type GlobalSettingDefinitionForPlugin,
  type GlobalSettingGroupForPlugin,
  PluginRouteManager
} from './types';
import { type DeployStackEventBus } from '../events';
import { 
  PluginLoadError, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  PluginInitializeError, 
  PluginDuplicateError,
  PluginNotFoundError 
} from './errors';
import { GlobalSettingsService } from '../services/globalSettingsService';

/**
 * Plugin manager class responsible for loading and managing plugins
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginOptions: Map<string, PluginOptions> = new Map();
  private app: FastifyInstance | null = null;
  private db: AnyDatabase | null = null; // Updated type
  private eventBus: DeployStackEventBus | null = null;
  private pluginPaths: string[] = [];
  private initialized = false;
  private logger: FastifyBaseLogger | null = null;
  private pluginEventListeners: Map<string, Map<string, any>> = new Map();

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
    this.logger = app.log.child({ component: 'PluginManager' });
  }

  /**
   * Set the database instance that plugins will be initialized with
   */
  setDatabase(db: AnyDatabase | null): void { // Updated type
    this.db = db;
  }

  /**
   * Set the EventBus instance for plugin event listener registration
   */
  setEventBus(eventBus: DeployStackEventBus): void {
    this.eventBus = eventBus;
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
      this.logger?.debug(`Attempting to load plugin from: ${pluginPath}`);
      
      // Try to load as an ES module or CommonJS module
      let pluginPackage: PluginPackage;
      
      try {
        this.logger?.debug(`Trying to import as module: ${pluginPath}`);
        pluginPackage = await import(pluginPath);
      } catch (err) {
        this.logger?.debug({ error: err }, `Module import failed, trying require: ${pluginPath}`);
        // Using dynamic import with a constructed path to avoid require()
        // This is a workaround for the ESLint rule @typescript-eslint/no-require-imports
        pluginPackage = await import(`${pluginPath}`);
      }
      
      if (!pluginPackage.default) {
        this.logger?.debug(`No default export found in: ${pluginPath}`);
        throw new Error(`Plugin at ${pluginPath} does not export a default export`);
      }
      
      this.logger?.debug(`Found plugin class in: ${pluginPath}`);
      const PluginClass = pluginPackage.default;
      const plugin = new PluginClass();
      
      const { id } = plugin.meta;
      this.logger?.debug(`Instantiated plugin with ID: ${id}`);
      
      if (this.plugins.has(id)) {
        throw new PluginDuplicateError(id);
      }
      
      if (!this.isPluginEnabled(id)) {
        // Plugin is disabled, skip it
        this.logger?.debug(`Plugin ${id} is disabled, skipping`);
        return plugin;
      }
      
      this.plugins.set(id, plugin);
      this.logger?.debug(`Successfully loaded plugin: ${id}`);
      return plugin;
    } catch (error) {
      if (error instanceof PluginDuplicateError) {
        throw error;
      }
      this.logger?.error({ error }, `Error loading plugin from ${pluginPath}:`);
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
          this.logger?.info(`Plugin directory not found: ${pluginPath} - creating directory`);
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
                this.logger?.debug(`Found package.json in: ${entryPath}`);
                
                // Determine file extension based on whether we're running from dist
                const isRunningFromDist = __dirname.includes('/dist/');
                const pluginExtension = isRunningFromDist ? 'js' : 'ts';
                
                // Use entryPath as-is since server.ts now provides the correct path
                const pluginBasePath = entryPath;
                
                const mainPath = path.join(pluginBasePath, `index.${pluginExtension}`);
                
                this.logger?.debug(`Attempting to load plugin main from: ${mainPath}`);
                
                // Check if the file exists
                try {
                  await fsPromises.access(mainPath);
                  this.logger?.debug(`Found main file: ${mainPath}`);
                  await this.loadPlugin(mainPath);
                } catch (accessErr) {
                  this.logger?.debug({ error: accessErr }, `Main file not found: ${mainPath}, error:`);
                  
                  // If preferred file not found, try alternative
                  const altExtension = pluginExtension === 'ts' ? 'js' : 'ts';
                  const altPath = path.join(pluginBasePath, `index.${altExtension}`);
                  
                  try {
                    await fsPromises.access(altPath);
                    this.logger?.debug(`Found alternative file: ${altPath}`);
                    await this.loadPlugin(altPath);
                  } catch {
                    this.logger?.debug(`Alternative file not found either`);
                  }
                }
              } catch {
                // No package.json, skip
                this.logger?.debug(`No package.json found in: ${entryPath}`);
                continue;
              }
            }
          }
        } else {
          // If it's a file, load it directly
          await this.loadPlugin(pluginPath);
        }
      } catch (error) {
        this.logger?.error({ error }, `Error discovering plugins at ${pluginPath}:`);
      }
    }
    
    this.logger?.info(`Plugin discovery complete. ${this.plugins.size} plugins loaded.`);
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
   * Get all global setting groups defined by plugins
   */
  getPluginGlobalSettingGroups(): GlobalSettingGroupForPlugin[] {
    const allGroups: GlobalSettingGroupForPlugin[] = [];
    const groupIds = new Set<string>();

    for (const plugin of this.plugins.values()) {
      if (plugin.globalSettingsExtension?.groups) {
        for (const group of plugin.globalSettingsExtension.groups) {
          if (!groupIds.has(group.id)) {
            allGroups.push(group);
            groupIds.add(group.id);
          } else {
            this.logger?.warn(`Duplicate group ID '${group.id}' defined by plugin '${plugin.meta.id}'. Ignoring subsequent definition.`);
          }
        }
      }
    }
    return allGroups;
  }

  /**
   * Get all global setting definitions from plugins
   */
  getPluginGlobalSettingDefinitions(): { pluginId: string, definition: GlobalSettingDefinitionForPlugin }[] {
    const allDefinitions: { pluginId: string, definition: GlobalSettingDefinitionForPlugin }[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.globalSettingsExtension?.settings) {
        plugin.globalSettingsExtension.settings.forEach(definition => {
          allDefinitions.push({ pluginId: plugin.meta.id, definition });
        });
      }
    }
    return allDefinitions;
  }
  
  /**
   * Initialize global settings defined by plugins.
   * This should be called after core settings are initialized.
   */
  async initializePluginGlobalSettings(): Promise<void> {
    this.logger?.info('Initializing global settings from plugins...');
    const pluginGroups = this.getPluginGlobalSettingGroups();
    const pluginSettings = this.getPluginGlobalSettingDefinitions();

    // Initialize groups first
    for (const group of pluginGroups) {
      try {
        // Check if group exists (this logic might need to be in GlobalSettingsService or InitService)
        // For now, we assume GlobalSettingsService.set will handle linking to existing group or we manage group creation here.
        // Let's try to create/ensure group exists. This is a simplified version.
        // A more robust solution would use a method like GlobalSettingsInitService.createGroup
        const existingGroup = await GlobalSettingsService.getGroup(group.id); // Assuming getGroup exists
        if (!existingGroup) {
          // Attempt to create the group if it doesn't exist.
          await GlobalSettingsService.createGroup(group); 
          this.logger?.info(`Created global setting group ID '${group.id}' (Name: "${group.name}") as defined by a plugin.`);
        } else {
          // Group ID already exists. Log that the plugin's definition for this group ID (name, description, etc.) is ignored.
          this.logger?.warn(`Global setting group ID '${group.id}' already exists (Existing Name: "${existingGroup.name}"). Plugin's attempt to define a group with this ID (Plugin's proposed Name: "${group.name}") will use the existing group. Plugin-specific metadata for this group ID (name, description, icon, sort_order) is ignored.`);
        }
      } catch (error) {
        this.logger?.error({ error }, `Error processing plugin-defined group '${group.id}' (Plugin's proposed Name: "${group.name}"):`);
      }
    }

    // Initialize settings
    const initializedKeys = new Set<string>();
    // First, get all existing core setting keys to ensure precedence
    try {
      const coreSettings = await GlobalSettingsService.getAll();
      coreSettings.forEach(cs => initializedKeys.add(cs.key));
    } catch (error) {
      this.logger?.error({ error }, 'Failed to get all core settings for precedence check:');
      // If this fails, we might risk overwriting, but proceed with caution.
    }


    for (const { pluginId, definition } of pluginSettings) {
      if (initializedKeys.has(definition.key)) {
        this.logger?.warn(`Global setting key '${definition.key}' from plugin '${pluginId}' already exists (core or another plugin). Skipping.`);
        continue;
      }

      try {
        await GlobalSettingsService.setTyped(definition.key, definition.defaultValue, definition.type, {
          description: definition.description,
          encrypted: definition.encrypted,
          group_id: definition.groupId,
        });
        initializedKeys.add(definition.key); // Add to set after successful initialization
        this.logger?.info(`Initialized global setting '${definition.key}' from plugin '${pluginId}'.`);
      } catch (error) {
        this.logger?.error({ error }, `Failed to initialize global setting '${definition.key}' from plugin '${pluginId}':`);
      }
    }
    this.logger?.info('Plugin global settings initialization complete.');
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
        // Create a child logger for this plugin
        const pluginLogger = this.logger?.child({ pluginId: plugin.meta.id }) || this.app!.log.child({ pluginId: plugin.meta.id });
        
        // Initialize plugin (non-route initialization only)
        await plugin.initialize(this.db, pluginLogger);
        
        // Register plugin routes using the isolated route manager
        if (plugin.registerRoutes) {
          const routeManager = new PluginRouteManager(this.app, plugin.meta.id);
          await plugin.registerRoutes(routeManager, this.db, pluginLogger);
          this.logger?.info(`Registered routes for plugin: ${plugin.meta.id}`);
        }

        // Register plugin event listeners
        if (plugin.eventListeners && this.eventBus) {
          await this.registerEventListeners(plugin);
        }
      } catch (error) {
        // Log individual plugin initialization errors but continue with others.
        const typedError = error as Error;
        this.logger?.error({ error: typedError, stack: typedError.stack }, `Failed to initialize plugin ${plugin.meta.id}: ${typedError.message}`);
        // Optionally, re-throw: throw new PluginInitializeError(plugin.meta.id, error);
      }
    }
    
    this.initialized = true;
  }

  /**
   * Re-initialize plugins with database access
   * This is called after database setup to give plugins access to the database
   */
  async reinitializePluginsWithDatabase(): Promise<void> {
    if (!this.app) {
      throw new Error('Cannot re-initialize plugins: Fastify app not set');
    }
    
    if (!this.db) {
      throw new Error('Cannot re-initialize plugins: Database not set');
    }
    
    this.logger?.info('Re-initializing plugins with database access...');
    
    for (const plugin of this.plugins.values()) {
      try {
        // Only re-initialize plugins that have database extension or explicit reinitialize method
        if (plugin.databaseExtension || plugin.reinitialize) {
          if (plugin.reinitialize) {
            await plugin.reinitialize(this.app, this.db);
            this.logger?.info(`Re-initialized plugin: ${plugin.meta.id}`);
          } else {
            // For plugins with database extension but no reinitialize method,
            // we assume they can handle the database being available now
            this.logger?.info(`Plugin ${plugin.meta.id} has database extension but no reinitialize method - database is now available`);
          }
        }
      } catch (error) {
        const typedError = error as Error;
        this.logger?.error({ error: typedError, stack: typedError.stack }, `Failed to re-initialize plugin ${plugin.meta.id}: ${typedError.message}`);
        // Continue with other plugins even if one fails
      }
    }
    
    this.logger?.info('Plugin re-initialization completed.');
  }

  /**
   * Shut down all plugins
   */
  async shutdownPlugins(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.shutdown) {
        try {
          // Create a child logger for this plugin
          const pluginLogger = this.logger?.child({ pluginId: plugin.meta.id }) || this.app!.log.child({ pluginId: plugin.meta.id });
          await plugin.shutdown(pluginLogger);
        } catch (error) {
          this.logger?.error({ error }, `Error shutting down plugin ${plugin.meta.id}:`);
        }
      }
    }
    
    this.initialized = false;
  }

  /**
   * Register event listeners for a plugin
   * @param plugin The plugin to register event listeners for
   */
  private async registerEventListeners(plugin: Plugin): Promise<void> {
    if (!plugin.eventListeners || !this.eventBus) {
      return;
    }

    const listeners = new Map<string, any>();
    
    for (const [eventName, handler] of Object.entries(plugin.eventListeners)) {
      // Validate event name format
      if (!this.isValidEventName(eventName)) {
        throw new Error(`Invalid event name: ${eventName} in plugin ${plugin.meta.id}`);
      }

      // Wrap handler with error handling and plugin context
      const wrappedHandler = this.wrapEventHandler(plugin.meta.id, eventName, handler);
      
      // Register with event bus
      this.eventBus.registerPluginListener(plugin.meta.id, eventName as any, wrappedHandler);
      listeners.set(eventName, wrappedHandler);
      
      this.logger?.info(`Registered event listener for ${eventName} in plugin ${plugin.meta.id}`);
    }

    this.pluginEventListeners.set(plugin.meta.id, listeners);
    const listenerCount = listeners.size;
    this.logger?.info(`Registered ${listenerCount} event listeners for plugin: ${plugin.meta.id}`);
  }

  /**
   * Unregister event listeners for a plugin
   * @param plugin The plugin to unregister event listeners for
   */
  private async unregisterEventListeners(plugin: Plugin): Promise<void> {
    const listeners = this.pluginEventListeners.get(plugin.meta.id);
    if (!listeners || !this.eventBus) {
      return;
    }

    for (const [eventName] of listeners.entries()) {
      this.eventBus.unregisterPlugin(plugin.meta.id);
      this.logger?.info(`Unregistered event listener for ${eventName} in plugin ${plugin.meta.id}`);
    }

    this.pluginEventListeners.delete(plugin.meta.id);
  }

  /**
   * Wrap an event handler with error handling and plugin context
   * @param pluginId The plugin ID
   * @param eventName The event name
   * @param handler The original handler
   * @returns The wrapped handler
   */
  private wrapEventHandler(pluginId: string, eventName: string, handler: any): any {
    return async (eventData: any, context: any) => {
      try {
        this.logger?.debug(`Plugin ${pluginId} handling event ${eventName}`);
        await handler(eventData, context);
      } catch (error) {
        const typedError = error as Error;
        this.logger?.error({ error: typedError, stack: typedError.stack }, `Error in plugin ${pluginId} event handler for ${eventName}: ${typedError.message}`);
        
        // Emit error event for monitoring if eventBus is available
        if (this.eventBus) {
          this.eventBus.emitWithContext('plugin.error' as any, {
            pluginId,
            originalEvent: eventName,
            error: typedError.message,
            stack: typedError.stack
          }, context);
        }
      }
    };
  }

  /**
   * Validate event name format
   * @param eventName The event name to validate
   * @returns True if valid, false otherwise
   */
  private isValidEventName(eventName: string): boolean {
    // Validate against EVENT_NAMES constants pattern
    const validPattern = /^[a-z]+\.[a-z_]+$/;
    return validPattern.test(eventName);
  }

  /**
   * Get plugin event listeners for debugging
   * @param pluginId The plugin ID
   * @returns Array of event names the plugin is listening to
   */
  getPluginEventListeners(pluginId: string): string[] {
    const listeners = this.pluginEventListeners.get(pluginId);
    return listeners ? Array.from(listeners.keys()) : [];
  }

  /**
   * Get all registered event listeners
   * @returns Record of plugin IDs to their event listener names
   */
  getAllEventListeners(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    for (const [pluginId, listeners] of this.pluginEventListeners.entries()) {
      result[pluginId] = Array.from(listeners.keys());
    }
    
    return result;
  }
}
