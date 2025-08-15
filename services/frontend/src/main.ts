import './assets/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import mitt from 'mitt'

import App from './App.vue'
import router from './router'
import i18n from './i18n'

import { PluginManager } from './plugin-system/plugin-manager'
import { loadPlugins } from './plugins'
import ExtensionPoint from './components/ExtensionPoint.vue'
import type { EventBusEvents } from './composables/useEventBus'
import { registerSettingsComponents } from './components/globalSettings'

const app = createApp(App)
const pinia = createPinia()

// Create event bus
const emitter = mitt<EventBusEvents>()

// Register global components
app.component('ExtensionPoint', ExtensionPoint)

// Initialize plugin manager
const pluginManager = new PluginManager()

// Set the app, router and store for plugins to use
pluginManager.setApp(app)
pluginManager.setRouter(router)
pluginManager.setPinia(pinia)

// Use Vue plugins
app.use(pinia)
app.use(router)
app.use(i18n)

// Provide global services
app.provide('pluginManager', pluginManager)
app.provide('emitter', emitter)

// Initialize application with plugins
async function initializeApplication() {
  try {
    // Register custom settings components
    registerSettingsComponents()

    // Load available plugins
    const plugins = await loadPlugins()
    await pluginManager.loadPlugins(plugins)

    // Initialize plugins
    await pluginManager.initializePlugins()

    // Mount the app after plugins are initialized
    app.mount('#app')
  } catch (error) {
    console.error('Failed to initialize application:', error)
    // Mount the app even if plugin initialization fails
    app.mount('#app')
  }
}

// Start the application
initializeApplication()
