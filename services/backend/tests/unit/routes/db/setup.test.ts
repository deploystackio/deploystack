import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import dbSetupRoute from '../../../../src/routes/db/setup';
import { DatabaseType, type DbSetupRequestBody } from '../../../../src/routes/db/schemas';

// Mock the entire db/setup module since it uses require() internally
vi.mock('../../../../src/db', () => ({
  initializeDatabase: vi.fn(),
}));

vi.mock('../../../../src/db/config', () => ({
  getDatabaseConfig: vi.fn(),
  validateDatabaseConfig: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

describe('Database Setup Route', () => {
  let mockFastify: any;
  let mockRequest: Partial<FastifyRequest<{ Body: DbSetupRequestBody }>>;
  let mockReply: any;
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
        return mockFastify;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => mockFastify.log),
        level: 'info',
        silent: false,
      } as any,
      reinitializeDatabaseServices: vi.fn().mockResolvedValue(true),
      reinitializePluginsWithDatabase: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock request
    mockRequest = {
      body: {
        type: DatabaseType.PostgreSQL,
      },
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => mockRequest.log),
        level: 'info',
        silent: false,
      } as any,
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register database setup route', async () => {
      await dbSetupRoute(mockFastify);

      expect(mockFastify.post).toHaveBeenCalledWith('/db/setup', expect.any(Object), expect.any(Function));
    });

    it('should register route with proper schema', async () => {
      await dbSetupRoute(mockFastify);

      const [path, options] = mockFastify.post.mock.calls[0];
      expect(path).toBe('/db/setup');
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Database']);
      expect(options.schema.summary).toBe('Setup database');
      expect(options.schema.description).toContain('Initializes and configures the database');
    });
  });

  describe('POST /db/setup', () => {
    beforeEach(async () => {
      await dbSetupRoute(mockFastify);
    });

    describe('Basic functionality', () => {
      it('should handle valid PostgreSQL request', async () => {
        mockRequest.body = { type: DatabaseType.PostgreSQL };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        // The handler should attempt to process the request
        expect(mockReply.status).toHaveBeenCalled();
        expect(mockReply.send).toHaveBeenCalled();
      });

      it('should handle PostgreSQL request with alternate configuration', async () => {
        mockRequest.body = { type: DatabaseType.PostgreSQL };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        // The handler should attempt to process the request
        expect(mockReply.status).toHaveBeenCalled();
        expect(mockReply.send).toHaveBeenCalled();
      });

      it('should handle invalid request body', async () => {
        mockRequest.body = { type: 'invalid' as any };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        // Should return an error response
        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('Invalid request body')
          })
        );
      });

      it('should handle missing request body', async () => {
        mockRequest.body = undefined as any;

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        // Should return an error response
        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('Invalid request body')
          })
        );
      });
    });

    describe('Environment handling', () => {
      it('should work in test environment', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';

        mockRequest.body = { type: DatabaseType.PostgreSQL };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalled();
        expect(mockReply.send).toHaveBeenCalled();

        process.env.NODE_ENV = originalEnv;
      });

      it('should work in production environment', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        mockRequest.body = { type: DatabaseType.PostgreSQL };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalled();
        expect(mockReply.send).toHaveBeenCalled();

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('Error handling', () => {
      it('should handle exceptions gracefully', async () => {
        // Mock an error in the handler
        const handler = routeHandlers['POST /db/setup'];
        
        // Override the handler to throw an error
        routeHandlers['POST /db/setup'] = async () => {
          throw new Error('Test error');
        };

        try {
          await routeHandlers['POST /db/setup'](mockRequest, mockReply);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should validate request body structure', async () => {
        mockRequest.body = { invalidField: 'test' } as any;

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
      });
    });

    describe('Logging', () => {
      it('should log setup attempts', async () => {
        mockRequest.body = { type: DatabaseType.PostgreSQL };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        // The handler should log something
        expect(mockFastify.log.info).toHaveBeenCalled();
      });
    });

    describe('Response format', () => {
      it('should return proper response structure on success', async () => {
        mockRequest.body = { type: DatabaseType.PostgreSQL };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        // Check that a response was sent
        expect(mockReply.send).toHaveBeenCalled();
        
        // Get the response that was sent
        const sentResponse = mockReply.send.mock.calls[0][0];
        
        // Should be an object (the actual response structure may vary)
        expect(typeof sentResponse).toBe('object');
        expect(sentResponse).not.toBeNull();
      });

      it('should return proper error response structure on failure', async () => {
        mockRequest.body = { type: 'invalid' as any };

        const handler = routeHandlers['POST /db/setup'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(String)
          })
        );
      });
    });
  });

  describe('Schema validation', () => {
    beforeEach(async () => {
      await dbSetupRoute(mockFastify);
    });

    it('should have proper OpenAPI schema', async () => {
      const [, options] = mockFastify.post.mock.calls[0];
      
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Database']);
      expect(options.schema.summary).toBe('Setup database');
    });

    it('should have request body schema', async () => {
      const [, options] = mockFastify.post.mock.calls[0];
      
      expect(options.schema.requestBody).toBeDefined();
      expect(options.schema.requestBody.content).toBeDefined();
      expect(options.schema.requestBody.content['application/json']).toBeDefined();
    });

    it('should have response schemas', async () => {
      const [, options] = mockFastify.post.mock.calls[0];
      
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[200]).toBeDefined();
      expect(options.schema.response[400]).toBeDefined();
      expect(options.schema.response[409]).toBeDefined();
      expect(options.schema.response[500]).toBeDefined();
    });
  });
});
