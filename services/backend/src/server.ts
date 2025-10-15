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
import changePasswordRoute from './routes/auth/changePassword'
import updateProfileRoute from './routes/auth/updateProfile'
import verifyEmailRoute from './routes/auth/verifyEmail'
import resendVerificationRoute from './routes/auth/resendVerification'
import forgotPasswordRoute from './routes/auth/forgotPassword'
import resetPasswordRoute from './routes/auth/resetPassword'
import adminResetPasswordRoute from './routes/auth/adminResetPassword'
import githubStatusRoute from './routes/auth/githubStatus'
import { 
  initializeDatabase, 
  registerPluginTables, 
  initializePluginDatabases, 
  createPluginTables,
  getDb,
  getDbStatus
} from './db'
import { GlobalSettingsInitService } from './global-settings'
import { GlobalSettings } from './global-settings/helpers';
import { GlobalSettingsService } from './services/globalSettingsService'; // Import the service
import { RoleSyncService } from './services/roleSyncService'; // Import the role sync service
import type SqliteDriver from 'better-sqlite3'; // For type checking in onClose
import type { FastifyInstance } from 'fastify'

// Import event system
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DeployStackEventBus, EVENT_NAMES } from './events'

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
    server.log.debug('🔄 Starting initializeDatabaseDependentServices...');
    
    // Reset Lucia instance to pick up new database configuration
    server.log.debug('🔄 Resetting Lucia instance...');
    const { resetLucia } = await import('./lib/lucia');
    resetLucia();
    server.log.debug('✅ Lucia instance reset for database reinitialization.');

    // Initialize the database using the new mechanism
    server.log.debug('🔄 Initializing database...');
    const dbSuccessfullyInitialized = await initializeDatabase(server.log);
    server.log.debug(`✅ Database initialization result: ${dbSuccessfullyInitialized}`);

    if (dbSuccessfullyInitialized) {
      server.log.debug('🔄 Getting database instance...');
      const dbInstance = getDb();
      server.log.debug('✅ Database instance obtained');

      // Update Fastify decorations with real database instances
      // Check if decorations already exist to avoid redecoration errors
      server.log.debug('🔄 Setting up Fastify decorations...');
      if (!server.hasDecorator('db')) {
        server.decorate('db', dbInstance as any);
      } else {
        (server as any).db = dbInstance;
      }
      
      if (!server.hasDecorator('rawDbConnection')) {
        server.decorate('rawDbConnection', null as any);
      } else {
        (server as any).rawDbConnection = null;
      }
      server.log.debug('✅ Database connection established and decorated.');

      server.log.debug('🔄 Setting database for plugin manager...');
      pluginManager.setDatabase(dbInstance as any); // Set Drizzle instance for plugins
      server.log.debug('✅ Plugin manager database set');

      // Create plugin tables in the database (Note: better handled by migrations)
      server.log.debug('🔄 Creating plugin tables...');
      await createPluginTables(pluginManager.getAllPlugins(), server.log);
      server.log.debug('✅ Plugin tables created');
    
      // Initialize plugin database extensions (e.g., run plugin-specific setup)
      server.log.debug('🔄 Initializing plugin database extensions...');
      const dbExtensions = pluginManager.getAllPlugins().filter(p => p.databaseExtension);
      server.log.debug(`🔍 Found ${dbExtensions.length} plugins with database extensions`);
      await initializePluginDatabases(dbInstance, dbExtensions, server.log);
      server.log.debug('✅ Plugin database extensions initialized');
      
      // Synchronize role permissions from code to database
      try {
        server.log.debug('🔄 Starting role synchronization...');
        const roleSyncService = new RoleSyncService(server.log);
        await roleSyncService.syncRoles();
        server.log.debug('✅ Role synchronization completed');
      } catch (roleSyncError) {
        server.log.error({
          error: roleSyncError,
          message: roleSyncError instanceof Error ? roleSyncError.message : 'Unknown error',
          stack: roleSyncError instanceof Error ? roleSyncError.stack : 'No stack trace'
        }, '❌ Role synchronization failed:');
        // Don't throw - continue with startup but log the error
        server.log.warn('⚠️ Continuing without role synchronization due to error');
      }
      
      // Start OAuth2 cleanup service
      try {
        server.log.debug('🔄 Starting OAuth2 cleanup service...');
        const { OAuthCleanupService } = await import('./services/oauth/cleanupService');
        OAuthCleanupService.start(server.log);
        server.log.debug('✅ OAuth2 cleanup service started');
      } catch (oauthCleanupError) {
        server.log.error({
          error: oauthCleanupError,
          message: oauthCleanupError instanceof Error ? oauthCleanupError.message : 'Unknown error',
          stack: oauthCleanupError instanceof Error ? oauthCleanupError.stack : 'No stack trace'
        }, '❌ OAuth2 cleanup service failed to start:');
        // Don't throw - continue with startup but log the error
        server.log.warn('⚠️ Continuing without OAuth2 cleanup service due to error');
      }

      // Initialize MCP User Configuration Service
      try {
        server.log.debug('🔄 Initializing MCP User Configuration Service...');
        const { initializeMcpUserConfigurationService } = await import('./services/mcpUserConfigurationService');
        initializeMcpUserConfigurationService(dbInstance, server.log);
        server.log.debug('✅ MCP User Configuration Service initialized');
      } catch (mcpServiceError) {
        server.log.error({
          error: mcpServiceError,
          message: mcpServiceError instanceof Error ? mcpServiceError.message : 'Unknown error',
          stack: mcpServiceError instanceof Error ? mcpServiceError.stack : 'No stack trace'
        }, '❌ MCP User Configuration Service failed to initialize:');
        // Don't throw - continue with startup but log the error
        server.log.warn('⚠️ Continuing without MCP User Configuration Service due to error');
      }

      // Initialize and start Job Queue System
      try {
        server.log.debug('🔄 Initializing Job Queue System...');
        const { JobQueueService } = await import('./services/jobQueueService');
        const { JobProcessorService } = await import('./services/jobProcessorService');
        const { registerWorkers } = await import('./workers');
        
        // Initialize JobQueueService
        const jobQueueService = new JobQueueService(dbInstance, server.log);
        server.log.debug('✅ JobQueueService initialized');
        
        // Initialize JobProcessorService (pass db and logger, not jobQueueService)
        const jobProcessorService = new JobProcessorService(dbInstance, server.log);
        server.log.debug('✅ JobProcessorService initialized');
        
        // Register workers
        registerWorkers(jobProcessorService, dbInstance, server.log);
        server.log.debug('✅ Workers registered');
        
        // Start processing jobs
        await jobProcessorService.start();
        server.log.info('✅ Job Queue System started and processing jobs');
        
        // Decorate server with job services for use in routes
        if (!server.hasDecorator('jobQueueService')) {
          server.decorate('jobQueueService', jobQueueService);
        } else {
          (server as any).jobQueueService = jobQueueService;
        }
        
        if (!server.hasDecorator('jobProcessorService')) {
          server.decorate('jobProcessorService', jobProcessorService);
        } else {
          (server as any).jobProcessorService = jobProcessorService;
        }
        
      } catch (jobQueueError) {
        server.log.error({
          error: jobQueueError,
          message: jobQueueError instanceof Error ? jobQueueError.message : 'Unknown error',
          stack: jobQueueError instanceof Error ? jobQueueError.stack : 'No stack trace'
        }, '❌ Job Queue System failed to initialize:');
        // Don't throw - continue with startup but log the error
        server.log.warn('⚠️ Continuing without Job Queue System due to error');
      }

      // Initialize and start Cron Job System (after Job Queue System)
      try {
        server.log.debug('🔄 Initializing Cron Job System...');
        const { initializeCronJobs } = await import('./cron');
        
        // Check if jobQueueService exists before initializing cron
        if ((server as any).jobQueueService) {
          const cronManager = initializeCronJobs((server as any).jobQueueService, server.log);
          server.log.debug('✅ Cron jobs registered');
          
          // Start all cron jobs
          cronManager.start();
          server.log.info('✅ Cron Job System started and jobs scheduled');
          
          // Decorate server with cron manager for graceful shutdown
          if (!server.hasDecorator('cronManager')) {
            server.decorate('cronManager', cronManager);
          } else {
            (server as any).cronManager = cronManager;
          }
        } else {
          server.log.warn('⚠️ Job Queue Service not available, skipping Cron Job System initialization');
        }
        
      } catch (cronError) {
        server.log.error({
          error: cronError,
          message: cronError instanceof Error ? cronError.message : 'Unknown error',
          stack: cronError instanceof Error ? cronError.stack : 'No stack trace'
        }, '❌ Cron Job System failed to initialize:');
        // Don't throw - continue with startup but log the error
        server.log.warn('⚠️ Continuing without Cron Job System due to error');
      }

      // Start Token Cleanup Service (only after database is ready)
      try {
        server.log.debug('Starting Token Cleanup Service...');
        const { TokenCleanupService } = await import('./services/tokenCleanupService');
        TokenCleanupService.start(server.log);
        server.log.debug('Token Cleanup Service started');
      } catch (tokenCleanupError) {
        server.log.error({
          error: tokenCleanupError,
          message: tokenCleanupError instanceof Error ? tokenCleanupError.message : 'Unknown error',
          stack: tokenCleanupError instanceof Error ? tokenCleanupError.stack : 'No stack trace'
        }, 'Token Cleanup Service failed to start:');
        // Don't throw - continue with startup but log the error
        server.log.warn('Continuing without Token Cleanup Service due to error');
      }

      // Initialize global settings with comprehensive debugging
      try {
        server.log.debug('Starting global settings initialization...');
        
        // Check database status before proceeding
        const dbStatus = getDbStatus();
        server.log.debug({
          configured: dbStatus.configured,
          initialized: dbStatus.initialized,
          dialect: dbStatus.dialect,
          type: dbStatus.type
        }, '🔍 Database status before global settings init:');

        // Step 1: Load settings definitions
        server.log.debug('📥 Step 1: Loading global settings definitions...');
        const startLoadTime = Date.now();
        
        try {
          await GlobalSettingsInitService.loadSettingsDefinitions();
          const loadTime = Date.now() - startLoadTime;
          server.log.debug(`✅ Step 1 completed successfully in ${loadTime}ms`);
        } catch (loadError) {
          server.log.error({
            error: loadError,
            message: loadError instanceof Error ? loadError.message : 'Unknown error',
            stack: loadError instanceof Error ? loadError.stack : 'No stack trace'
          }, '❌ Step 1 FAILED - Error loading settings definitions:');
          throw loadError;
        }
        
        // Step 2: Initialize settings in database
        server.log.debug('🚀 Step 2: Initializing global settings in database...');
        const startInitTime = Date.now();
        
        try {
          const result = await GlobalSettingsInitService.initializeSettings();
          const initTime = Date.now() - startInitTime;
        server.log.debug(`✅ Step 2 completed successfully in ${initTime}ms - ${result.created} created, ${result.skipped} skipped`);
        } catch (initError) {
          server.log.error({
            error: initError,
            message: initError instanceof Error ? initError.message : 'Unknown error',
            stack: initError instanceof Error ? initError.stack : 'No stack trace'
          }, '❌ Step 2 FAILED - Error initializing settings:');
          throw initError;
        }

        // Step 3: Initialize plugin global settings
        server.log.debug('🔌 Step 3: Initializing plugin global settings...');
        const startPluginTime = Date.now();
        
        try {
          await pluginManager.initializePluginGlobalSettings();
          const pluginTime = Date.now() - startPluginTime;
          server.log.debug(`✅ Step 3 completed successfully in ${pluginTime}ms`);
        } catch (pluginError) {
          server.log.error({
            error: pluginError,
            message: pluginError instanceof Error ? pluginError.message : 'Unknown error',
            stack: pluginError instanceof Error ? pluginError.stack : 'No stack trace'
          }, '❌ Step 3 FAILED - Error initializing plugin settings:');
          throw pluginError;
        }

        server.log.info('🎉 All global settings initialization steps completed successfully!');

      } catch (error) {
        server.log.error({
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace',
          name: error instanceof Error ? error.name : 'Unknown error type'
        }, '❌ CRITICAL FAILURE in global settings initialization:');
        
        // Don't re-throw - let the service continue but mark as failed
        server.log.warn('⚠️ Continuing without global settings initialization due to error');
        return false; // Return false to indicate partial failure
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
    server.log.error({
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    }, '❌ CRITICAL ERROR in initializeDatabaseDependentServices:');
    server.log.error({ error }, '❌ Full error object:');
    server.log.error({ errorStringified: JSON.stringify(error, Object.getOwnPropertyNames(error), 2) }, '❌ Error stringified:');
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
    server.log.error({ error }, 'Error during plugin re-initialization:');
    throw error;
  }
}

