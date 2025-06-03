import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { registerRoutes } from '../routes'
import registerEmailRoute from '../routes/auth/registerEmail'
import loginEmailRoute from '../routes/auth/loginEmail'
import githubAuthRoutes from '../routes/auth/github'
import logoutRoute from '../routes/auth/logout'
import { authHook } from '../hooks/authHook'
import type { FastifyInstance } from 'fastify'
import { initializeDatabase, getDb, getDbConnection } from '../db'
import { GlobalSettingsInitService } from '../global-settings'

// Import type extensions
import '../types/fastify'

/**
 * Create a simplified server for testing
 * Skips plugin system and complex initialization to avoid startup failures
 */
export const createTestServer = async (): Promise<FastifyInstance> => {
  const server = fastify({
    logger: false, // Disable logging for tests to reduce noise
    disableRequestLogging: true 
  })

  try {
    // Register @fastify/cookie
    await server.register(fastifyCookie, {
      secret: process.env.COOKIE_SECRET || 'test-cookie-secret-for-jest',
      parseOptions: {} 
    })

    // Register the global authentication hook
    server.addHook('onRequest', authHook)

    // Initialize database decorations as null (will be set by /api/db/setup)
    server.decorate('db', null as any)
    server.decorate('rawDbConnection', null as any)
    
    // Skip plugin manager for tests
    server.decorate('pluginManager', null as any)
    
    // Add simplified database service methods
    server.decorate('reinitializeDatabaseServices', async () => {
      try {
        server.log.info('[TEST_SERVER] Attempting to reinitialize database services...');
        const dbSuccessfullyInitialized = await initializeDatabase();

        if (dbSuccessfullyInitialized) {
          const dbInstance = getDb();
          const rawConnection = getDbConnection();

          // Update Fastify decorations
          (server as any).db = dbInstance;
          (server as any).rawDbConnection = rawConnection;
          server.log.info('[TEST_SERVER] Database connection established and decorated.');

          // Initialize core global settings
          await GlobalSettingsInitService.loadSettingsDefinitions();
          await GlobalSettingsInitService.initializeSettings();
          server.log.info('[TEST_SERVER] Core global settings initialization completed.');
          return true;
        } else {
          server.log.error('[TEST_SERVER] Database re-initialization failed during reinitializeDatabaseServices.');
          // Ensure db decorations are null if initialization failed
          (server as any).db = null;
          (server as any).rawDbConnection = null;
          return false;
        }
      } catch (error) {
        server.log.error(error, '[TEST_SERVER] Error during reinitializeDatabaseServices');
        return false;
      }
    })
    
    server.decorate('reinitializePluginsWithDatabase', async () => {
      // No-op for tests since we skip plugins
      return Promise.resolve()
    })
    
    // Register core routes (includes /api/db/setup and other essential endpoints)
    registerRoutes(server)
    
    // Register Authentication Routes
    await server.register(async (authInstance) => {
      authInstance.register(registerEmailRoute, { prefix: '/email' })
      authInstance.register(loginEmailRoute, { prefix: '/email' })
      authInstance.register(githubAuthRoutes, { prefix: '/github' })
      authInstance.register(logoutRoute)
    }, { prefix: '/api/auth' })
    
    // Add cleanup hook
    server.addHook('onClose', async () => {
      const rawConn = server.rawDbConnection as any
      if (rawConn && typeof rawConn.close === 'function') {
        rawConn.close()
      }
    })
    
    return server
  } catch (error) {
    console.error('Failed to create test server:', error)
    throw error
  }
}
