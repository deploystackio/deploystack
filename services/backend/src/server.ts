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
import type SqliteDriver from 'better-sqlite3'; // For type checking in onClose
import type { Pool as PgPool } from 'pg';      // For type checking in onClose


// Import type extensions
import './types/fastify'

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
      isDevelopment 
        ? path.join(process.cwd(), 'src', 'plugins')
        : path.join(__dirname, 'plugins'),
      process.env.PLUGINS_PATH || path.join(process.cwd(), 'plugins'),
    ],
    plugins: {}
  })
  
  pluginManager.setApp(server); // Set app early for plugins that might need it

  // Discover available plugins first
  await pluginManager.discoverPlugins();
  
  // Register plugin table definitions (populates inputPluginTableDefinitions in db/index.ts)
  // This must happen before initializeDatabase, which generates the actual schema
  registerPluginTables(pluginManager.getAllPlugins());

  // Initialize the database using the new mechanism
  const dbSuccessfullyInitialized = await initializeDatabase();

  if (dbSuccessfullyInitialized) {
    const dbInstance = getDb();
    const rawConnection = getDbConnection();

    server.decorate('db', dbInstance as any);
    server.decorate('rawDbConnection', rawConnection as any);
    server.log.info('Database connection established and decorated.');

    pluginManager.setDatabase(dbInstance as any); // Set Drizzle instance for plugins

    // Create plugin tables in the database (Note: better handled by migrations)
    // This function might need dbInstance if it's to do anything beyond logging
    await createPluginTables(dbInstance, pluginManager.getAllPlugins());
  
    // Initialize plugin database extensions (e.g., run plugin-specific setup)
    // Ensure getDatabaseExtensions() returns plugins that have a DB extension
    const dbExtensions = pluginManager.getAllPlugins().filter(p => p.databaseExtension);
    await initializePluginDatabases(dbInstance, dbExtensions);
    
  } else {
    server.decorate('db', null as any);
    server.decorate('rawDbConnection', null as any);
    server.log.warn('Database is not configured or failed to initialize. Some features may be unavailable. Please use the setup API.');
    pluginManager.setDatabase(null as any); 
  }
  
  // Initialize plugins (routes, hooks, etc.)
  // This should happen after DB and other core services are ready (or known to be unavailable)
  await pluginManager.initializePlugins();
  
  server.decorate('pluginManager', pluginManager);
  
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
    const rawConn = server.rawDbConnection as SqliteDriver.Database | PgPool | null; // Get from decoration
    if (rawConn) {
      const status = getDbStatus();
      if (status.dialect === 'sqlite' && 'close' in rawConn) {
        (rawConn as SqliteDriver.Database).close();
        server.log.info('SQLite connection closed.');
      } else if (status.dialect === 'postgres' && 'end' in rawConn) {
        await (rawConn as PgPool).end();
        server.log.info('PostgreSQL connection pool closed.');
      }
    }
  });
  
  return server;
}
