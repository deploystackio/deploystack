import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerRoutes } from '../../../src/routes/index';

// Mock the route modules
vi.mock('../../../src/routes/db/status');
vi.mock('../../../src/routes/db/setup');
vi.mock('../../../src/routes/roles');
vi.mock('../../../src/routes/users');
vi.mock('../../../src/routes/globalSettings');

// Import mocked modules
import dbStatusRoute from '../../../src/routes/db/status';
import dbSetupRoute from '../../../src/routes/db/setup';
import rolesRoute from '../../../src/routes/roles';
import usersRoute from '../../../src/routes/users';
import globalSettingsRoute from '../../../src/routes/globalSettings';

// Type the mocked functions
const mockDbStatusRoute = dbStatusRoute as MockedFunction<typeof dbStatusRoute>;
const mockDbSetupRoute = dbSetupRoute as MockedFunction<typeof dbSetupRoute>;
const mockRolesRoute = rolesRoute as MockedFunction<typeof rolesRoute>;
const mockUsersRoute = usersRoute as MockedFunction<typeof usersRoute>;
const mockGlobalSettingsRoute = globalSettingsRoute as MockedFunction<typeof globalSettingsRoute>;

describe('Main Routes Registration', () => {
  let mockFastify: Partial<FastifyInstance>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      register: vi.fn().mockResolvedValue(undefined),
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      db: null, // Initially no database
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Mock route modules to return resolved promises
    mockDbStatusRoute.mockResolvedValue(undefined);
    mockDbSetupRoute.mockResolvedValue(undefined);
    mockRolesRoute.mockResolvedValue(undefined);
    mockUsersRoute.mockResolvedValue(undefined);
    mockGlobalSettingsRoute.mockResolvedValue(undefined);
  });

  describe('Route Registration', () => {
    it('should register all route modules', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledTimes(5);
      expect(mockFastify.register).toHaveBeenCalledWith(dbStatusRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(dbSetupRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(rolesRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(usersRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(globalSettingsRoute);
    });

    it('should register health check route', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/', expect.any(Object), expect.any(Function));
    });

    it('should register health check route with proper schema', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      const [path, options] = (mockFastify.get as any).mock.calls[0];
      expect(path).toBe('/');
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Health Check']);
      expect(options.schema.summary).toBe('API health check');
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[200]).toBeDefined();
    });
  });

  describe('Health Check Endpoint', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;

    beforeEach(async () => {
      mockRequest = {};
      mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      await registerRoutes(mockFastify as FastifyInstance);
    });

    it('should return health check with database not configured', async () => {
      mockFastify.db = null;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result).toEqual({
        message: 'DeployStack Backend is running.',
        status: 'Database Not Configured/Connected - Use /api/db/status and /api/db/setup',
        timestamp: expect.any(String),
        version: '0.20.5'
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('should return health check with database connected', async () => {
      mockFastify.db = { /* mock database object */ } as any;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result).toEqual({
        message: 'DeployStack Backend is running.',
        status: 'Database Connected',
        timestamp: expect.any(String),
        version: '0.20.5'
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('should return consistent timestamp format', async () => {
      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      // Verify timestamp is in ISO format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return correct version', async () => {
      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.version).toBe('0.20.5');
    });

    it('should handle undefined database gracefully', async () => {
      mockFastify.db = undefined as any;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.status).toBe('Database Not Configured/Connected - Use /api/db/status and /api/db/setup');
    });

    it('should handle falsy database values', async () => {
      mockFastify.db = false as any;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.status).toBe('Database Not Configured/Connected - Use /api/db/status and /api/db/setup');
    });
  });

  describe('Error Handling', () => {
    it('should register routes successfully even with mock setup', async () => {
      // Test that the function completes without throwing
      const result = await registerRoutes(mockFastify as FastifyInstance);
      expect(result).toBeUndefined();
      
      // Verify all routes were registered
      expect(mockFastify.register).toHaveBeenCalledTimes(5);
    });

    it('should register health check route regardless of other routes', async () => {
      await registerRoutes(mockFastify as FastifyInstance);
      
      // Verify health check route was registered
      expect(mockFastify.get).toHaveBeenCalledWith('/', expect.any(Object), expect.any(Function));
    });
  });

  describe('Route Registration Order', () => {
    it('should register routes in the correct order', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      expect(registerCalls[0][0]).toBe(dbStatusRoute);
      expect(registerCalls[1][0]).toBe(dbSetupRoute);
      expect(registerCalls[2][0]).toBe(rolesRoute);
      expect(registerCalls[3][0]).toBe(usersRoute);
      expect(registerCalls[4][0]).toBe(globalSettingsRoute);
    });
  });
});
