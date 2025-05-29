// services/frontend/src/plugin-system/types.ts
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'

export interface PluginMeta {
  id: string
  name: string
  version: string
  description: string
  author?: string
}

export interface Plugin {
  // Plugin metadata
  meta: PluginMeta

  // Initialize the plugin with Vue app, router, and store
  initialize: (app: App, router: Router, pinia: Pinia) => Promise<void> | void

  // Optional cleanup
  cleanup?: () => Promise<void> | void
}

// Add the missing interfaces
export interface PluginOptions {
  enabled?: boolean
  config?: Record<string, unknown>
}

export interface PluginConfiguration {
  paths?: string[]
  plugins?: Record<string, PluginOptions>
}
