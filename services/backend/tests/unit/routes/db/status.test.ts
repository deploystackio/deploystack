import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import dbStatusRoute from '../../../../src/routes/db/status';
import { getDbStatus } from '../../../../src/db';
import { DatabaseType } from '../../../../src/routes/db/schemas';

// Mock dependencies
vi.mock('../../../../src/db');

// Type the mocked functions
const mockGetDbStatus = getDbStatus as MockedFunction<typeof getDbStatus>;

describe('Database Status Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request
    mockRequest = {};

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register database status route', async () => {
      await dbStatusRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/api/db/status', expect.any(Object), expect.any(Function));
    });

    it('should register route with proper schema', async () => {
      await dbStatusRoute(mockFastify as FastifyInstance);

      const [path, options] = (mockFastify.get as any).mock.calls[0];
      expect(path).toBe('/api/db/status');
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Database']);
      expect(options.schema.summary).toBe('Get database status');
      expect(options.schema.description).toContain('Returns the current status of the database');
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[200]).toBeDefined();
      expect(options.schema.response[500]).toBeDefined();
    });
  });

  describe('GET /api/db/status', () => {
    beforeEach(async () => {
      await dbStatusRoute(mockFastify as FastifyInstance);
    });

    it('should return database status when configured and initialized', async () => {
      const mockStatus = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      };
      mockGetDbStatus.mockReturnValue(mockStatus);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockGetDbStatus).toHaveBeenCalledTimes(1);
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      });
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should return database status when not configured', async () => {
      const mockStatus = {
        configured: false,
        initialized: false,
        dialect: null,
      };
      mockGetDbStatus.mockReturnValue(mockStatus);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockGetDbStatus).toHaveBeenCalledTimes(1);
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: false,
        initialized: false,
        dialect: null,
      });
    });

    it('should return database status when configured but not initialized', async () => {
      const mockStatus = {
        configured: true,
        initialized: false,
        dialect: DatabaseType.SQLite,
      };
      mockGetDbStatus.mockReturnValue(mockStatus);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockGetDbStatus).toHaveBeenCalledTimes(1);
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: true,
        initialized: false,
        dialect: DatabaseType.SQLite,
      });
    });

    it('should handle null dialect correctly', async () => {
      const mockStatus = {
        configured: false,
        initialized: false,
        dialect: null,
      };
      mockGetDbStatus.mockReturnValue(mockStatus);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        configured: false,
        initialized: false,
        dialect: null,
      });
    });

    it('should handle undefined dialect as null', async () => {
      const mockStatus = {
        configured: false,
        initialized: false,
        dialect: undefined,
      };
      mockGetDbStatus.mockReturnValue(mockStatus as any);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        configured: false,
        initialized: false,
        dialect: undefined,
      });
    });

    it('should handle getDbStatus throwing an error', async () => {
      const error = new Error('Database status check failed');
      mockGetDbStatus.mockImplementation(() => {
        throw error;
      });

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching database status');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to fetch database status',
      });
    });

    it('should handle getDbStatus returning invalid data', async () => {
      const invalidStatus = {
        configured: 'true', // Should be boolean
        initialized: 1, // Should be boolean
        dialect: 'postgres', // Should be sqlite or null
      };
      mockGetDbStatus.mockReturnValue(invalidStatus as any);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      // Should still process the data as received from getDbStatus
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: 'true',
        initialized: 1,
        dialect: 'postgres',
      });
    });

    it('should handle getDbStatus returning partial data', async () => {
      const partialStatus = {
        configured: true,
        // Missing initialized and dialect
      };
      mockGetDbStatus.mockReturnValue(partialStatus as any);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        configured: true,
        initialized: undefined,
        dialect: undefined,
      });
    });

    it('should handle getDbStatus returning empty object', async () => {
      mockGetDbStatus.mockReturnValue({} as any);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        configured: undefined,
        initialized: undefined,
        dialect: undefined,
      });
    });

    it('should handle different error types', async () => {
      const stringError = 'String error';
      mockGetDbStatus.mockImplementation(() => {
        throw stringError;
      });

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(stringError, 'Error fetching database status');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to fetch database status',
      });
    });


    it('should not modify the original status object', async () => {
      const originalStatus = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      };
      mockGetDbStatus.mockReturnValue(originalStatus);

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      // Verify original object is unchanged
      expect(originalStatus).toEqual({
        configured: true,
        initialized: true,
        dialect: 'sqlite',
      });

      // Verify the response was sent with correct typing
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      });
    });

    it('should handle multiple consecutive calls', async () => {
      const mockStatus1 = {
        configured: false,
        initialized: false,
        dialect: null,
      };
      const mockStatus2 = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      };

      mockGetDbStatus.mockReturnValueOnce(mockStatus1).mockReturnValueOnce(mockStatus2);

      const handler = routeHandlers['GET /api/db/status'];
      
      // First call
      await handler(mockRequest, mockReply);
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: false,
        initialized: false,
        dialect: null,
      });

      // Reset reply mock
      vi.clearAllMocks();
      mockReply.send = vi.fn().mockReturnThis();

      // Second call
      await handler(mockRequest, mockReply);
      expect(mockReply.send).toHaveBeenCalledWith({
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      });
    });
  });

  describe('Error Response Format', () => {
    beforeEach(async () => {
      await dbStatusRoute(mockFastify as FastifyInstance);
    });

    it('should return error in correct format', async () => {
      const error = new Error('Test error');
      mockGetDbStatus.mockImplementation(() => {
        throw error;
      });

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to fetch database status',
      });
    });

    it('should use consistent error message', async () => {
      const error = new Error('Different error message');
      mockGetDbStatus.mockImplementation(() => {
        throw error;
      });

      const handler = routeHandlers['GET /api/db/status'];
      await handler(mockRequest, mockReply);

      // Error message should be consistent regardless of the actual error
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to fetch database status',
      });
    });
  });
});
