import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import deleteTeamServer from '../../../../../src/routes/mcp/teams/delete-server';

describe('MCP Teams Delete Server Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let routeHandlers: Record<string, any>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      delete: vi.fn((path, options, handler) => {
        // Extract the actual handler function from the arguments
        const actualHandler = typeof options === 'function' ? options : handler;
        routeHandlers[`DELETE ${path}`] = actualHandler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request and reply
    mockRequest = {
      params: {
        teamId: 'team-123',
        serverId: 'server-456',
      },
      user: {
        id: 'user-123',
      } as any,
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Registration', () => {
    it('should register DELETE /mcp/teams/:teamId/servers/:serverId route', async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);

      expect(mockFastify.delete).toHaveBeenCalledWith(
        '/mcp/teams/:teamId/servers/:serverId',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Team Servers'],
            summary: 'Delete team MCP server',
            description: 'Delete a team MCP server',
          }),
        }),
        expect.any(Function)
      );
    });

    it('should have proper route handler registered', async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);

      expect(routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId']).toBeDefined();
      expect(typeof routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId']).toBe('function');
    });
  });

  describe('DELETE /mcp/teams/:teamId/servers/:serverId - Delete Team MCP Server', () => {
    beforeEach(async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented', async () => {
      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request with different team and server IDs', async () => {
      mockRequest.params = { 
        teamId: 'team-789',
        serverId: 'server-101'
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request without authentication', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request with invalid team ID format', async () => {
      mockRequest.params = { 
        teamId: 'invalid-team-id-format',
        serverId: 'server-456'
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request with invalid server ID format', async () => {
      mockRequest.params = { 
        teamId: 'team-123',
        serverId: 'invalid-server-id-format'
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request with missing team ID parameter', async () => {
      mockRequest.params = { serverId: 'server-456' };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request with missing server ID parameter', async () => {
      mockRequest.params = { teamId: 'team-123' };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle request with empty parameters', async () => {
      mockRequest.params = {};

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });
  });

  describe('Schema Validation', () => {
    beforeEach(async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
    });

    it('should have proper OpenAPI schema for DELETE route', async () => {
      const deleteCall = (mockFastify.delete as any).mock.calls.find(
        (call: any) => call[0] === '/mcp/teams/:teamId/servers/:serverId'
      );
      
      expect(deleteCall).toBeDefined();
      const [, options] = deleteCall;
      
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['MCP Team Servers']);
      expect(options.schema.summary).toBe('Delete team MCP server');
      expect(options.schema.description).toBe('Delete a team MCP server');
    });

    it('should have consistent schema structure', async () => {
      const deleteCall = (mockFastify.delete as any).mock.calls.find(
        (call: any) => call[0] === '/mcp/teams/:teamId/servers/:serverId'
      );
      
      expect(deleteCall).toBeDefined();
      const [, options] = deleteCall;
      
      expect(options.schema).toMatchObject({
        tags: expect.arrayContaining(['MCP Team Servers']),
        summary: expect.any(String),
        description: expect.any(String),
      });
    });
  });

  describe('Route Handler Function', () => {
    it('should export a default async function', () => {
      expect(deleteTeamServer).toBeDefined();
      expect(typeof deleteTeamServer).toBe('function');
      expect(deleteTeamServer.constructor.name).toBe('AsyncFunction');
    });

    it('should accept FastifyInstance parameter', async () => {
      // This test ensures the function signature is correct
      expect(() => deleteTeamServer(mockFastify as FastifyInstance)).not.toThrow();
    });

    it('should return a Promise', () => {
      const result = deleteTeamServer(mockFastify as FastifyInstance);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
    });

    it('should handle reply.status throwing an error', async () => {
      mockReply.status = vi.fn().mockImplementation(() => {
        throw new Error('Reply status error');
      });

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      
      await expect(handler(mockRequest, mockReply)).rejects.toThrow('Reply status error');
    });

    it('should handle reply.send throwing an error', async () => {
      mockReply.send = vi.fn().mockImplementation(() => {
        throw new Error('Reply send error');
      });

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      
      await expect(handler(mockRequest, mockReply)).rejects.toThrow('Reply send error');
    });

    it('should handle malformed request object', async () => {
      const malformedRequest = null;

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      
      // The handler should still return 501 even with malformed request
      await expect(handler(malformedRequest, mockReply)).resolves.not.toThrow();
      expect(mockReply.status).toHaveBeenCalledWith(501);
    });

    it('should handle malformed reply object', async () => {
      const malformedReply = {
        status: vi.fn().mockReturnValue({
          send: vi.fn(),
        }),
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      
      await expect(handler(mockRequest, malformedReply)).resolves.not.toThrow();
      expect(malformedReply.status).toHaveBeenCalledWith(501);
    });
  });

  describe('Integration with Fastify', () => {
    it('should register route without throwing errors', async () => {
      await expect(deleteTeamServer(mockFastify as FastifyInstance)).resolves.not.toThrow();
    });

    it('should call fastify.delete exactly once', async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
      
      expect(mockFastify.delete).toHaveBeenCalledTimes(1);
    });

    it('should register route with correct path', async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
      
      expect(mockFastify.delete).toHaveBeenCalledWith(
        '/mcp/teams/:teamId/servers/:serverId',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should pass correct number of arguments to fastify.delete', async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
      
      const deleteCall = (mockFastify.delete as any).mock.calls[0];
      expect(deleteCall).toHaveLength(3); // path, options, handler
    });
  });

  describe('HTTP Method Validation', () => {
    it('should use DELETE HTTP method', async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
      
      expect(mockFastify.delete).toHaveBeenCalled();
      expect(mockFastify.delete).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should not register other HTTP methods', async () => {
      // Add mock methods to verify they are not called
      mockFastify.get = vi.fn();
      mockFastify.post = vi.fn();
      mockFastify.put = vi.fn();
      mockFastify.patch = vi.fn();
      
      await deleteTeamServer(mockFastify as FastifyInstance);
      
      expect(mockFastify.get).not.toHaveBeenCalled();
      expect(mockFastify.post).not.toHaveBeenCalled();
      expect(mockFastify.put).not.toHaveBeenCalled();
      expect(mockFastify.patch).not.toHaveBeenCalled();
    });
  });

  describe('Path Parameters', () => {
    beforeEach(async () => {
      await deleteTeamServer(mockFastify as FastifyInstance);
    });

    it('should handle numeric team ID', async () => {
      mockRequest.params = { 
        teamId: '12345',
        serverId: 'server-456'
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle numeric server ID', async () => {
      mockRequest.params = { 
        teamId: 'team-123',
        serverId: '67890'
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });

    it('should handle UUID format IDs', async () => {
      mockRequest.params = { 
        teamId: '550e8400-e29b-41d4-a716-446655440000',
        serverId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      };

      const handler = routeHandlers['DELETE /mcp/teams/:teamId/servers/:serverId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet',
      });
    });
  });
});