// Create and configure the server
export const createServer = async () => {
  const server = fastify({
    logger: loggerConfig,
    disableRequestLogging: true,
    ajv: {
      customOptions: {
        strict: false,
        strictTypes: false,
        strictTuples: false
      }
    }
  })

  // Add global error handler for validation errors
  server.setErrorHandler(async (error, request, reply) => {
    // Handle Fastify validation errors
    if (error.validation) {
      const errorResponse = {
        success: false,
        error: 'Validation error',
        details: error.validation
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(400).type('application/json').send(jsonString);
    }

    // Handle other errors
    request.log.error(error, 'Unhandled error');
    const errorResponse = {
      success: false,
      error: 'Internal server error'
    };
    const jsonString = JSON.stringify(errorResponse);
    return reply.status(500).type('application/json').send(jsonString);
  });

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

  // Initialize EventBus
  const eventBus = new DeployStackEventBus(server.log);
  server.decorate('eventBus', eventBus);
  server.log.info('EventBus initialized and decorated on server instance.');

  // Create and configure the plugin manager
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const pluginManager = new PluginManager({
    paths: [
      process.env.PLUGINS_PATH || (isDevelopment 
        ? path.join(process.cwd(), 'src', 'plugins')
        : path.join(__dirname, '..', 'plugins')),
    ],
    plugins: {}
  })
  
  pluginManager.setApp(server); // Set app early for plugins that might need it
  pluginManager.setEventBus(eventBus); // Set EventBus for plugin event listener registration

  // Discover available plugins first
  await pluginManager.discoverPlugins();
  
  // Register plugin table definitions (populates inputPluginTableDefinitions in db/index.ts)
  // This must happen before initializeDatabase, which generates the actual schema
  registerPluginTables(pluginManager.getAllPlugins(), server.log);

  // Try to initialize database-dependent services (will fail gracefully if no DB configured)
  try {
    await initializeDatabaseDependentServices(server, pluginManager);
  } catch (error) {
    const typedError = error as Error;
    if (typedError.message.includes('No database selection found')) {
      server.log.info('No database configured yet. Please use the /api/db/setup endpoint to configure your database.');
    } else {
      server.log.warn('Database not configured yet. Some features will be unavailable until database setup is completed.');
    }
  }

  // Conditionally register Swagger for API documentation
  // This is placed after DB & global settings initialization to ensure settings are available
  let swaggerEnabled: boolean;
  if ((server as any).db === null) {
    server.log.info('Database not available. Enabling Swagger documentation by default during setup phase.');
    swaggerEnabled = true;
  } else {
    try {
      server.log.info('Database is available. Checking "global.enable_swagger_docs" setting.');
      // Use a safer approach that doesn't throw if the database isn't fully ready
      const dbStatus = getDbStatus();
      if (dbStatus.initialized) {
        swaggerEnabled = await GlobalSettings.getBoolean('global.enable_swagger_docs', true);
      } else {
        server.log.warn('Database not fully initialized yet. Defaulting Swagger to enabled.');
        swaggerEnabled = true;
      }
    } catch (error) {
      server.log.error({ error }, 'Error fetching "global.enable_swagger_docs" setting. Defaulting to true.');
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
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'OAuth2 Bearer token authentication'
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
            request.server.log.error({ error: err }, 'Error fetching "global.enable_swagger_docs" with Service in preHandler. Defaulting to show Swagger.');
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
    authInstance.register(changePasswordRoute, { prefix: '/email' }); // changePasswordRoute handles /email/change-password
    authInstance.register(verifyEmailRoute, { prefix: '/email' }); // verifyEmailRoute handles /email/verify
    authInstance.register(resendVerificationRoute, { prefix: '/email' }); // resendVerificationRoute handles /email/resend-verification
    authInstance.register(forgotPasswordRoute); // forgotPasswordRoute handles /email/forgot-password
    authInstance.register(resetPasswordRoute); // resetPasswordRoute handles /email/reset-password
    authInstance.register(adminResetPasswordRoute); // adminResetPasswordRoute handles /admin/reset-password
    authInstance.register(updateProfileRoute); // updateProfileRoute handles /profile/update
    authInstance.register(githubAuthRoutes, { prefix: '/github' }); // githubAuthRoutes handles /login/github and /login/github/callback
    authInstance.register(githubStatusRoute); // githubStatusRoute handles /github/status
    authInstance.register(logoutRoute); // logoutRoute handles /logout
  }, { prefix: '/api/auth' });
  server.log.info('Authentication routes registered under /api/auth.');
  
  server.addHook('onClose', async () => {
    // Stop cron jobs first
    if ((server as any).cronManager) {
      server.log.info('Stopping cron jobs...');
      (server as any).cronManager.stop();
      server.log.info('Cron jobs stopped.');
    }
    
    // Stop job processor to gracefully finish current jobs
    if ((server as any).jobProcessorService) {
      server.log.info('Stopping job processor...');
      await (server as any).jobProcessorService.stop();
      server.log.info('Job processor stopped.');
    }
    
    await pluginManager.shutdownPlugins();
    const rawConn = server.rawDbConnection; // Get from decoration
    if (rawConn) {
      const status = getDbStatus();
      if (status.dialect === 'sqlite' && 'close' in rawConn) {
        (rawConn as SqliteDriver.Database).close();
        server.log.info('SQLite connection closed.');
      }
      // Note: Turso/LibSQL connections are automatically managed by the client
    }
  });
  
  return server;
}
