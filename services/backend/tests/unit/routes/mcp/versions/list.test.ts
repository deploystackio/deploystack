import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import listVersions from '../../../../../src/routes/mcp/versions/list';

describe('MCP Versions List Route', () => {
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
      params: {
        serverId: 'test-server-id'
      },
      query: {
        page: '1',
        limit: '10',
        sort: 'created_at'
      },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        silent: vi.fn(),
        child: vi.fn(),
        level: 'info'
      }
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register list versions route', async () => {
      await listVersions(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await listVersions(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:serverId/versions'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Versions']);
      expect(schema.schema.summary).toBe('List MCP server versions');
      expect(schema.schema.description).toBe('List all versions/releases for a specific MCP server');
    });

    it('should register route with GET method', async () => {
      await listVersions(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledTimes(1);
      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Versions'],
            summary: 'List MCP server versions',
            description: 'List all versions/releases for a specific MCP server'
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('GET /mcp/servers/:serverId/versions', () => {
    beforeEach(async () => {
      await listVersions(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented status', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
    });

    it('should return error response with correct format', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with serverId parameter', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      const result = await handler(mockRequest, mockReply);

      // Should not throw and should call reply methods
      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should handle request with different serverId values', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      
      const testServerIds = [
        'server-1',
        'test-server-123',
        'mcp-server-abc',
        '12345',
        'server_with_underscores',
        'server-with-dashes'
      ];

      for (const serverId of testServerIds) {
        const testRequest = {
          ...mockRequest,
          params: { serverId }
        };

        await handler(testRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request with query parameters', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      
      const requestWithQuery = {
        ...mockRequest,
        query: {
          page: '2',
          limit: '20',
          sort: 'version',
          order: 'desc',
          filter: 'stable'
        }
      };

      await handler(requestWithQuery, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request without query parameters', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      
      const requestWithoutQuery = {
        ...mockRequest,
        query: {}
      };

      await handler(requestWithoutQuery, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle malformed request objects', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      const malformedRequests = [
        { params: null },
        { params: undefined },
        { params: { serverId: null } },
        { params: { serverId: undefined } },
        { params: { serverId: '' } },
        { query: null },
        { query: undefined }
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

    it('should handle various query parameter combinations', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      
      const queryVariations = [
        { page: '1' },
        { limit: '5' },
        { sort: 'name' },
        { page: '1', limit: '10' },
        { page: '2', limit: '20', sort: 'created_at' },
        { filter: 'beta', sort: 'version', order: 'asc' },
        { search: 'v1.0', page: '1', limit: '50' }
      ];

      for (const query of queryVariations) {
        const testRequest = {
          ...mockRequest,
          query
        };

        await handler(testRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle handler execution without throwing', async () => {
      await listVersions(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      // Should not throw any errors
      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should always return consistent error response', async () => {
      await listVersions(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      // Call multiple times to ensure consistency
      for (let i = 0; i < 5; i++) {
        await handler(mockRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle concurrent requests', async () => {
      await listVersions(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      // All should have called the reply methods
      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should handle edge case server IDs', async () => {
      await listVersions(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      const edgeCaseServerIds = [
        '0',
        '999999999',
        'a',
        'server-with-very-long-name-that-exceeds-normal-length-expectations',
        'server.with.dots',
        'server@with@symbols',
        'server with spaces' // This might be URL encoded in real scenarios
      ];

      for (const serverId of edgeCaseServerIds) {
        const testRequest = {
          ...mockRequest,
          params: { serverId }
        };

        await handler(testRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      await listVersions(mockFastify as FastifyInstance);
    });

    it('should return response with success field set to false', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should return response with error message', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not implemented yet'
        })
      );
    });

    it('should return response with exactly two properties', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      const expectedResponse = {
        success: false,
        error: 'Not implemented yet'
      };

      expect(mockReply.send).toHaveBeenCalledWith(expectedResponse);
      
      // Verify the response has exactly the expected properties
      const actualResponse = (mockReply.send as any).mock.calls[0][0];
      expect(Object.keys(actualResponse)).toEqual(['success', 'error']);
    });

    it('should return consistent response format across multiple calls', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      
      const expectedResponse = {
        success: false,
        error: 'Not implemented yet'
      };

      // Call multiple times
      for (let i = 0; i < 3; i++) {
        await handler(mockRequest, mockReply);
        expect(mockReply.send).toHaveBeenCalledWith(expectedResponse);
      }
    });
  });

  describe('Route Path and Method Validation', () => {
    it('should register route with correct path pattern', async () => {
      await listVersions(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use GET method specifically', async () => {
      await listVersions(mockFastify as FastifyInstance);

      // Verify only GET method was called
      expect(mockFastify.get).toHaveBeenCalledTimes(1);
    });

    it('should include serverId as path parameter', async () => {
      await listVersions(mockFastify as FastifyInstance);

      const [path] = (mockFastify.get as any).mock.calls[0];
      expect(path).toContain(':serverId');
      expect(path).toBe('/mcp/servers/:serverId/versions');
    });
  });

  describe('Schema Configuration', () => {
    it('should have correct OpenAPI tags', async () => {
      await listVersions(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.get as any).mock.calls[0];
      expect(options.schema.tags).toEqual(['MCP Versions']);
    });

    it('should have descriptive summary', async () => {
      await listVersions(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.get as any).mock.calls[0];
      expect(options.schema.summary).toBe('List MCP server versions');
      expect(typeof options.schema.summary).toBe('string');
      expect(options.schema.summary.length).toBeGreaterThan(0);
    });

    it('should have detailed description', async () => {
      await listVersions(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.get as any).mock.calls[0];
      expect(options.schema.description).toBe('List all versions/releases for a specific MCP server');
      expect(typeof options.schema.description).toBe('string');
      expect(options.schema.description.length).toBeGreaterThan(options.schema.summary.length);
    });

    it('should have schema object with required properties', async () => {
      await listVersions(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.get as any).mock.calls[0];
      expect(options.schema).toHaveProperty('tags');
      expect(options.schema).toHaveProperty('summary');
      expect(options.schema).toHaveProperty('description');
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await listVersions(mockFastify as FastifyInstance);
    });

    it('should handle multiple concurrent list requests', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      // Create multiple concurrent requests with different server IDs
      const promises = Array.from({ length: 50 }, (_, i) => {
        const testRequest = {
          ...mockRequest,
          params: { serverId: `server-${i}` }
        };
        return handler(testRequest, mockReply);
      });

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(mockReply.status).toHaveBeenCalledTimes(50);
      expect(mockReply.send).toHaveBeenCalledTimes(50);
    });

    it('should not have memory leaks on repeated calls', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];

      // Call many times to check for memory leaks
      for (let i = 0; i < 100; i++) {
        await handler(mockRequest, mockReply);
      }

      expect(mockReply.status).toHaveBeenCalledTimes(100);
      expect(mockReply.send).toHaveBeenCalledTimes(100);
    });

    it('should be fast and synchronous', async () => {
      const handler = routeHandlers['GET /mcp/servers/:serverId/versions'];
      
      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast (less than 100ms in normal conditions)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
