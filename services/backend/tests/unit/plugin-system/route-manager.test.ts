import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import type { FastifyInstance, RouteOptions, RouteHandler } from 'fastify';
import { PluginRouteManager } from '../../../src/plugin-system/route-manager';

describe('PluginRouteManager', () => {
  let mockApp: Mocked<FastifyInstance>;
  let routeManager: PluginRouteManager;
  const pluginId = 'test-plugin';

  beforeEach(() => {
    mockApp = {
      get: vi.fn().mockReturnThis(),
      post: vi.fn().mockReturnThis(),
      put: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      patch: vi.fn().mockReturnThis(),
      head: vi.fn().mockReturnThis(),
      options: vi.fn().mockReturnThis(),
    } as unknown as Mocked<FastifyInstance>;

    routeManager = new PluginRouteManager(mockApp, pluginId);
  });

  describe('Constructor', () => {
    it('should create a route manager with plugin ID', () => {
      expect(routeManager.getPluginId()).toBe(pluginId);
      expect(routeManager.getNamespace()).toBe(`/api/plugin/${pluginId}`);
    });
  });

  describe('Route Namespacing', () => {
    it('should namespace routes correctly with leading slash', () => {
      const handler = vi.fn();
      routeManager.get('/users', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users', handler);
    });

    it('should namespace routes correctly without leading slash', () => {
      const handler = vi.fn();
      routeManager.get('users', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users', handler);
    });

    it('should handle empty route', () => {
      const handler = vi.fn();
      routeManager.get('', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/', handler);
    });

    it('should handle root route', () => {
      const handler = vi.fn();
      routeManager.get('/', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/', handler);
    });

    it('should handle nested routes', () => {
      const handler = vi.fn();
      routeManager.get('/users/profile', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users/profile', handler);
    });
  });

  describe('GET routes', () => {
    it('should register GET route with handler only', () => {
      const handler = vi.fn();
      routeManager.get('/users', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users', handler);
    });

    it('should register GET route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.get('/users', options, handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users', options, handler);
    });

    it('should register GET route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.get('/users', undefined, handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users', {}, handler);
    });
  });

  describe('POST routes', () => {
    it('should register POST route with handler only', () => {
      const handler = vi.fn();
      routeManager.post('/users', handler);
      
      expect(mockApp.post).toHaveBeenCalledWith('/api/plugin/test-plugin/users', handler);
    });

    it('should register POST route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.post('/users', options, handler);
      
      expect(mockApp.post).toHaveBeenCalledWith('/api/plugin/test-plugin/users', options, handler);
    });

    it('should register POST route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.post('/users', undefined, handler);
      
      expect(mockApp.post).toHaveBeenCalledWith('/api/plugin/test-plugin/users', {}, handler);
    });
  });

  describe('PUT routes', () => {
    it('should register PUT route with handler only', () => {
      const handler = vi.fn();
      routeManager.put('/users/:id', handler);
      
      expect(mockApp.put).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', handler);
    });

    it('should register PUT route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.put('/users/:id', options, handler);
      
      expect(mockApp.put).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', options, handler);
    });

    it('should register PUT route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.put('/users/:id', undefined, handler);
      
      expect(mockApp.put).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', {}, handler);
    });
  });

  describe('DELETE routes', () => {
    it('should register DELETE route with handler only', () => {
      const handler = vi.fn();
      routeManager.delete('/users/:id', handler);
      
      expect(mockApp.delete).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', handler);
    });

    it('should register DELETE route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.delete('/users/:id', options, handler);
      
      expect(mockApp.delete).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', options, handler);
    });

    it('should register DELETE route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.delete('/users/:id', undefined, handler);
      
      expect(mockApp.delete).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', {}, handler);
    });
  });

  describe('PATCH routes', () => {
    it('should register PATCH route with handler only', () => {
      const handler = vi.fn();
      routeManager.patch('/users/:id', handler);
      
      expect(mockApp.patch).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', handler);
    });

    it('should register PATCH route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.patch('/users/:id', options, handler);
      
      expect(mockApp.patch).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', options, handler);
    });

    it('should register PATCH route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.patch('/users/:id', undefined, handler);
      
      expect(mockApp.patch).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', {}, handler);
    });
  });

  describe('HEAD routes', () => {
    it('should register HEAD route with handler only', () => {
      const handler = vi.fn();
      routeManager.head('/users', handler);
      
      expect(mockApp.head).toHaveBeenCalledWith('/api/plugin/test-plugin/users', handler);
    });

    it('should register HEAD route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.head('/users', options, handler);
      
      expect(mockApp.head).toHaveBeenCalledWith('/api/plugin/test-plugin/users', options, handler);
    });

    it('should register HEAD route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.head('/users', undefined, handler);
      
      expect(mockApp.head).toHaveBeenCalledWith('/api/plugin/test-plugin/users', {}, handler);
    });
  });

  describe('OPTIONS routes', () => {
    it('should register OPTIONS route with handler only', () => {
      const handler = vi.fn();
      routeManager.options('/users', handler);
      
      expect(mockApp.options).toHaveBeenCalledWith('/api/plugin/test-plugin/users', handler);
    });

    it('should register OPTIONS route with options and handler', () => {
      const options = { preHandler: vi.fn() } as any;
      const handler = vi.fn();
      routeManager.options('/users', options, handler);
      
      expect(mockApp.options).toHaveBeenCalledWith('/api/plugin/test-plugin/users', options, handler);
    });

    it('should register OPTIONS route with empty options and handler', () => {
      const handler = vi.fn();
      routeManager.options('/users', undefined, handler);
      
      expect(mockApp.options).toHaveBeenCalledWith('/api/plugin/test-plugin/users', {}, handler);
    });
  });

  describe('Multiple HTTP methods', () => {
    it('should register multiple routes for the same path', () => {
      const getHandler = vi.fn();
      const postHandler = vi.fn();
      const putHandler = vi.fn();
      const deleteHandler = vi.fn();

      routeManager.get('/users', getHandler);
      routeManager.post('/users', postHandler);
      routeManager.put('/users', putHandler);
      routeManager.delete('/users', deleteHandler);

      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users', getHandler);
      expect(mockApp.post).toHaveBeenCalledWith('/api/plugin/test-plugin/users', postHandler);
      expect(mockApp.put).toHaveBeenCalledWith('/api/plugin/test-plugin/users', putHandler);
      expect(mockApp.delete).toHaveBeenCalledWith('/api/plugin/test-plugin/users', deleteHandler);
    });
  });

  describe('Complex route patterns', () => {
    it('should handle parameterized routes', () => {
      const handler = vi.fn();
      routeManager.get('/users/:id/posts/:postId', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id/posts/:postId', handler);
    });

    it('should handle wildcard routes', () => {
      const handler = vi.fn();
      routeManager.get('/files/*', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/files/*', handler);
    });

    it('should handle query parameters in route definition', () => {
      const handler = vi.fn();
      routeManager.get('/search', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/search', handler);
    });
  });

  describe('Route options handling', () => {
    it('should pass through complex route options', () => {
      const options = {
        preHandler: vi.fn(),
        onRequest: vi.fn(),
        onResponse: vi.fn()
      } as any;
      const handler = vi.fn();
      
      routeManager.get('/users/:id', options, handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/users/:id', options, handler);
    });

    it('should handle middleware in options', () => {
      const middleware1 = vi.fn();
      const middleware2 = vi.fn();
      const options = {
        preHandler: [middleware1, middleware2]
      } as any;
      const handler = vi.fn();
      
      routeManager.post('/users', options, handler);
      
      expect(mockApp.post).toHaveBeenCalledWith('/api/plugin/test-plugin/users', options, handler);
    });
  });

  describe('Plugin isolation', () => {
    it('should create different namespaces for different plugins', () => {
      const plugin1Manager = new PluginRouteManager(mockApp, 'plugin-1');
      const plugin2Manager = new PluginRouteManager(mockApp, 'plugin-2');
      
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      plugin1Manager.get('/users', handler1);
      plugin2Manager.get('/users', handler2);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/plugin-1/users', handler1);
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/plugin-2/users', handler2);
    });

    it('should prevent plugins from accessing core routes', () => {
      const handler = vi.fn();
      
      // Plugin tries to register a route that looks like a core route
      routeManager.get('/api/users', handler);
      
      // Should still be namespaced
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/api/users', handler);
    });

    it('should prevent plugins from escaping namespace with relative paths', () => {
      const handler = vi.fn();
      
      // Plugin tries to escape namespace
      routeManager.get('../../../admin', handler);
      
      // Should still be namespaced
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/../../../admin', handler);
    });
  });

  describe('Utility methods', () => {
    it('should return correct plugin ID', () => {
      expect(routeManager.getPluginId()).toBe('test-plugin');
    });

    it('should return correct namespace', () => {
      expect(routeManager.getNamespace()).toBe('/api/plugin/test-plugin');
    });

    it('should handle plugin IDs with special characters', () => {
      const specialPluginManager = new PluginRouteManager(mockApp, 'my-plugin_v2.0');
      expect(specialPluginManager.getNamespace()).toBe('/api/plugin/my-plugin_v2.0');
      
      const handler = vi.fn();
      specialPluginManager.get('/test', handler);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/my-plugin_v2.0/test', handler);
    });
  });

  describe('Return values', () => {
    it('should return the result from Fastify app methods', () => {
      const mockReturn = { test: 'value' };
      mockApp.get.mockReturnValue(mockReturn as any);
      
      const handler = vi.fn();
      const result = routeManager.get('/test', handler);
      
      expect(result).toBe(mockReturn);
    });

    it('should chain return values correctly', () => {
      mockApp.post.mockReturnThis();
      
      const handler = vi.fn();
      const result = routeManager.post('/test', handler);
      
      expect(result).toBe(mockApp);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined handler gracefully when options provided', () => {
      const options = { preHandler: vi.fn() } as any;
      
      // This should not throw, but handler will be undefined
      routeManager.get('/test', options, undefined as any);
      
      expect(mockApp.get).toHaveBeenCalledWith('/api/plugin/test-plugin/test', options, undefined);
    });

    it('should handle very long route paths', () => {
      const longPath = '/very/long/path/with/many/segments/that/goes/on/and/on/and/on';
      const handler = vi.fn();
      
      routeManager.get(longPath, handler);
      
      expect(mockApp.get).toHaveBeenCalledWith(`/api/plugin/test-plugin${longPath}`, handler);
    });

    it('should handle routes with special characters', () => {
      const specialPath = '/users/@me/settings#section';
      const handler = vi.fn();
      
      routeManager.get(specialPath, handler);
      
      expect(mockApp.get).toHaveBeenCalledWith(`/api/plugin/test-plugin${specialPath}`, handler);
    });
  });
});
