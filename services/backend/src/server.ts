import fastify from 'fastify'
import path from 'node:path'
import { loggerConfig } from './fastify/config/logger'
import { registerRequestLoggerHooks } from './fastify/hooks/request-logger'
import { registerFastifyPlugins } from './fastify/plugins'
import { registerRoutes } from './routes'
import { PluginManager } from './plugin-system'
import { initializeDatabase, registerPluginTables, initializePluginDatabases, createPluginTables } from './db'

// Import type extensions
import './types/fastify'

// Create and configure the server
export const createServer = async () => {
  const server = fastify({
    logger: loggerConfig,
    disableRequestLogging: true // We'll add our own custom request logging
  })

  // Register request logger hooks
  registerRequestLoggerHooks(server)
  
  // Register plugins
  await registerFastifyPlugins(server)
  
  // Initialize the database
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'deploystack.db')
  const migrationsPath = path.join(process.cwd(), 'migrations')
  
  const { db, sqlite } = await initializeDatabase(dbPath, migrationsPath)
  
  // Store database in Fastify instance for use in routes
  server.decorate('db', db)
  server.decorate('sqlite', sqlite)
  
  // Create and configure the plugin manager
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const pluginManager = new PluginManager({
    paths: [
      // Look for built-in plugins - adjust the path for development mode
      isDevelopment 
        ? path.join(process.cwd(), 'src', 'plugins')
        : path.join(__dirname, 'plugins'),
      // Look for external plugins
      process.env.PLUGINS_PATH || path.join(process.cwd(), 'plugins'),
    ],
    plugins: {
      // Plugin configurations can be loaded from config file or env vars
    }
  })
  
  // Set the Fastify app and database instances
  pluginManager.setApp(server)
  pluginManager.setDatabase(db)
  
  // Discover available plugins
  await pluginManager.discoverPlugins()
  
  // Register plugin tables to schema
  registerPluginTables(pluginManager.getAllPlugins())

  // Create plugin tables in the database
  await createPluginTables(db, pluginManager.getAllPlugins());
  
  // Initialize plugin databases
  await initializePluginDatabases(db, pluginManager.getDatabaseExtensions())
  
  // Initialize plugins (routes, hooks, etc.)
  await pluginManager.initializePlugins()
  
  // Store plugin manager in Fastify instance
  server.decorate('pluginManager', pluginManager)
  
  // Register routes
  registerRoutes(server)
  
  // Handle server close event for cleanup
  server.addHook('onClose', async () => {
    await pluginManager.shutdownPlugins()
    sqlite.close()
  })
  
  return server
}
