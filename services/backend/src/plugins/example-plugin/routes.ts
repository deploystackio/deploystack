import { type PluginRouteManager } from '../../plugin-system/route-manager';
import { type AnyDatabase, getSchema } from '../../db';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { type PgTable } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Helper type guard to check for BetterSQLite3Database specific methods
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
 */
export async function registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null): Promise<void> {
  if (!db) {
    console.warn(`[${routeManager.getPluginId()}] Database not available, skipping database-dependent routes.`);
    return;
  }

  const currentSchema = getSchema();
  const tableNameInSchema = `${routeManager.getPluginId()}_example_entities`;
  const table = currentSchema[tableNameInSchema];

  if (!table) {
    console.error(`[${routeManager.getPluginId()}] Critical: Table ${tableNameInSchema} not found in global schema! Cannot register API routes.`);
    return;
  }

  // Register GET /examples route
  // This becomes: GET /api/plugin/example-plugin/examples
  routeManager.get('/examples', async () => {
    if (isSQLiteDB(db)) {
      const examples = await db.select().from(table as SQLiteTable).all();
      return examples;
    } else {
      // Assume NodePgDatabase-like behavior
      const examples = await (db as NodePgDatabase).select().from(table as PgTable);
      return examples;
    }
  });

  // Register GET /examples/:id route
  // This becomes: GET /api/plugin/example-plugin/examples/:id
  routeManager.get('/examples/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    let example;

    if (isSQLiteDB(db)) {
      // Cast to SQLiteTable to access its 'id' column for the 'eq' condition
      const typedTable = table as SQLiteTable & { id: any }; 
      example = await db
        .select()
        .from(typedTable)
        .where(eq(typedTable.id, id))
        .get();
    } else {
      // Cast to PgTable to access its 'id' column for the 'eq' condition
      const typedTable = table as PgTable & { id: any };
      const rows = await (db as NodePgDatabase)
        .select()
        .from(typedTable)
        .where(eq(typedTable.id, id));
      example = rows[0] ?? null;
    }
    
    if (!example) {
      return reply.status(404).send({ error: 'Example entity not found' });
    }
    return example;
  });

  console.log(`[${routeManager.getPluginId()}] Routes registered successfully under ${routeManager.getNamespace()}`);
}
