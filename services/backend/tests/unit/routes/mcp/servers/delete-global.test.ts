import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import deleteGlobalServer from '../../../../../src/routes/mcp/servers/delete-global';

// Mock the dependencies
vi.mock('../../../../../src/middleware/roleMiddleware', () => ({
  requireGlobalAdmin: () => vi.fn()
}));

vi.mock('../../../../../src/services/mcpCatalogService', () => ({
  McpCatalogService: vi.fn().mockImplementation(() => ({
    getServerById: vi.fn(),
    deleteServer: vi.fn()
  }))
}));

vi.mock('../../../../../src/db', () => ({
  getDb: vi.fn()
}));

vi.mock('../../../../../src/events', () => ({
  EVENT_NAMES: {
    MCP_SERVER_DELETED: 'mcp_server_deleted'
  }
}));

describe('MCP Servers - Delete Global', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;
  let mockLog: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock logger
    mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

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
      eventBus: {
        emitWithContext: vi.fn()
      }
    } as any;

    // Setup mock request
    mockRequest = {
      params: { id: 'test-server-id' },
      user: { id: 'test-user-id', role: 'global_admin', email: 'test@example.com' },
      log: mockLog,
      ip: '127.0.0.1',
      id: 'request-id-123',
      headers: {
        'user-agent': 'test-agent'
      }
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
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
      expect(schema.schema.summary).toBe('Delete global MCP server (Global Admin only)');
      expect(schema.schema.description).toBe('Delete an existing global MCP server - requires global admin permissions. Only global servers can be deleted through this endpoint. This action is irreversible.');
    });
  });

  describe('DELETE /mcp/servers/global/:id', () => {
    let mockMcpService: any;

    beforeEach(async () => {
      const { McpCatalogService } = await import('../../../../../src/services/mcpCatalogService');
      mockMcpService = {
        getServerById: vi.fn(),
        deleteServer: vi.fn()
      };
      (McpCatalogService as any).mockImplementation(() => mockMcpService);
      
      await deleteGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return 404 when server not found', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Server not found"'));
    });

    it('should return 404 when server is not global', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue({
        id: 'test-server-id',
        name: 'Test Server',
        visibility: 'private'
      });

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Server not found or not a global server"'));
    });

    it('should successfully delete global server', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      const mockServer = {
        id: 'test-server-id',
        name: 'Test Global Server',
        description: 'Test server description',
        visibility: 'global'
      };
      
      mockMcpService.getServerById.mockResolvedValue(mockServer);
      mockMcpService.deleteServer.mockResolvedValue(true);

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
    });

    it('should handle deletion failure', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      const mockServer = {
        id: 'test-server-id',
        name: 'Test Global Server',
        description: 'Test server description',
        visibility: 'global'
      };
      
      mockMcpService.getServerById.mockResolvedValue(mockServer);
      mockMcpService.deleteServer.mockResolvedValue(false);

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Server not found"'));
    });

    it('should handle service errors', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockRejectedValue(new Error('Database error'));

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Failed to delete global MCP server"'));
    });

    it('should handle specific error messages', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockRejectedValue(new Error('Server not found'));

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Server not found"'));
    });

    it('should handle insufficient permissions error', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockRejectedValue(new Error('Insufficient permissions'));

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Global admin permissions required"'));
    });
  });

  describe('Error Handling', () => {
    let mockMcpService: any;

    beforeEach(async () => {
      const { McpCatalogService } = await import('../../../../../src/services/mcpCatalogService');
      mockMcpService = {
        getServerById: vi.fn(),
        deleteServer: vi.fn()
      };
      (McpCatalogService as any).mockImplementation(() => mockMcpService);
      
      await deleteGlobalServer(mockFastify as FastifyInstance);
    });

    it('should handle handler execution without throwing', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];

      const malformedRequest = {
        params: null,
        user: null,
        log: mockLog
      };

      // This should throw an error due to destructuring null params
      await expect(handler(malformedRequest, mockReply)).rejects.toThrow();
    });

    it('should work with malformed reply objects', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      const malformedReply = {
        status: vi.fn().mockReturnThis(),
        type: vi.fn().mockReturnThis(),
        send: vi.fn()
      };

      await handler(mockRequest, malformedReply);

      expect(malformedReply.status).toHaveBeenCalledWith(404);
      expect(malformedReply.type).toHaveBeenCalledWith('application/json');
      expect(malformedReply.send).toHaveBeenCalledWith(expect.stringContaining('"error":"Server not found"'));
    });
  });

  describe('Response Format', () => {
    let mockMcpService: any;

    beforeEach(async () => {
      const { McpCatalogService } = await import('../../../../../src/services/mcpCatalogService');
      mockMcpService = {
        getServerById: vi.fn(),
        deleteServer: vi.fn()
      };
      (McpCatalogService as any).mockImplementation(() => mockMcpService);
      
      await deleteGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return response in correct format for success', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      const mockServer = {
        id: 'test-server-id',
        name: 'Test Global Server',
        description: 'Test server description',
        visibility: 'global'
      };
      
      mockMcpService.getServerById.mockResolvedValue(mockServer);
      mockMcpService.deleteServer.mockResolvedValue(true);

      await handler(mockRequest, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0];
      const responseString = sendCall[0];
      const response = JSON.parse(responseString);

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('data');
      expect(response.success).toBe(true);
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.message).toBe('string');
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('deleted_at');
    });

    it('should return response in correct format for error', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      await handler(mockRequest, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0];
      const responseString = sendCall[0];
      const response = JSON.parse(responseString);

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('error');
      expect(response.success).toBe(false);
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.error).toBe('string');
    });

    it('should set correct HTTP status code for success', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      const mockServer = {
        id: 'test-server-id',
        name: 'Test Global Server',
        description: 'Test server description',
        visibility: 'global'
      };
      
      mockMcpService.getServerById.mockResolvedValue(mockServer);
      mockMcpService.deleteServer.mockResolvedValue(true);

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should set correct HTTP status code for not found', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should chain status and send correctly', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledBefore(mockReply.send as any);
    });
  });

  describe('Performance', () => {
    let mockMcpService: any;

    beforeEach(async () => {
      const { McpCatalogService } = await import('../../../../../src/services/mcpCatalogService');
      mockMcpService = {
        getServerById: vi.fn(),
        deleteServer: vi.fn()
      };
      (McpCatalogService as any).mockImplementation(() => mockMcpService);
      
      await deleteGlobalServer(mockFastify as FastifyInstance);
    });

    it('should handle multiple concurrent requests', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should be fast and not block', async () => {
      const handler = routeHandlers['DELETE /mcp/servers/global/:id'];
      mockMcpService.getServerById.mockResolvedValue(null);

      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be reasonably fast for a database operation
      expect(endTime - startTime).toBeLessThan(1000);
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
      expect(schema.schema.summary).toContain('Global Admin only');
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
