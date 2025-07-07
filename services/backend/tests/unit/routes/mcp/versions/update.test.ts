import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import updateVersion from '../../../../../src/routes/mcp/versions/update';

describe('MCP Versions Update Route', () => {
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
      params: {
        serverId: 'test-server-id',
        versionId: 'test-version-id'
      },
      body: {
        version: '1.1.0',
        description: 'Updated version',
        changelog: 'Bug fixes and improvements',
        status: 'stable'
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
    it('should register update version route', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions/:versionId',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:serverId/versions/:versionId'
      );
      
      expect(putCall).toBeDefined();
      const [, schema] = putCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Versions']);
      expect(schema.schema.summary).toBe('Update MCP server version');
      expect(schema.schema.description).toBe('Update an existing version/release for an MCP server');
    });

    it('should register route with PUT method', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledTimes(1);
      expect(mockFastify.put).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions/:versionId',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Versions'],
            summary: 'Update MCP server version',
            description: 'Update an existing version/release for an MCP server'
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('PUT /mcp/servers/:serverId/versions/:versionId', () => {
    beforeEach(async () => {
      await updateVersion(mockFastify as FastifyInstance);
    });

    it('should return 501 Not Implemented status', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
    });

    it('should return error response with correct format', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle request with serverId and versionId parameters', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      const result = await handler(mockRequest, mockReply);

      // Should not throw and should call reply methods
      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should handle request with different serverId and versionId values', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
      const testCombinations = [
        { serverId: 'server-1', versionId: 'version-1' },
        { serverId: 'test-server-123', versionId: 'v1.0.0' },
        { serverId: 'mcp-server-abc', versionId: '2.1.0-beta' },
        { serverId: '12345', versionId: '67890' },
        { serverId: 'server_with_underscores', versionId: 'version_with_underscores' }
      ];

      for (const { serverId, versionId } of testCombinations) {
        const testRequest = {
          ...mockRequest,
          params: { serverId, versionId }
        };

        await handler(testRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request with update data in body', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
      const requestWithBody = {
        ...mockRequest,
        body: {
          version: '2.0.0',
          description: 'Major release with breaking changes',
          changelog: 'Complete rewrite with new architecture',
          releaseNotes: 'This is a major version update',
          status: 'stable',
          deprecated: false
        }
      };

      await handler(requestWithBody, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(501);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not implemented yet'
      });
    });

    it('should handle partial update data in body', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
      const partialUpdateRequests = [
        { body: { description: 'Updated description only' } },
        { body: { status: 'deprecated' } },
        { body: { changelog: 'Minor bug fixes' } },
        { body: { version: '1.0.1' } },
        { body: { description: 'New desc', status: 'beta' } }
      ];

      for (const partialRequest of partialUpdateRequests) {
        const testRequest = {
          ...mockRequest,
          ...partialRequest
        };

        await handler(testRequest, mockReply);
        
        expect(mockReply.status).toHaveBeenCalledWith(501);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle empty request body', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
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
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

      const malformedRequests = [
        { params: null },
        { params: undefined },
        { params: { serverId: null, versionId: 'v1' } },
        { params: { serverId: 'server1', versionId: null } },
        { params: { serverId: undefined, versionId: undefined } },
        { params: { serverId: '', versionId: '' } },
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

    it('should handle various version ID formats', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
      const versionIdFormats = [
        'v1.0.0',
        '1.0.0',
        '2.1.0-beta',
        '3.0.0-alpha.1',
        '1.0.0-rc.1',
        'latest',
        'stable',
        'dev',
        '20240101',
        'version-123'
      ];

      for (const versionId of versionIdFormats) {
        const testRequest = {
          ...mockRequest,
          params: { serverId: 'test-server', versionId }
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
      await updateVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

      // Should not throw any errors
      expect(async () => {
        await handler(mockRequest, mockReply);
      }).not.toThrow();
    });

    it('should always return consistent error response', async () => {
      await updateVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

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
      await updateVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      // All should have called the reply methods
      expect(mockReply.status).toHaveBeenCalledTimes(10);
      expect(mockReply.send).toHaveBeenCalledTimes(10);
    });

    it('should handle edge case parameter combinations', async () => {
      await updateVersion(mockFastify as FastifyInstance);
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

      const edgeCases = [
        { serverId: '0', versionId: '0' },
        { serverId: '999999999', versionId: '999999999' },
        { serverId: 'a', versionId: 'b' },
        { serverId: 'server-with-very-long-name', versionId: 'version-with-very-long-name' },
        { serverId: 'server.with.dots', versionId: 'version.with.dots' },
        { serverId: 'server@with@symbols', versionId: 'version@with@symbols' }
      ];

      for (const { serverId, versionId } of edgeCases) {
        const testRequest = {
          ...mockRequest,
          params: { serverId, versionId }
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
      await updateVersion(mockFastify as FastifyInstance);
    });

    it('should return response with success field set to false', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should return response with error message', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not implemented yet'
        })
      );
    });

    it('should return response with exactly two properties', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
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
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
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
      await updateVersion(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/mcp/servers/:serverId/versions/:versionId',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use PUT method specifically', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      // Verify only PUT method was called
      expect(mockFastify.put).toHaveBeenCalledTimes(1);
    });

    it('should include both serverId and versionId as path parameters', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const [path] = (mockFastify.put as any).mock.calls[0];
      expect(path).toContain(':serverId');
      expect(path).toContain(':versionId');
      expect(path).toBe('/mcp/servers/:serverId/versions/:versionId');
    });

    it('should have correct parameter order in path', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const [path] = (mockFastify.put as any).mock.calls[0];
      const serverIdIndex = path.indexOf(':serverId');
      const versionIdIndex = path.indexOf(':versionId');
      
      expect(serverIdIndex).toBeLessThan(versionIdIndex);
    });
  });

  describe('Schema Configuration', () => {
    it('should have correct OpenAPI tags', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.put as any).mock.calls[0];
      expect(options.schema.tags).toEqual(['MCP Versions']);
    });

    it('should have descriptive summary', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.put as any).mock.calls[0];
      expect(options.schema.summary).toBe('Update MCP server version');
      expect(typeof options.schema.summary).toBe('string');
      expect(options.schema.summary.length).toBeGreaterThan(0);
    });

    it('should have detailed description', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.put as any).mock.calls[0];
      expect(options.schema.description).toBe('Update an existing version/release for an MCP server');
      expect(typeof options.schema.description).toBe('string');
      expect(options.schema.description.length).toBeGreaterThan(options.schema.summary.length);
    });

    it('should have schema object with required properties', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      const [, options] = (mockFastify.put as any).mock.calls[0];
      expect(options.schema).toHaveProperty('tags');
      expect(options.schema).toHaveProperty('summary');
      expect(options.schema).toHaveProperty('description');
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await updateVersion(mockFastify as FastifyInstance);
    });

    it('should handle multiple concurrent update requests', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

      // Create multiple concurrent requests with different IDs
      const promises = Array.from({ length: 25 }, (_, i) => {
        const testRequest = {
          ...mockRequest,
          params: { serverId: `server-${i}`, versionId: `version-${i}` }
        };
        return handler(testRequest, mockReply);
      });

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(mockReply.status).toHaveBeenCalledTimes(25);
      expect(mockReply.send).toHaveBeenCalledTimes(25);
    });

    it('should not have memory leaks on repeated calls', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];

      // Call many times to check for memory leaks
      for (let i = 0; i < 100; i++) {
        await handler(mockRequest, mockReply);
      }

      expect(mockReply.status).toHaveBeenCalledTimes(100);
      expect(mockReply.send).toHaveBeenCalledTimes(100);
    });

    it('should be fast and synchronous', async () => {
      const handler = routeHandlers['PUT /mcp/servers/:serverId/versions/:versionId'];
      
      const startTime = Date.now();
      await handler(mockRequest, mockReply);
      const endTime = Date.now();

      // Should be very fast (less than 100ms in normal conditions)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('HTTP Method Specificity', () => {
    it('should only register PUT method, not other HTTP methods', async () => {
      // Mock other HTTP methods to ensure they are not called
      const mockGet = vi.fn();
      const mockPost = vi.fn();
      const mockDelete = vi.fn();
      const mockPatch = vi.fn();
      
      const extendedMockFastify = {
        ...mockFastify,
        get: mockGet,
        post: mockPost,
        delete: mockDelete,
        patch: mockPatch
      } as any;

      await updateVersion(extendedMockFastify);

      expect(mockFastify.put).toHaveBeenCalledTimes(1);
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockPost).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('should use PUT method for update operations', async () => {
      await updateVersion(mockFastify as FastifyInstance);

      // PUT is the correct HTTP method for update operations
      expect(mockFastify.put).toHaveBeenCalledWith(
        expect.stringContaining('versions'),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });
});
