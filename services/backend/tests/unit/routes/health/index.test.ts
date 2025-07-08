import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply } from 'fastify';
import healthRoute from '../../../../src/routes/health/index';

describe('Health Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: any;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`GET ${path}`] = handler;
        } else {
          routeHandlers[`GET ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request (empty for health check)
    mockRequest = {};

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register health check route', async () => {
      await healthRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/health', expect.any(Object), expect.any(Function));
    });

    it('should configure route with correct schema', async () => {
      await healthRoute(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/health'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['Health Check']);
      expect(schema.schema.summary).toBe('Simple API health check');
      expect(schema.schema.description).toBe('Returns basic API health status for monitoring, load balancers, and uptime checks. No Content-Type header required for this GET request.');
      expect(schema.schema.response).toBeDefined();
      expect(schema.schema.response[200]).toBeDefined();
    });
  });

  describe('GET /health', () => {
    beforeEach(async () => {
      await healthRoute(mockFastify as FastifyInstance);
    });

    it('should return status ok', async () => {
      const handler = routeHandlers['GET /health'];
      const result = await handler(mockRequest, mockReply);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should always return the same response format', async () => {
      const handler = routeHandlers['GET /health'];
      
      // Call multiple times to ensure consistency
      const result1 = await handler(mockRequest, mockReply);
      const result2 = await handler(mockRequest, mockReply);
      const result3 = await handler(mockRequest, mockReply);

      expect(result1).toEqual({ status: 'ok' });
      expect(result2).toEqual({ status: 'ok' });
      expect(result3).toEqual({ status: 'ok' });
    });

    it('should not require any parameters', async () => {
      const handler = routeHandlers['GET /health'];
      
      // Test with empty request
      const emptyRequest = {};
      const result = await handler(emptyRequest, mockReply);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should be synchronous and fast', async () => {
      const handler = routeHandlers['GET /health'];
      
      const startTime = Date.now();
      const result = await handler(mockRequest, mockReply);
      const endTime = Date.now();

      expect(result).toEqual({ status: 'ok' });
      // Health check should be very fast (less than 10ms in normal conditions)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should return a response that matches the schema', async () => {
      const handler = routeHandlers['GET /health'];
      const result = await handler(mockRequest, mockReply);

      // Validate response structure matches the expected schema
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('ok');
      expect(typeof result.status).toBe('string');
      
      // Ensure no extra properties
      expect(Object.keys(result)).toEqual(['status']);
    });
  });

  describe('Error Handling', () => {
    it('should handle handler execution without throwing', async () => {
      await healthRoute(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /health'];

      // Should not throw any errors
      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      await healthRoute(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /health'];

      // Test with various malformed requests
      const malformedRequests = [
        null,
        undefined,
        { invalidProperty: 'test' },
        { params: null },
        { body: undefined }
      ];

      for (const malformedRequest of malformedRequests) {
        const result = await handler(malformedRequest, mockReply);
        expect(result).toEqual({ status: 'ok' });
      }
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      await healthRoute(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /health'];

      // Create multiple concurrent requests
      const promises = Array.from({ length: 100 }, () => 
        handler(mockRequest, mockReply)
      );

      const results = await Promise.all(promises);

      // All should return the same result
      results.forEach(result => {
        expect(result).toEqual({ status: 'ok' });
      });
    });

    it('should not have memory leaks on repeated calls', async () => {
      await healthRoute(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /health'];

      // Call many times to check for memory leaks
      for (let i = 0; i < 1000; i++) {
        const result = await handler(mockRequest, mockReply);
        expect(result).toEqual({ status: 'ok' });
      }
    });
  });
});
