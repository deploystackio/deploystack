import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createGlobalServer from '../../../../../src/routes/mcp/servers/create-global';

describe('MCP Servers - Create Global', () => {
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
      post: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`POST ${path}`] = handler;
        } else {
          routeHandlers[`POST ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      body: {},
      user: { id: 'test-user-id', role: 'admin' },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register create global MCP server route', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/mcp/servers/global',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global'
      );
      
      expect(postCall).toBeDefined();
      const [, schema] = postCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Create global MCP server (Admin only)');
      expect(schema.schema.description).toBe('Create a new global MCP server - requires global admin permissions');
    });
  });

  describe('POST /mcp/servers/global', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented', async () => {
      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should return consistent response structure', async () => {
      const handler = routeHandlers['POST /mcp/servers/global'];
      
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

    it('should handle request with valid admin user', async () => {
      const handler = routeHandlers['POST /mcp/servers/global'];
      const adminRequest = {
        ...mockRequest,
        user: { id: 'admin-user-id', role: 'global_admin' },
        body: {
          name: 'Test Server',
          description: 'A test global MCP server',
          github_url: 'https://github.com/test/server'
        }
      };

      await handler(adminRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with different body structures', async () => {
      const handler = routeHandlers['POST /mcp/servers/global'];
      
      const testBodies = [
        {},
        { name: 'Test' },
        { invalid: 'data' },
        null,
        undefined
      ];

      for (const body of testBodies) {
        const requestWithBody = { ...mockRequest, body };
        await handler(requestWithBody, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request without user authentication', async () => {
      const handler = routeHandlers['POST /mcp/servers/global'];
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

    it('should handle request with non-admin user', async () => {
      const handler = routeHandlers['POST /mcp/servers/global'];
      const regularUserRequest = {
        ...mockRequest,
        user: { id: 'regular-user-id', role: 'user' }
      };

      await handler(regularUserRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle handler execution without throwing', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

      const malformedRequests = [
        null,
        undefined,
        { invalidProperty: 'test' },
        { body: null },
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
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

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
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

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
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should chain status and send correctly', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledBefore(mockReply.send as any);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should be fast and not block', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/global'];

      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast for a simple 501 response
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Route Metadata', () => {
    it('should have appropriate tags for API documentation', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls[0];
      const [, schema] = postCall;

      expect(schema.schema.tags).toContain('MCP Servers');
    });

    it('should have descriptive summary and description', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls[0];
      const [, schema] = postCall;

      expect(schema.schema.summary).toContain('Create global MCP server');
      expect(schema.schema.summary).toContain('Admin only');
      expect(schema.schema.description).toContain('global admin permissions');
    });

    it('should indicate admin-only access in documentation', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls[0];
      const [, schema] = postCall;

      const hasAdminReference = 
        schema.schema.summary.toLowerCase().includes('admin') ||
        schema.schema.description.toLowerCase().includes('admin');

      expect(hasAdminReference).toBe(true);
    });
  });
});