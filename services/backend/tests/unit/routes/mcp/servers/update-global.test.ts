import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import updateGlobalServer from '../../../../../src/routes/mcp/servers/update-global';

describe('MCP Servers - Update Global', () => {
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
      put: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`PUT ${path}`] = handler;
        } else {
          routeHandlers[`PUT ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      params: { id: 'test-server-id' },
      body: {},
      user: { id: 'test-user-id', role: 'admin' },
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register update global MCP server route', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/mcp/servers/global/:id',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global/:id'
      );
      
      expect(putCall).toBeDefined();
      const [, schema] = putCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Update global MCP server (Admin only)');
      expect(schema.schema.description).toBe('Update a global MCP server - requires global admin permissions. Will require Content-Type: application/json header when sending request body once implemented.');
    });
  });

  describe('PUT /mcp/servers/global/:id', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should return consistent response structure', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      
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

    it('should handle request with valid server ID and update data', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      const requestWithData = {
        ...mockRequest,
        params: { id: 'valid-server-id-123' },
        body: {
          name: 'Updated Server Name',
          description: 'Updated server description',
          github_url: 'https://github.com/updated/server'
        },
        user: { id: 'admin-user-id', role: 'global_admin' }
      };

      await handler(requestWithData, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with different ID formats', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      
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

    it('should handle request with different body structures', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      
      const testBodies = [
        {},
        { name: 'Updated Name' },
        { description: 'Updated description' },
        { name: 'Name', description: 'Description', github_url: 'https://github.com/test/repo' },
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

    it('should handle request without ID parameter', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
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
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
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
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
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

    it('should handle partial updates', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      
      const partialUpdates = [
        { name: 'Only name update' },
        { description: 'Only description update' },
        { github_url: 'https://github.com/only/url' },
        { status: 'active' },
        { featured: true }
      ];

      for (const partialUpdate of partialUpdates) {
        const requestWithPartialUpdate = {
          ...mockRequest,
          body: partialUpdate
        };
        
        await handler(requestWithPartialUpdate, mockReply);
        
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
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should work with malformed request objects', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

      const malformedRequests = [
        null,
        undefined,
        { invalidProperty: 'test' },
        { params: null },
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
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

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
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

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
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.status).toHaveBeenCalledTimes(1);
    });

    it('should chain status and send correctly', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledBefore(mockReply.send as any);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should be fast and not block', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];

      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast for a simple 501 response
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Route Metadata', () => {
    it('should have appropriate tags for API documentation', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls[0];
      const [, schema] = putCall;

      expect(schema.schema.tags).toContain('MCP Servers');
    });

    it('should have descriptive summary and description', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls[0];
      const [, schema] = putCall;

      expect(schema.schema.summary).toContain('Update global MCP server');
      expect(schema.schema.summary).toContain('Admin only');
      expect(schema.schema.description).toContain('global admin permissions');
    });

    it('should indicate admin-only access in documentation', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls[0];
      const [, schema] = putCall;

      const hasAdminReference = 
        schema.schema.summary.toLowerCase().includes('admin') ||
        schema.schema.description.toLowerCase().includes('admin');

      expect(hasAdminReference).toBe(true);
    });

    it('should use correct HTTP method and path pattern', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls[0];
      const [path] = putCall;

      expect(path).toBe('/mcp/servers/global/:id');
      expect(path).toContain(':id'); // Should have ID parameter
    });
  });

  describe('Update-Specific Scenarios', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should handle complex update payloads', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      const complexUpdateRequest = {
        ...mockRequest,
        body: {
          name: 'Complex Server Update',
          description: 'A comprehensive server update with all fields',
          long_description: 'This is a detailed description of the server functionality',
          github_url: 'https://github.com/complex/server',
          homepage_url: 'https://complex-server.example.com',
          language: 'typescript',
          runtime: 'node',
          runtime_min_version: '18.0.0',
          installation_methods: JSON.stringify(['npm', 'yarn', 'pnpm']),
          tools: JSON.stringify([{ name: 'tool1', description: 'First tool' }]),
          resources: JSON.stringify([{ name: 'resource1', type: 'file' }]),
          prompts: JSON.stringify([{ name: 'prompt1', description: 'First prompt' }]),
          author_name: 'Test Author',
          author_contact: 'author@example.com',
          organization: 'Test Organization',
          license: 'MIT',
          tags: JSON.stringify(['tag1', 'tag2']),
          status: 'active',
          featured: true
        }
      };

      await handler(complexUpdateRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle empty update payload', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      const emptyUpdateRequest = {
        ...mockRequest,
        body: {}
      };

      await handler(emptyUpdateRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle updates with JSON string fields', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      const jsonUpdateRequest = {
        ...mockRequest,
        body: {
          installation_methods: '["npm", "docker"]',
          tools: '[{"name": "test-tool", "description": "A test tool"}]',
          resources: '[{"name": "test-resource", "uri": "file://test"}]',
          prompts: '[{"name": "test-prompt", "description": "A test prompt"}]',
          tags: '["testing", "example"]'
        }
      };

      await handler(jsonUpdateRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle status and visibility updates', async () => {
      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      
      const statusUpdates = [
        { status: 'active' },
        { status: 'deprecated' },
        { status: 'maintenance' },
        { featured: true },
        { featured: false },
        { status: 'active', featured: true }
      ];

      for (const statusUpdate of statusUpdates) {
        const requestWithStatus = {
          ...mockRequest,
          body: statusUpdate
        };
        
        await handler(requestWithStatus, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });
  });
});
