import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import dbSetupRoute from '../../../../src/routes/db/setup';
import { setupNewDatabase } from '../../../../src/db';
import { getDbConfig } from '../../../../src/db/config';
import { DatabaseType, type DbSetupRequestBody } from '../../../../src/routes/db/schemas';
import { ZodError } from 'zod';

// Mock dependencies
vi.mock('../../../../src/db');
vi.mock('../../../../src/db/config');

// Type the mocked functions
const mockSetupNewDatabase = setupNewDatabase as MockedFunction<typeof setupNewDatabase>;
const mockGetDbConfig = getDbConfig as MockedFunction<typeof getDbConfig>;

describe('Database Setup Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest<{ Body: DbSetupRequestBody }>>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      post: vi.fn((path, options, handler) => {
        routeHandlers[`POST ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
      reinitializeDatabaseServices: vi.fn().mockResolvedValue(true),
      reinitializePluginsWithDatabase: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Setup mock request
    mockRequest = {
      body: {
        type: DatabaseType.SQLite,
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup default mock returns
    mockGetDbConfig.mockResolvedValue(null); // No existing config by default
    mockSetupNewDatabase.mockResolvedValue(true); // Successful setup by default
  });

  describe('Route Registration', () => {
    it('should register database setup route', async () => {
      await dbSetupRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/api/db/setup', expect.any(Object), expect.any(Function));
    });

    it('should register route with proper schema', async () => {
      await dbSetupRoute(mockFastify as FastifyInstance);

      const [path, options] = (mockFastify.post as any).mock.calls[0];
      expect(path).toBe('/api/db/setup');
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Database']);
      expect(options.schema.summary).toBe('Setup database');
      expect(options.schema.description).toContain('Initializes and configures the database');
      expect(options.schema.body).toBeDefined();
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[200]).toBeDefined();
      expect(options.schema.response[400]).toBeDefined();
      expect(options.schema.response[409]).toBeDefined();
      expect(options.schema.response[500]).toBeDefined();
    });
  });

  describe('POST /api/db/setup', () => {
    beforeEach(async () => {
      await dbSetupRoute(mockFastify as FastifyInstance);
    });

    describe('Successful Setup', () => {
      it('should setup database successfully with full re-initialization', async () => {
        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockGetDbConfig).toHaveBeenCalledTimes(1);
        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'tests/e2e/test-data/deploystack.test.db',
        });
        expect(mockFastify.reinitializeDatabaseServices).toHaveBeenCalledTimes(1);
        expect(mockFastify.reinitializePluginsWithDatabase).toHaveBeenCalledTimes(1);
        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          message: 'Database setup successful. All services have been initialized and are ready to use.',
          restart_required: false,
        });
      });

      it('should setup database with test environment path', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'tests/e2e/test-data/deploystack.test.db',
        });

        process.env.NODE_ENV = originalEnv;
      });

      it('should handle re-initialization failure gracefully', async () => {
        mockFastify.reinitializeDatabaseServices = vi.fn().mockResolvedValue(false);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          message: 'Database setup successful, but some services may require a server restart to function properly.',
          restart_required: true,
        });
      });

      it('should handle re-initialization exception', async () => {
        mockFastify.reinitializeDatabaseServices = vi.fn().mockRejectedValue(new Error('Re-init failed'));

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(
          'Error during re-initialization after database setup:',
          expect.any(Error)
        );
        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          message: 'Database setup successful, but re-initialization failed. Please restart the server to complete setup.',
          restart_required: true,
        });
      });
    });

    describe('Conflict Scenarios', () => {
      it('should return conflict when database is already configured', async () => {
        mockGetDbConfig.mockResolvedValue({
          type: DatabaseType.SQLite,
          dbPath: '/existing/path',
        });

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.warn).toHaveBeenCalledWith('Attempt to set up an already configured database.');
        expect(mockSetupNewDatabase).not.toHaveBeenCalled();
        expect(mockReply.status).toHaveBeenCalledWith(409);
        expect(mockReply.send).toHaveBeenCalledWith({
          message: 'Database setup has already been performed.',
        });
      });
    });

    describe('Database Setup Failures', () => {
      it('should handle database setup failure', async () => {
        mockSetupNewDatabase.mockResolvedValue(false);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith('Database setup/initialization failed.');
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          message: 'Database setup failed. Check server logs.',
        });
      });

      it('should handle database setup exception', async () => {
        const setupError = new Error('Database connection failed');
        mockSetupNewDatabase.mockRejectedValue(setupError);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(
          setupError,
          'Error during database setup: Database connection failed'
        );
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'Database setup failed: Database connection failed',
        });
      });
    });

    describe('Validation Errors', () => {
      it('should handle Zod validation errors', async () => {
        const zodError = new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['type'],
            message: 'Expected string, received number',
          },
        ]);

        // Mock the handler to throw a ZodError
        const originalHandler = routeHandlers['POST /api/db/setup'];
        routeHandlers['POST /api/db/setup'] = async (request: any, reply: any) => {
          try {
            throw zodError;
          } catch (error) {
            if (error instanceof ZodError) {
              mockFastify.log!.warn(error, 'Validation error during database setup');
              return reply.status(400).send({ error: 'Invalid request body', details: error.errors });
            }
            throw error;
          }
        };

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.warn).toHaveBeenCalledWith(zodError, 'Validation error during database setup');
        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'Invalid request body',
          details: zodError.errors,
        });
      });
    });

    describe('Environment Handling', () => {
      it('should use production database path by default', async () => {
        const originalEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'persistent_data/database/deploystack.db',
        });

        process.env.NODE_ENV = originalEnv;
      });

      it('should use production database path for non-test environments', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'persistent_data/database/deploystack.db',
        });

        process.env.NODE_ENV = originalEnv;
      });

      it('should use development database path for development environment', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'persistent_data/database/deploystack.db',
        });

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('Logging Verification', () => {
      it('should log setup attempt', async () => {
        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.info).toHaveBeenCalledWith('Attempting to set up database with type: sqlite');
      });

      it('should log successful setup', async () => {
        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.info).toHaveBeenCalledWith('Database setup/initialization successful.');
        expect(mockFastify.log!.info).toHaveBeenCalledWith('Re-initializing database-dependent services...');
        expect(mockFastify.log!.info).toHaveBeenCalledWith('Re-initializing plugins with database access...');
        expect(mockFastify.log!.info).toHaveBeenCalledWith('Database setup and re-initialization completed successfully.');
      });

      it('should log re-initialization warnings', async () => {
        mockFastify.reinitializeDatabaseServices = vi.fn().mockResolvedValue(false);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.warn).toHaveBeenCalledWith(
          'Database setup succeeded but re-initialization failed. Manual restart may be required.'
        );
      });
    });

    describe('Request Body Validation', () => {
      it('should handle valid SQLite request', async () => {
        mockRequest.body = { type: DatabaseType.SQLite };

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'tests/e2e/test-data/deploystack.test.db',
        });
        expect(mockReply.status).toHaveBeenCalledWith(200);
      });

      it('should handle request with extra properties', async () => {
        mockRequest.body = {
          type: DatabaseType.SQLite,
          extraProperty: 'should be ignored',
        } as any;

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        // Should still work as Fastify validation strips extra properties
        expect(mockSetupNewDatabase).toHaveBeenCalledWith({
          type: DatabaseType.SQLite,
          dbPath: 'tests/e2e/test-data/deploystack.test.db',
        });
      });
    });

    describe('Service Re-initialization', () => {
      it('should call reinitializeDatabaseServices before reinitializePluginsWithDatabase', async () => {
        const callOrder: string[] = [];
        
        mockFastify.reinitializeDatabaseServices = vi.fn().mockImplementation(async () => {
          callOrder.push('database-services');
          return true;
        });
        
        mockFastify.reinitializePluginsWithDatabase = vi.fn().mockImplementation(async () => {
          callOrder.push('plugins');
          return undefined;
        });

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(callOrder).toEqual(['database-services', 'plugins']);
      });

      it('should not call reinitializePluginsWithDatabase if database services fail', async () => {
        mockFastify.reinitializeDatabaseServices = vi.fn().mockResolvedValue(false);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.reinitializeDatabaseServices).toHaveBeenCalledTimes(1);
        expect(mockFastify.reinitializePluginsWithDatabase).not.toHaveBeenCalled();
      });

      it('should handle plugin re-initialization errors', async () => {
        const pluginError = new Error('Plugin initialization failed');
        mockFastify.reinitializePluginsWithDatabase = vi.fn().mockRejectedValue(pluginError);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        // Should still complete successfully as plugin errors are not critical
        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          message: 'Database setup successful, but re-initialization failed. Please restart the server to complete setup.',
          restart_required: true,
        });
      });
    });

    describe('Error Handling Edge Cases', () => {
      it('should handle getDbConfig throwing an error', async () => {
        const configError = new Error('Config read failed');
        mockGetDbConfig.mockRejectedValue(configError);

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(
          configError,
          'Error during database setup: Config read failed'
        );
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'Database setup failed: Config read failed',
        });
      });

      it('should handle non-Error exceptions', async () => {
        const stringError = 'String error';
        mockSetupNewDatabase.mockImplementation(() => {
          throw stringError;
        });

        const handler = routeHandlers['POST /api/db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(
          stringError,
          'Error during database setup: undefined'
        );
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'Database setup failed: undefined',
        });
      });
    });
  });

  describe('Schema Validation Integration', () => {
    beforeEach(async () => {
      await dbSetupRoute(mockFastify as FastifyInstance);
    });

    it('should have proper request body schema', async () => {
      const [, options] = (mockFastify.post as any).mock.calls[0];
      
      expect(options.schema.body).toBeDefined();
      expect(options.schema.body.type).toBe('object');
      expect(options.schema.body.properties).toBeDefined();
      expect(options.schema.body.properties.type).toBeDefined();
      expect(options.schema.body.required).toContain('type');
    });

    it('should have proper response schemas', async () => {
      const [, options] = (mockFastify.post as any).mock.calls[0];
      
      expect(options.schema.response[200]).toBeDefined();
      expect(options.schema.response[400]).toBeDefined();
      expect(options.schema.response[409]).toBeDefined();
      expect(options.schema.response[500]).toBeDefined();
    });
  });
});
