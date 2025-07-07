import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import searchServers from '../../../../../src/routes/mcp/servers/search';

describe('MCP Servers - Search Servers', () => {
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
      get: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`GET ${path}`] = handler;
        } else {
          routeHandlers[`GET ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      query: { q: 'test search' },
      user: { id: 'test-user-id', role: 'user' },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register search MCP servers route', async () => {
      await searchServers(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/search',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await searchServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/search'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Search MCP servers');
      expect(schema.schema.description).toBe('Search MCP servers by query string');
    });
  });

  describe('GET /mcp/servers/search', () => {
    beforeEach(async () => {
      await searchServers(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented', async () => {
      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should return consistent response structure', async () => {
      const handler = routeHandlers['GET /mcp/servers/search'];
      
      // Call multiple times to ensure consistency
      await handler(mockRequest, mockReply);
      await handler(mockRequest, mockReply);
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledTimes(3);
      expect(mockReply.send).toHaveBeenCalledTimes(3);
      
      // Check that all calls had the same arguments
      const statusCalls = (mockReply.status as any).mock.calls;
      const sendCalls = (mockReply.send as any).mock.calls;
      
      statusCalls.forEach((call: any[]) => {
        expect(call[0]).toBe(501);
      });
      
      sendCalls.forEach((call: any[]) => {
        expect(call[0]).toEqual({
          success: false,
          error: 'Not implemented yet'
        });
      });
    });

    it('should handle request with search query', async () => {
      const handler = routeHandlers['GET /mcp/servers/search'];
      const requestWithQuery = {
        ...mockRequest,
        query: { q: 'nodejs server', limit: 10, offset: 0 }
      };

      await handler(requestWithQuery, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with different query formats', async () => {
      const handler = routeHandlers['GET /mcp/servers/search'];
      
      const testQueries = [
        { q: 'simple search' },
        { q: 'multi word search term' },
        { q: 'special-chars_search' },
        { q: '' },
        { search: 'alternative parameter' },
        {}
      ];

      for (const query of testQueries) {
        const requestWithQuery = { ...mockRequest, query };
        await handler(requestWithQuery, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request without user authentication', async () => {
      const handler = routeHandlers['GET /mcp/servers/search'];
      const unauthenticatedRequest = {
        ...mockRequest,
        user: undefined
      };

      await handler(unauthenticatedRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle handler execution without throwing', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      const malformedRequests = [
        null,
        undefined,
        { invalidProperty: 'test' },
        { query: null },
        { user: null }
      ];

      for (const malformedRequest of malformedRequests) {
        await handler(malformedRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should work with malformed reply objects', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      const malformedReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      };

      expect(async () => {
        await handler(mockRequest, malformedReply);
      }).not.toThrow();

      expect(malformedReply.status).toHaveBeenCalledWith(501);
      expect(malformedReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });
  });

  describe('Response Format', () => {
    it('should return response in correct format', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      await handler(mockRequest, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0];
      const response = sendCall[0];

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('error');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Not implemented yet');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.error).toBe('string');
    });

    it('should set correct HTTP status code', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should chain status and send correctly', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledBefore(mockReply.send as any);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should be fast and not block', async () => {
      await searchServers(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/search'];

      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast for a simple 501 response
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Route Metadata', () => {
    it('should have appropriate tags for API documentation', async () => {
      await searchServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      expect(schema.schema.tags).toContain('MCP Servers');
    });

    it('should have descriptive summary and description', async () => {
      await searchServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      expect(schema.schema.summary).toContain('Search MCP servers');
      expect(schema.schema.description).toContain('Search MCP servers by query string');
    });

    it('should use correct HTTP method and path', async () => {
      await searchServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [path] = getCall;

      expect(path).toBe('/mcp/servers/search');
    });

    it('should not indicate admin-only access (should be accessible to users)', async () => {
      await searchServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      const hasAdminOnlyReference = 
        schema.schema.summary.toLowerCase().includes('admin only') ||
        schema.schema.description.toLowerCase().includes('admin only');

      expect(hasAdminOnlyReference).toBe(false);
    });
  });
});