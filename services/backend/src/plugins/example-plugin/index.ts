/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Plugin, type DatabaseExtension } from '../../plugin-system/types';
import { type FastifyInstance } from 'fastify';
import { type AnyDatabase, getSchema } from '../../db'; // Import getSchema
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'; // For type guard
import { type NodePgDatabase } from 'drizzle-orm/node-postgres'; // For casting db
import { type SQLiteTable } from 'drizzle-orm/sqlite-core';     // For casting table from schema
import { type PgTable } from 'drizzle-orm/pg-core';         // For casting table from schema
// import { exampleEntities } from './schema'; // No longer directly used for queries
import { eq, sql } from 'drizzle-orm';

// Helper type guard to check for BetterSQLite3Database specific methods
function isSQLiteDB(db: AnyDatabase): db is BetterSQLite3Database<any> {
  // Check for methods specific to BetterSQLite3Database query results/execution
  // This is a heuristic. A more robust check might involve more specific features.
  return typeof (db as BetterSQLite3Database).get === 'function' &&
         typeof (db as BetterSQLite3Database).all === 'function' &&
         typeof (db as BetterSQLite3Database).run === 'function';
}

const examplePluginTableDefinitions = {
  'example_entities': { // Table name matches the one in exampleEntities
    id: (b: any) => b('id').primaryKey(),
    name: (b: any) => b('name').notNull(),
    description: (b: any) => b('description'),
    createdAt: (b: any) => b('created_at', { mode: 'timestamp' }).notNull().defaultNow(), // Use defaultNow for portability
  }
};

class ExamplePlugin implements Plugin {
  meta = {
    id: 'example-plugin',
    name: 'Example Plugin',
    version: '1.0.0',
    description: 'An example plugin for DeployStack',
    author: 'DeployStack Team',
  };
  
  // Database extension
  databaseExtension: DatabaseExtension = {
    tableDefinitions: examplePluginTableDefinitions, // Use tableDefinitions
    
    // Optional initialization function
    // Use arrow function to correctly capture 'this' for access to this.meta.id
    onDatabaseInit: async (db: AnyDatabase) => {
      console.log('Initializing example plugin database...');

      const currentSchema = getSchema();
      // 'this' here refers to the ExamplePlugin instance because of the arrow function
      const tableNameInSchema = `${this.meta.id}_example_entities`; 
      const table = currentSchema[tableNameInSchema];

      if (!table) {
        console.error(`[${this.meta.id}] Critical: Table ${tableNameInSchema} not found in global schema! Cannot initialize database for plugin.`);
        return;
      }
      
      let currentCount = 0;
      if (isSQLiteDB(db)) {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(table as SQLiteTable)
          .get();
        currentCount = result?.count ?? 0;
      } else {
        // Assume NodePgDatabase-like behavior
        const rows = await (db as NodePgDatabase)
          .select({ count: sql<number>`count(*)` })
          .from(table as PgTable);
        currentCount = rows[0]?.count ?? 0;
      }
      
      if (currentCount === 0) {
        console.log(`[${this.meta.id}] Seeding initial data...`);
        const dataToSeed = {
          id: 'example1',
          name: 'Example Entity',
          description: 'This is an example entity created by the plugin',
        };
        if (isSQLiteDB(db)) {
          await db.insert(table as SQLiteTable).values(dataToSeed).run();
        } else {
          // Assume NodePgDatabase-like behavior
          await (db as NodePgDatabase).insert(table as PgTable).values(dataToSeed);
        }
        console.log(`[${this.meta.id}] Seeded initial data`);
      }
    },
  };
  
  // Initialize the plugin
  async initialize(app: FastifyInstance, db: AnyDatabase | null) {
    console.log(`[${this.meta.id}] Initializing...`);

    if (!db) {
      console.warn(`[${this.meta.id}] Database not available, skipping database-dependent routes.`);
      return;
    }

    const currentSchema = getSchema();
    const tableNameInSchema = `${this.meta.id}_example_entities`;
    const table = currentSchema[tableNameInSchema];

    if (!table) {
      console.error(`[${this.meta.id}] Critical: Table ${tableNameInSchema} not found in global schema! Cannot register API routes.`);
      return;
    }
    
    // Register plugin routes
    app.get('/api/examples', async () => {
      if (isSQLiteDB(db)) {
        const examples = await db.select().from(table as SQLiteTable).all();
        return examples;
      } else {
        // Assume NodePgDatabase-like behavior
        const examples = await (db as NodePgDatabase).select().from(table as PgTable);
        return examples;
      }
    });
    
    app.get('/api/examples/:id', async (request, reply) => {
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
    
    console.log(`[${this.meta.id}] Initialized successfully`);
  }
  
  // Optional cleanup
  async shutdown() {
    console.log('Shutting down example plugin...');
  }
}

// Export the plugin class as default
export default ExamplePlugin;
