/* eslint-disable @typescript-eslint/no-explicit-any */
import fastify from 'fastify'
import path from 'node:path'
import { loggerConfig } from './fastify/config/logger'
import { registerRequestLoggerHooks } from './fastify/hooks/request-logger'
import { registerFastifyPlugins } from './fastify/plugins'
import fastifyCookie from '@fastify/cookie';
import { registerRoutes } from './routes'
import { PluginManager } from './plugin-system'
import { authHook } from './hooks/authHook' // Import the auth hook
import registerEmailRoute from './routes/auth/registerEmail'
import loginEmailRoute from './routes/auth/loginEmail'
import githubAuthRoutes from './routes/auth/github'
import logoutRoute from './routes/auth/logout'
import { 
  initializeDatabase, 
  registerPluginTables, 
  initializePluginDatabases, 
  createPluginTables,
  getDb,
  getDbConnection,
  getDbStatus
} from './db'
import { GlobalSettingsInitService } from './global-settings'
import type SqliteDriver from 'better-sqlite3'; // For type checking in onClose
import type { FastifyInstance } from 'fastify'

// Import type extensions
import './types/fastify'

/**
 * Initialize database-dependent services
 * This function can be called both during server startup and after database setup
 */
export async function initializeDatabaseDependentServices(
  server: FastifyInstance, 
  pluginManager: PluginManager
): Promise<boolean> {
  try {
    // Initialize the database using the new mechanism
    const dbSuccessfullyInitialized = await initializeDatabase();

    if (dbSuccessfullyInitialized) {
      const dbInstance = getDb();
      const rawConnection = getDbConnection();

      // Update Fastify decorations with real database instances
      // Check if decorations already exist to avoid redecoration errors
      if (!server.hasDecorator('db')) {
        server.decorate('db', dbInstance as any);
      } else {
        (server as any).db = dbInstance;
      }
      
      if (!server.hasDecorator('rawDbConnection')) {
        server.decorate('rawDbConnection', rawConnection as any);
      } else {
        (server as any).rawDbConnection = rawConnection;
      }
      server.log.info('Database connection established and decorated.');

      pluginManager.setDatabase(dbInstance as any); // Set Drizzle instance for plugins

      // Create plugin tables in the database (Note: better handled by migrations)
      await createPluginTables(pluginManager.getAllPlugins());
    
      // Initialize plugin database extensions (e.g., run plugin-specific setup)
      const dbExtensions = pluginManager.getAllPlugins().filter(p => p.databaseExtension);
      await initializePluginDatabases(dbInstance, dbExtensions);
      
      // Initialize global settings
      try {
        await GlobalSettingsInitService.loadSettingsDefinitions();
        await GlobalSettingsInitService.initializeSettings();
        server.log.info('Core global settings initialization completed.');

        // Initialize global settings defined by plugins
        await pluginManager.initializePluginGlobalSettings();
        server.log.info('Plugin global settings initialization completed.');

      } catch (error) {
        server.log.error('Failed to initialize global settings (core or plugin):', error);
      }

      return true;
    } else {
      // Database not configured - set null decorations
      if (!server.hasDecorator('db')) {
        server.decorate('db', null as any);
      } else {
        (server as any).db = null;
      }
      
      if (!server.hasDecorator('rawDbConnection')) {
        server.decorate('rawDbConnection', null as any);
      } else {
        (server as any).rawDbConnection = null;
      }
      server.log.warn('Database is not configured or failed to initialize. Some features may be unavailable. Please use the setup API.');
      pluginManager.setDatabase(null as any);
      return false;
    }
  } catch (error) {
    server.log.error('Error during database-dependent services initialization:', error);
    return false;
  }
}

/**
 * Re-initialize plugins with database access
 * This is called after database setup to give plugins access to the database
 */
export async function reinitializePluginsWithDatabase(
  server: FastifyInstance,
  pluginManager: PluginManager
): Promise<void> {
  try {
    server.log.info('Re-initializing plugins with database access...');
    
    // Use the PluginManager's method to re-initialize plugins
    await pluginManager.reinitializePluginsWithDatabase();
    
    server.log.info('Plugin re-initialization completed.');
  } catch (error) {
    server.log.error('Error during plugin re-initialization:', error);
    throw error;
  }
}

// Create and configure the server
export const createServer = async () => {
  const server = fastify({
    logger: loggerConfig,
    disableRequestLogging: true 
  })

  registerRequestLoggerHooks(server)
  
  // Register @fastify/cookie
  await server.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'a-very-secret-and-strong-secret-for-cookies', // Replace with a strong secret from env
    parseOptions: {} 
  });
  server.log.info('@fastify/cookie registered.');

  await registerFastifyPlugins(server) // Existing plugin registrations

  // Register the global authentication hook
  // This hook will run on every request to populate request.user and request.session
  server.addHook('onRequest', authHook);
  server.log.info('Global auth hook registered.');

  // Create and configure the plugin manager
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const pluginManager = new PluginManager({
    paths: [
      process.env.PLUGINS_PATH || (isDevelopment 
        ? path.join(process.cwd(), 'src', 'plugins')
        : path.join(__dirname, 'plugins')),
    ],
    plugins: {}
  })
  
  pluginManager.setApp(server); // Set app early for plugins that might need it

  // Discover available plugins first
  await pluginManager.discoverPlugins();
  
  // Register plugin table definitions (populates inputPluginTableDefinitions in db/index.ts)
  // This must happen before initializeDatabase, which generates the actual schema
  registerPluginTables(pluginManager.getAllPlugins());

  // Initialize database-dependent services
  await initializeDatabaseDependentServices(server, pluginManager);
  
  // Initialize plugins (routes, hooks, etc.)
  // This should happen after DB and other core services are ready (or known to be unavailable)
  await pluginManager.initializePlugins();
  
  server.decorate('pluginManager', pluginManager);
  
  // Add method to server for re-initializing database services
  server.decorate('reinitializeDatabaseServices', async () => {
    return await initializeDatabaseDependentServices(server, pluginManager);
  });
  
  server.decorate('reinitializePluginsWithDatabase', async () => {
    return await reinitializePluginsWithDatabase(server, pluginManager);
  });
  
  // Register core routes and API for DB setup
  registerRoutes(server); 
  
  // Register Authentication Routes
  server.register(async (authInstance) => {
    authInstance.register(registerEmailRoute, { prefix: '/email' });
    authInstance.register(loginEmailRoute, { prefix: '/email' }); // loginEmailRoute handles /login/email
    authInstance.register(githubAuthRoutes, { prefix: '/github' }); // githubAuthRoutes handles /login/github and /login/github/callback
    authInstance.register(logoutRoute); // logoutRoute handles /logout
  }, { prefix: '/api/auth' });
  server.log.info('Authentication routes registered under /api/auth.');
  
  server.addHook('onClose', async () => {
    await pluginManager.shutdownPlugins();
    const rawConn = server.rawDbConnection as SqliteDriver.Database | null; // Get from decoration
    if (rawConn) {
      const status = getDbStatus();
      if (status.dialect === 'sqlite' && 'close' in rawConn) {
        (rawConn as SqliteDriver.Database).close();
        server.log.info('SQLite connection closed.');
      }
    }
  });
  
  return server;
}
