import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createVersion from '../../../../../src/routes/mcp/versions/create';

describe('MCP Versions Create Route', () => {
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
      params: {
        serverId: 'test-server-id'
      },
      body: {
        version: '1.0.0',
        description: 'Test version',
        changelog: 'Initial release'
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
    it('should register create version route', async () => {
      await createVersion(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await createVersion(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:serverId/versions'
      );
      
      expect(postCall).toBeDefined();
      const [, schema] = postCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Versions']);
      expect(schema.schema.summary).toBe('Create MCP server version');
      expect(schema.schema.description).toBe('Create a new version/release for an MCP server');
    });

    it('should register route with POST method', async () => {
      await createVersion(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledTimes(1);
      expect(mockFastify.post).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Versions'],
            summary: 'Create MCP server version',
            description: 'Create a new version/release for an MCP server'
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('POST /mcp/servers/:serverId/versions', () => {
    beforeEach(async () => {
      await createVersion(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented status', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
    });

    it('should return error response with correct format', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with serverId parameter', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      const result = await handler(mockRequest, mockReply);

      // Should not throw and should call reply methods
      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should handle request with different serverId values', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      
      const testServerIds = [
        'server-1',
        'test-server-123',
        'mcp-server-abc',
        '12345',
        'server_with_underscores'
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

    it('should handle request with version data in body', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      
      const requestWithBody = {
        ...mockRequest,
        body: {
          version: '2.1.0',
          description: 'New feature release',
          changelog: 'Added new features and bug fixes',
          releaseNotes: 'This version includes major improvements'
        }
      };

      await handler(requestWithBody, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle empty request body', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      
      const requestWithEmptyBody = {
        ...mockRequest,
        body: {}
      };

      await handler(requestWithEmptyBody, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle malformed request objects', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];

      const malformedRequests = [
        { params: null },
        { params: undefined },
        { params: { serverId: null } },
        { params: { serverId: undefined } },
        { params: { serverId: '' } },
        { body: null },
        { body: undefined }
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
  });

  describe('Error Handling', () => {
    it('should handle handler execution without throwing', async () => {
      await createVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];

      // Should not throw any errors
      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should always return consistent error response', async () => {
      await createVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];

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
      await createVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      // All should have called the reply methods
      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      await createVersion(mockFastify as FastifyInstance);
    });

    it('should return response with success field set to false', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should return response with error message', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not implemented yet'
        })
      );
    });

    it('should return response with exactly two properties', async () => {
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
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
      const handler = routeHandlers['POST /mcp/servers/:serverId/versions'];
      
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
      await createVersion(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use POST method specifically', async () => {
      await createVersion(mockFastify as FastifyInstance);

      // Verify only POST method was called
      expect(mockFastify.post).toHaveBeenCalledTimes(1);
    });

    it('should include serverId as path parameter', async () => {
      await createVersion(mockFastify as FastifyInstance);

      const [path] = (mockFastify.post as any).mock.calls[0];
      expect(path).toContain(':serverId');
      expect(path).toBe('/mcp/servers/:serverId/versions');
    });
  });

  describe('Schema Configuration', () => {
    it('should have correct OpenAPI tags', async () => {
      await createVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.post as any).mock.calls[0];
      expect(options.schema.tags).toEqual(['MCP Versions']);
    });

    it('should have descriptive summary', async () => {
      await createVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.post as any).mock.calls[0];
      expect(options.schema.summary).toBe('Create MCP server version');
      expect(typeof options.schema.summary).toBe('string');
      expect(options.schema.summary.length).toBeGreaterThan(0);
    });

    it('should have detailed description', async () => {
      await createVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.post as any).mock.calls[0];
      expect(options.schema.description).toBe('Create a new version/release for an MCP server');
      expect(typeof options.schema.description).toBe('string');
      expect(options.schema.description.length).toBeGreaterThan(options.schema.summary.length);
    });

    it('should have schema object with required properties', async () => {
      await createVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.post as any).mock.calls[0];
      expect(options.schema).toHaveProperty('tags');
      expect(options.schema).toHaveProperty('summary');
      expect(options.schema).toHaveProperty('description');
    });
  });
});
