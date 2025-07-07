import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import deleteGlobalServer from '../../../../../src/routes/mcp/servers/delete-global';

describe('MCP Servers - Delete Global', () => {
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
      delete: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`DELETE ${path}`] = handler;
        } else {
          routeHandlers[`DELETE ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      params: { id: 'test-server-id' },
      user: { id: 'test-user-id', role: 'admin' },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register delete global MCP server route', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);

      expect(mockFastify.delete).toHaveBeenCalledWith(
        '/mcp/servers/global/:id',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);

      const deleteCall = (mockFastify.delete as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global/:id'
      );
      
      expect(deleteCall).toBeDefined();
      const [, schema] = deleteCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Delete global MCP server (Admin only)');
      expect(schema.schema.description).toBe('Delete a global MCP server - requires global admin permissions');
    });
  });

  describe('DELETE /mcp/servers/global/:id', () => {
    beforeEach(async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should return consistent response structure', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      
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
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      const requestWithId = {
        ...mockRequest,
        params: { id: 'valid-server-id-123' },
        user: { id: 'admin-user-id', role: 'global_admin' }
      };

      await handler(requestWithId, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with different ID formats', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      
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
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
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
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
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
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
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
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

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
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

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
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

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
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should chain status and send correctly', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledBefore(mockReply.send as any);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should be fast and not block', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast for a simple 501 response
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Route Metadata', () => {
    it('should have appropriate tags for API documentation', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);

      const deleteCall = (mockFastify.delete as any).mock.calls[0];
      const [, schema] = deleteCall;

      expect(schema.schema.tags).toContain('MCP Servers');
    });

    it('should have descriptive summary and description', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);

      const deleteCall = (mockFastify.delete as any).mock.calls[0];
      const [, schema] = deleteCall;

      expect(schema.schema.summary).toContain('Delete global MCP server');
      expect(schema.schema.summary).toContain('Admin only');
      expect(schema.schema.description).toContain('global admin permissions');
    });

    it('should indicate admin-only access in documentation', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);

      const deleteCall = (mockFastify.delete as any).mock.calls[0];
      const [, schema] = deleteCall;

      const hasAdminReference = 
        schema.schema.summary.toLowerCase().includes('admin') ||
        schema.schema.description.toLowerCase().includes('admin');

      expect(hasAdminReference).toBe(true);
    });

    it('should use correct HTTP method and path pattern', async () => {
      await deleteGlobalServer(mockFastify as FastifyInstance);

      const deleteCall = (mockFastify.delete as any).mock.calls[0];
      const [path] = deleteCall;

      expect(path).toBe('/mcp/servers/global/:id');
      expect(path).toContain(':id'); // Should have ID parameter
    });
  });
});