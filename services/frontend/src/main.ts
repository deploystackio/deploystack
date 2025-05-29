import './assets/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import i18n from './i18n'

import { PluginManager } from './plugin-system/plugin-manager'
import { loadPlugins } from './plugins'
import ExtensionPoint from './components/ExtensionPoint.vue'

const app = createApp(App)
const pinia = createPinia()

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

// Make plugin manager available globally in the app
app.provide('pluginManager', pluginManager)

// Initialize application with plugins
async function initializeApplication() {
  try {
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
