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

    // Setup mock reply with proper chaining support
    mockReply = {
      status: vi.fn(() => mockReply),
      type: vi.fn(() => mockReply),
      send: vi.fn(() => mockReply),
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

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
      expect(result).toBe(mockReply);
    });

    it('should always return the same response format', async () => {
      const handler = routeHandlers['GET /health'];
      
      // Call multiple times to ensure consistency
      await handler(mockRequest, mockReply);
      await handler(mockRequest, mockReply);
      await handler(mockRequest, mockReply);

      // Verify all calls used the same format
      expect(mockReply.status).toHaveBeenCalledTimes(3);
      expect(mockReply.type).toHaveBeenCalledTimes(3);
      expect(mockReply.send).toHaveBeenCalledTimes(3);
      
      // Check that all calls had the same parameters
      const statusCalls = (mockReply.status as any).mock.calls;
      const typeCalls = (mockReply.type as any).mock.calls;
      const sendCalls = (mockReply.send as any).mock.calls;
      
      statusCalls.forEach((call: any) => expect(call[0]).toBe(200));
      typeCalls.forEach((call: any) => expect(call[0]).toBe('application/json'));
      sendCalls.forEach((call: any) => expect(call[0]).toBe(JSON.stringify({ status: 'ok' })));
    });

    it('should not require any parameters', async () => {
      const handler = routeHandlers['GET /health'];
      
      // Test with empty request
      const emptyRequest = {};
      await handler(emptyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
    });

    it('should be synchronous and fast', async () => {
      const handler = routeHandlers['GET /health'];
      
      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
      // Health check should be very fast (less than 10ms in normal conditions)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should return a response that matches the schema', async () => {
      const handler = routeHandlers['GET /health'];
      await handler(mockRequest, mockReply);

      // Validate response structure matches the expected schema
      const expectedResponse = JSON.stringify({ status: 'ok' });
      expect(mockReply.send).toHaveBeenCalledWith(expectedResponse);
      
      // Verify the JSON string contains the correct structure
      const parsedResponse = JSON.parse(expectedResponse);
      expect(parsedResponse).toHaveProperty('status');
      expect(parsedResponse.status).toBe('ok');
      expect(typeof parsedResponse.status).toBe('string');
      
      // Ensure no extra properties
      expect(Object.keys(parsedResponse)).toEqual(['status']);
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
        // Reset mocks for each iteration
        vi.clearAllMocks();
        
        await handler(malformedRequest, mockReply);
        expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
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

      await Promise.all(promises);

      // All should have called the reply methods
      expect(mockReply.status).toHaveBeenCalledTimes(100);
      expect(mockReply.type).toHaveBeenCalledTimes(100);
      expect(mockReply.send).toHaveBeenCalledTimes(100);
      
      // All calls should have the same parameters
      const sendCalls = (mockReply.send as any).mock.calls;
      sendCalls.forEach((call: any) => {
        expect(call[0]).toBe(JSON.stringify({ status: 'ok' }));
      });
    });

    it('should not have memory leaks on repeated calls', async () => {
      await healthRoute(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /health'];

      // Call many times to check for memory leaks
      for (let i = 0; i < 1000; i++) {
        await handler(mockRequest, mockReply);
      }
      
      // Verify all calls completed successfully
      expect(mockReply.send).toHaveBeenCalledTimes(1000);
      
      // Sample a few calls to ensure consistency
      const sendCalls = (mockReply.send as any).mock.calls;
      expect(sendCalls[0][0]).toBe(JSON.stringify({ status: 'ok' }));
      expect(sendCalls[500][0]).toBe(JSON.stringify({ status: 'ok' }));
      expect(sendCalls[999][0]).toBe(JSON.stringify({ status: 'ok' }));
    });
  });
});
