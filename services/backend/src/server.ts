/* eslint-disable @typescript-eslint/no-explicit-any */
import fastify from 'fastify'
import path from 'node:path'
import { loggerConfig } from './fastify/config/logger'
import { registerRequestLoggerHooks } from './fastify/hooks/request-logger'
import { registerFastifyPlugins } from './fastify/plugins'
import fastifyCookie from '@fastify/cookie';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
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
import { GlobalSettings } from './global-settings/helpers';
import { GlobalSettingsService } from './services/globalSettingsService'; // Import the service
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
  
  // Register favicon after Swagger to exclude it from documentation
  const fastifyFavicon = await import('fastify-favicon');
  await server.register(fastifyFavicon.default, {
    path: '../shared/public/img',
    name: 'favicon.ico',
    maxAge: 604800
  })

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

  // Conditionally register Swagger for API documentation
  // This is placed after DB & global settings initialization to ensure settings are available
  let swaggerEnabled: boolean;
  if ((server as any).db === null) {
    server.log.info('Database not available. Enabling Swagger documentation by default during setup phase.');
    swaggerEnabled = true;
  } else {
    try {
      server.log.info('Database is available. Checking "global.enable_swagger_docs" setting.');
      swaggerEnabled = await GlobalSettings.getBoolean('global.enable_swagger_docs', true);
      // The log message below was removed as it's covered by more specific logs later.
    } catch (error) {
      server.log.error('Error fetching "global.enable_swagger_docs" setting. Defaulting to true.', error);
      swaggerEnabled = true;
    }
  }

  // Always register Swagger and SwaggerUI. Access will be controlled by the preHandler.
  // The swaggerEnabled variable is now only used for an initial log message.
  if (swaggerEnabled) {
    server.log.info('Initial check: Swagger documentation will be attempted to register. Access controlled by preHandler.');
  } else {
    server.log.info('Initial check: Swagger documentation was disabled by setting at startup, but routes will still be registered. Access controlled by preHandler.');
  }

  const host = process.env.HOST || 'localhost';
  const port = process.env.PORT || '3000';
  const serverUrl = `http://${host}:${port}`;

  await server.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'DeployStack Backend API',
        description: 'API documentation for DeployStack Backend',
        version: '0.20.5' // We need to make this dynamic from package.json
      },
      servers: [
        {
          url: serverUrl,
          description: process.env.NODE_ENV === 'development' ? 'Development server' : 'Server'
        }
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'auth_session'
          }
        }
      }
    },
    hideUntagged: false
  });

  await server.register(fastifySwaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) { next() },
      preHandler: async function (request, reply, next) {
        // On-the-fly check for swagger documentation
        let showSwagger = true; // Default to true if setting is missing or error occurs
        if ((request.server as any).db !== null) {
          try {
            await GlobalSettings.refreshCaches(); // Attempt to refresh any underlying caches
            const setting = await GlobalSettingsService.get('global.enable_swagger_docs');
            if (setting && typeof setting.value === 'string') {
              const valueLower = setting.value.toLowerCase();
              showSwagger = !(valueLower === 'false' || valueLower === '0' || valueLower === 'no' || valueLower === 'off' || valueLower === 'disabled');
            } else {
              // If setting is not found or value is not a string, default to true (as per defaultValue in global.ts)
              showSwagger = true; 
            }
            request.server.log.info(`Swagger UI access check (using Service): "global.enable_swagger_docs" is ${showSwagger}. Raw value: ${setting ? setting.value : 'Not found'}`);
          } catch (err) {
            request.server.log.error('Error fetching "global.enable_swagger_docs" with Service in preHandler. Defaulting to show Swagger.', err);
            showSwagger = true;
          }
        } else {
          request.server.log.info('Swagger UI access check: Database not available, showing Swagger UI by default.');
          showSwagger = true;
        }

        if (!showSwagger) {
          reply.code(404).send({ error: 'Not Found', message: 'API documentation is disabled.' });
        } else {
          next();
        }
      }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      // Remove favicon route from the API specification
      if (swaggerObject.paths && swaggerObject.paths['/favicon.ico']) {
        delete swaggerObject.paths['/favicon.ico'];
      }
      return swaggerObject;
    },
    transformSpecificationClone: true
  });
    // Log registration; preHandler will control access dynamically
    server.log.info('Swagger documentation routes registered at /documentation. Access is dynamically controlled by the "global.enable_swagger_docs" setting via a preHandler.');
  // The `else` block related to initial swaggerEnabled check is no longer needed here as routes are always registered.
  
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
