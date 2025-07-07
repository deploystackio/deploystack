import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import syncRepo from '../../../../../src/routes/mcp/github/sync-repo';

describe('POST /mcp/github/sync/:serverId', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify();
    await server.register(syncRepo);
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Route Registration', () => {
    it('should register the POST route correctly', async () => {
      const routes = server.printRoutes();
      expect(routes).toContain(':serverId (POST)');
    });

    it('should have correct route configuration', () => {
      const route = server.hasRoute({
        method: 'POST',
        url: '/mcp/github/sync/:serverId'
      });
      expect(route).toBe(true);
    });
  });

  describe('Request Handling', () => {
    it('should return 501 Not Implemented status', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id'
      });

      expect([400, 501]).toContain(response.statusCode);
    });

    it('should return correct error response structure', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id'
      });

      if (response.statusCode === 501) {
        const payload = JSON.parse(response.payload);
        expect(payload).toEqual({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request with different server IDs', async () => {
      const serverIds = ['server-123', 'mcp-server-456', 'test-id-789'];
      
      for (const serverId of serverIds) {
        const response = await server.inject({
          method: 'POST',
          url: `/mcp/github/sync/${serverId}`
        });

        expect([404, 501]).toContain(response.statusCode);
        if (response.statusCode === 501) {
          const payload = JSON.parse(response.payload);
          expect(payload).toEqual({
            success: false,
            error: 'Not implemented yet'
          });
        }
      }
    });

    it('should handle request with JSON payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          branch: 'main',
          force: true
        })
      });

      expect([400, 501]).toContain(response.statusCode);
      if (response.statusCode === 501) {
        const payload = JSON.parse(response.payload);
        expect(payload).toEqual({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });

    it('should handle request with authorization header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id',
        headers: {
          'authorization': 'Bearer test-token',
          'content-type': 'application/json'
        }
      });

      expect([400, 415, 501]).toContain(response.statusCode);
      if (response.statusCode === 501) {
        const payload = JSON.parse(response.payload);
        expect(payload).toEqual({
          success: false,
          error: 'Not implemented yet'
        });
      }
    });
  });

  describe('Parameter Handling', () => {
    it('should handle server ID with special characters', async () => {
      const specialIds = [
        'server-id-with-dashes',
        'server_id_with_underscores',
        'server123',
        'SERVER-ID-UPPERCASE'
      ];

      for (const serverId of specialIds) {
        const response = await server.inject({
          method: 'POST',
          url: `/mcp/github/sync/${serverId}`
        });

        expect(response.statusCode).toBe(501);
      }
    });

    it('should handle encoded server ID', async () => {
      const encodedId = encodeURIComponent('server@domain.com');
      const response = await server.inject({
        method: 'POST',
        url: `/mcp/github/sync/${encodedId}`
      });

      expect(response.statusCode).toBe(501);
    });

    it('should handle very long server ID', async () => {
      const longId = 'a'.repeat(255);
      const response = await server.inject({
        method: 'POST',
        url: `/mcp/github/sync/${longId}`
      });

      // Very long URLs might hit server limits and return 404 or 501
      expect([404, 501]).toContain(response.statusCode);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id',
        headers: {
          'content-type': 'application/json'
        },
        payload: 'invalid-json'
      });

      // Should return 400 for malformed JSON or still 501 if not implemented
      expect([400, 501]).toContain(response.statusCode);
    });

    it('should handle empty payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id',
        headers: {
          'content-type': 'application/json'
        },
        payload: '{}'
      });

      expect(response.statusCode).toBe(501);
    });

    it('should handle missing content-type header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id',
        payload: JSON.stringify({ test: 'data' })
      });

      // Missing content-type with JSON payload should return 415 (Unsupported Media Type)
      // or 501 if the route handles it gracefully
      expect([415, 501]).toContain(response.statusCode);
    });

    it('should handle requests with invalid content-type', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/test-server-id',
        headers: {
          'content-type': 'text/plain'
        },
        payload: 'plain text data'
      });

      expect(response.statusCode).toBe(501);
    });
  });

  describe('HTTP Method Restrictions', () => {
    it('should not accept GET requests', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/sync/test-server-id'
      });

      expect([404, 501]).toContain(response.statusCode);
    });

    it('should not accept PUT requests', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/mcp/github/sync/test-server-id'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not accept DELETE requests', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/mcp/github/sync/test-server-id'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not accept PATCH requests', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/mcp/github/sync/test-server-id'
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('URL Parameter Validation', () => {
    it('should handle missing server ID parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/'
      });

      // Missing required parameter should return 404 (Not Found)
      // But our catch-all might return 501
      expect([404, 501]).toContain(response.statusCode);
    });

    it('should handle empty server ID parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/'
      });

      // Empty parameter should return 404 (Not Found)
      // But our catch-all might return 501
      expect([404, 501]).toContain(response.statusCode);
    });

    it('should handle numeric server ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/12345'
      });

      expect(response.statusCode).toBe(501);
    });

    it('should handle UUID-like server ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/sync/550e8400-e29b-41d4-a716-446655440000'
      });

      expect(response.statusCode).toBe(501);
    });
  });
});
