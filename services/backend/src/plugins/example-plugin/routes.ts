import { type FastifyBaseLogger } from 'fastify';
import { type PluginRouteManager } from '../../plugin-system/route-manager';
import { type AnyDatabase, getSchema } from '../../db';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { type PgTable } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Helper type guard to check for BetterSQLite3Database specific methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSQLiteDB(db: AnyDatabase): db is BetterSQLite3Database<any> {
  return typeof (db as BetterSQLite3Database).get === 'function' &&
         typeof (db as BetterSQLite3Database).all === 'function' &&
         typeof (db as BetterSQLite3Database).run === 'function';
}

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

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let table: any = null;
  let databaseAvailable = false;
  
  if (db) {
    try {
      const currentSchema = getSchema();
      const tableNameInSchema = `${routeManager.getPluginId()}_example_entities`;
      table = currentSchema[tableNameInSchema];
      
      if (table) {
        databaseAvailable = true;
        logger.info({
          operation: 'plugin_routes_register',
          pluginId: routeManager.getPluginId(),
          tableNameInSchema
        }, 'Database and table available for plugin routes.');
      } else {
        logger.warn({
          operation: 'plugin_routes_register',
          pluginId: routeManager.getPluginId(),
          tableNameInSchema,
          availableTables: Object.keys(currentSchema)
        }, 'Table not found in schema, registering fallback routes.');
      }
    } catch (schemaError) {
      logger.warn({
        operation: 'plugin_routes_register',
        pluginId: routeManager.getPluginId(),
        error: schemaError
      }, 'Error accessing schema, registering fallback routes.');
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
    if (!databaseAvailable || !db || !table) {
      const fallbackResponse = {
        success: false,
        error: 'Database not configured',
        message: 'Plugin requires database setup. Please configure your database first.',
        examples: []
      };
      return reply.status(503).send(fallbackResponse);
    }
    
    try {
      if (isSQLiteDB(db)) {
        const examples = await db.select().from(table as SQLiteTable).all();
        return { success: true, examples };
      } else {
        // Assume NodePgDatabase-like behavior
        const examples = await (db as NodePgDatabase).select().from(table as PgTable);
        return { success: true, examples };
      }
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
    
    if (!databaseAvailable || !db || !table) {
      const fallbackResponse = {
        success: false,
        error: 'Database not configured',
        message: 'Plugin requires database setup. Please configure your database first.'
      };
      return reply.status(503).send(fallbackResponse);
    }
    
    try {
      let example;
      
      if (isSQLiteDB(db)) {
        // Cast to SQLiteTable to access its 'id' column for the 'eq' condition
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typedTable = table as SQLiteTable & { id: any }; 
        example = await db
          .select()
          .from(typedTable)
          .where(eq(typedTable.id, id))
          .get();
      } else {
        // Cast to PgTable to access its 'id' column for the 'eq' condition
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typedTable = table as PgTable & { id: any };
        const rows = await (db as NodePgDatabase)
          .select()
          .from(typedTable)
          .where(eq(typedTable.id, id));
        example = rows[0] ?? null;
      }
      
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
