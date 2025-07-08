import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import getServer from '../../../../../src/routes/mcp/servers/get';

describe('MCP Servers - Get Server', () => {
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
      params: { id: 'test-server-id' },
      user: { 
        id: 'test-user-id',
        username: 'test-user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        authType: 'email',
        githubId: null
      },
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register get MCP server route', async () => {
      await getServer(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/:id',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:id'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Get MCP server by ID');
      expect(schema.schema.description).toBe('Retrieve a specific MCP server by its ID');
    });
  });

  describe('GET /mcp/servers/:id', () => {
    beforeEach(async () => {
      await getServer(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should return consistent response structure', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
      
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

    it('should handle request with valid server ID', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
      const requestWithId = {
        ...mockRequest,
        params: { id: 'valid-server-id-123' }
      };

      await handler(requestWithId, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with different ID formats', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
      
      const testIds = [
        'uuid-123-456-789',
        'simple-id',
        '12345',
        'server_with_underscores',
        'server-with-dashes'
      ];

      for (const id of testIds) {
        const requestWithId = { ...mockRequest, params: { id } };
        await handler(requestWithId, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request without ID parameter', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
      const requestWithoutId = {
        ...mockRequest,
        params: {}
      };

      await handler(requestWithoutId, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request without user authentication', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
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

    it('should handle request with different user types', async () => {
      const handler = routeHandlers['GET /mcp/servers/:id'];
      
      const userTypes = [
        { id: 'user-1', username: 'user1', email: 'user1@example.com', firstName: 'User', lastName: 'One', authType: 'email', githubId: null },
        { id: 'admin-1', username: 'admin1', email: 'admin1@example.com', firstName: 'Admin', lastName: 'One', authType: 'email', githubId: null },
        { id: 'github-1', username: 'github1', email: 'github1@example.com', firstName: 'GitHub', lastName: 'User', authType: 'github', githubId: '12345' }
      ];

      for (const user of userTypes) {
        const requestWithUser = {
          ...mockRequest,
          user
        };
        
        await handler(requestWithUser, mockReply);
        
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
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

      const malformedRequests = [
        null,
        undefined,
        { invalidProperty: 'test' },
        { params: null },
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
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

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
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

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
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should chain status and send correctly', async () => {
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledBefore(mockReply.send as any);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should be fast and not block', async () => {
      await getServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['GET /mcp/servers/:id'];

      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast for a simple 501 response
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Route Metadata', () => {
    it('should have appropriate tags for API documentation', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      expect(schema.schema.tags).toContain('MCP Servers');
    });

    it('should have descriptive summary and description', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      expect(schema.schema.summary).toContain('Get MCP server by ID');
      expect(schema.schema.description).toContain('Retrieve a specific MCP server');
    });

    it('should use correct HTTP method and path pattern', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [path] = getCall;

      expect(path).toBe('/mcp/servers/:id');
      expect(path).toContain(':id'); // Should have ID parameter
    });

    it('should not indicate admin-only access (should be accessible to users)', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      const hasAdminOnlyReference = 
        schema.schema.summary.toLowerCase().includes('admin only') ||
        schema.schema.description.toLowerCase().includes('admin only');

      expect(hasAdminOnlyReference).toBe(false);
    });
  });
});
