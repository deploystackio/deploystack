import { type FastifyInstance, type RouteOptions, type RouteHandler } from 'fastify';

/**
 * Plugin Route Manager - Provides isolated route registration for plugins
 * 
 * This class enforces route isolation by automatically namespacing all plugin routes
 * under /api/plugin/<plugin-id>/ to prevent plugins from interfering with core routes
 * or each other.
 */
export class PluginRouteManager {
  constructor(
    private app: FastifyInstance,
    private pluginId: string
  ) {}

  /**
   * Convert a plugin route to a namespaced route
   * @param route The plugin's route (e.g., '/users' or 'users')
   * @returns Namespaced route (e.g., '/api/plugin/my-plugin/users')
   */
  private getNamespacedRoute(route: string): string {
    // Ensure route starts with /
    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
    return `/api/plugin/${this.pluginId}/${cleanRoute}`;
  }

  /**
   * Register a GET route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  get(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      // options is actually the handler
      return this.app.get(namespacedRoute, options);
    } else {
      // options is RouteOptions, handler is separate
      return this.app.get(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Register a POST route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  post(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      return this.app.post(namespacedRoute, options);
    } else {
      return this.app.post(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Register a PUT route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  put(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      return this.app.put(namespacedRoute, options);
    } else {
      return this.app.put(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Register a DELETE route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  delete(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      return this.app.delete(namespacedRoute, options);
    } else {
      return this.app.delete(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Register a PATCH route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  patch(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      return this.app.patch(namespacedRoute, options);
    } else {
      return this.app.patch(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Register a HEAD route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  head(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      return this.app.head(namespacedRoute, options);
    } else {
      return this.app.head(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Register an OPTIONS route for the plugin
   * @param route Plugin route path
   * @param options Route options or handler function
   * @param handler Route handler (if options provided)
   */
  options(route: string, options?: RouteOptions | RouteHandler, handler?: RouteHandler) {
    const namespacedRoute = this.getNamespacedRoute(route);
    
    if (typeof options === 'function') {
      return this.app.options(namespacedRoute, options);
    } else {
      return this.app.options(namespacedRoute, options || {}, handler!);
    }
  }

  /**
   * Get the plugin ID this route manager is associated with
   */
  getPluginId(): string {
    return this.pluginId;
  }

  /**
   * Get the base namespace for this plugin's routes
   */
  getNamespace(): string {
    return `/api/plugin/${this.pluginId}`;
  }
}
