import { type FastifyBaseLogger } from 'fastify';
import { type PluginRouteManager } from '../../plugin-system/route-manager';
import { type AnyDatabase } from '../../db';
import { sql } from 'drizzle-orm';

/**
 * Register all routes for the example plugin
 *
 * All routes registered here will be automatically namespaced under:
 * /api/plugin/example-plugin/
 *
 * @param routeManager The isolated route manager for this plugin
 * @param db The database instance (can be null if not configured)
 * @param logger The logger instance for structured logging
 */
export async function registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null, logger: FastifyBaseLogger): Promise<void> {
  // Always register routes for API documentation, even without database
  // This ensures plugin routes appear in OpenAPI spec during setup phase

  // Plugin tables are created dynamically and not part of the schema export
  // We'll use raw SQL queries for plugin table access
  const tableName = `${routeManager.getPluginId()}_example_entities`;
  let databaseAvailable = false;

  if (db) {
    try {
      // Test if the table exists by querying it
      await db.execute(sql.raw(`SELECT 1 FROM "${tableName}" LIMIT 1`));
      databaseAvailable = true;
      logger.info({
        operation: 'plugin_routes_register',
        pluginId: routeManager.getPluginId(),
        tableName
      }, 'Database and plugin table available for routes.');
    } catch (error) {
      logger.warn({
        operation: 'plugin_routes_register',
        pluginId: routeManager.getPluginId(),
        tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Plugin table not accessible, registering fallback routes.');
    }
  } else {
    logger.info({
      operation: 'plugin_routes_register',
      pluginId: routeManager.getPluginId(),
      reason: 'database_not_available'
    }, 'Database not available, registering fallback routes for API documentation.');
  }



  // Register GET /examples route
  // This becomes: GET /api/plugin/example-plugin/examples
  routeManager.get('/examples', async (request, reply) => {
    if (!databaseAvailable || !db) {
      const fallbackResponse = {
        success: false,
        error: 'Database not configured',
        message: 'Plugin requires database setup. Please configure your database first.',
        examples: []
      };
      return reply.status(503).send(fallbackResponse);
    }

    try {
      // PostgreSQL query using raw SQL
      const result = await db.execute(
        sql.raw(`SELECT * FROM "${tableName}"`)
      );
      return { success: true, examples: result.rows || [] };
    } catch (error) {
      logger.error({ error, operation: 'get_examples' }, 'Database error getting examples');
      const errorResponse = {
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve examples from database'
      };
      return reply.status(500).send(errorResponse);
    }
  });

  // Register GET /examples/:id route
  // This becomes: GET /api/plugin/example-plugin/examples/:id
  routeManager.get('/examples/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!databaseAvailable || !db) {
      const fallbackResponse = {
        success: false,
        error: 'Database not configured',
        message: 'Plugin requires database setup. Please configure your database first.'
      };
      return reply.status(503).send(fallbackResponse);
    }

    try {
      // PostgreSQL query using raw SQL with parameterized query
      const result = await db.execute(
        sql.raw(`SELECT * FROM "${tableName}" WHERE id = '${id}' LIMIT 1`)
      );
      const example = result.rows?.[0] ?? null;

      if (!example) {
        return reply.status(404).send({
          success: false,
          error: 'Example entity not found',
          message: `No example found with ID: ${id}`
        });
      }

      return { success: true, example };
    } catch (error) {
      logger.error({ error, operation: 'get_example_by_id', id }, 'Database error getting example by ID');
      const errorResponse = {
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve example from database'
      };
      return reply.status(500).send(errorResponse);
    }
  });

  // Register a simple health check route that doesn't require database
  routeManager.get('/health', async () => {
    return {
      success: true,
      plugin: routeManager.getPluginId(),
      database_available: databaseAvailable,
      timestamp: new Date().toISOString()
    };
  });

  logger.info({
    operation: 'plugin_routes_register',
    pluginId: routeManager.getPluginId(),
    namespace: routeManager.getNamespace()
  }, 'Routes registered successfully');
}
