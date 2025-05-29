// src/plugin-system/plugin-manager.ts
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import {
  type Plugin,
  type PluginConfiguration,
  type PluginOptions
} from './types'
import { PluginLoadError, PluginInitializeError, PluginDuplicateError } from './errors.ts'
import { removePluginExtensions } from './extension-points'

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private pluginOptions: Map<string, PluginOptions> = new Map()
  private app: App | null = null
  private router: Router | null = null
  private pinia: Pinia | null = null
  private initialized = false

  constructor(config?: PluginConfiguration) {
    if (config?.plugins) {
      Object.entries(config.plugins).forEach(([id, options]) => {
        this.pluginOptions.set(id, options)
      })
    }
  }

  setApp(app: App): void {
    this.app = app
  }

  setRouter(router: Router): void {
    this.router = router
  }

  setPinia(pinia: Pinia): void {
    this.pinia = pinia
  }

  isPluginEnabled(pluginId: string): boolean {
    return this.pluginOptions.get(pluginId)?.enabled !== false
  }

  getPluginConfig(pluginId: string): Record<string, unknown> | undefined {
    return this.pluginOptions.get(pluginId)?.config
  }

  registerPlugin(plugin: Plugin): void {
    const { id } = plugin.meta

    if (this.plugins.has(id)) {
      throw new PluginDuplicateError(id)
    }

    this.plugins.set(id, plugin)
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id)
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  async loadPlugins(plugins: Plugin[]): Promise<void> {
    for (const plugin of plugins) {
      try {
        this.registerPlugin(plugin)
      } catch (error) {
        console.error(`Failed to load plugin ${plugin.meta.id}:`, error)
        throw new PluginLoadError(plugin.meta.id, error)
      }
    }
  }

  async initializePlugins(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (!this.app) {
      throw new Error('Cannot initialize plugins: Vue app not set')
    }

    if (!this.router) {
      throw new Error('Cannot initialize plugins: Router not set')
    }

    if (!this.pinia) {
      throw new Error('Cannot initialize plugins: Pinia not set')
    }

    for (const plugin of this.plugins.values()) {
      if (!this.isPluginEnabled(plugin.meta.id)) {
        continue
      }

      try {
        await plugin.initialize(this.app, this.router, this.pinia)
      } catch (error) {
        throw new PluginInitializeError(plugin.meta.id, error)
      }
    }

    this.initialized = true
  }

  async cleanupPlugins(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup()
        } catch (error) {
          console.error(`Error cleaning up plugin ${plugin.meta.id}:`, error)
        }
      }

      // Remove plugin's extension points
      removePluginExtensions(plugin.meta.id)
    }

    this.initialized = false
  }
}
