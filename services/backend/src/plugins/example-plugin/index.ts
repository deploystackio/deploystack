import { type Plugin, type DatabaseExtension } from '../../plugin-system/types';
import { type FastifyInstance } from 'fastify';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { exampleEntities } from './schema';
import { eq, sql } from 'drizzle-orm'

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
    tables: [exampleEntities],
    
    // Optional initialization function
    async onDatabaseInit(db: BetterSQLite3Database) {
      // Seed data or perform other initializations
      console.log('Initializing example plugin database...');
      
      // Example: check if we need to seed data
      const count = await db
        .select({ count: sql`count(*)` })
        .from(exampleEntities)
        .get();
      
      if (count?.count === 0) {
        // Seed example data
        await db.insert(exampleEntities).values({
          id: 'example1',
          name: 'Example Entity',
          description: 'This is an example entity created by the plugin',
        }).run();
        
        console.log('Example plugin: Seeded initial data');
      }
    },
  };
  
  // Initialize the plugin
  async initialize(app: FastifyInstance, db: BetterSQLite3Database) {
    console.log('Initializing example plugin...');
    
    // Register plugin routes
    app.get('/api/examples', async () => {
      const examples = await db.select().from(exampleEntities).all();
      return examples;
    });
    
    app.get('/api/examples/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const example = await db
        .select()
        .from(exampleEntities)
        .where(eq(exampleEntities.id, id))
        .get();
      
      if (!example) {
        return reply.status(404).send({ error: 'Example entity not found' });
      }
      
      return example;
    });
    
    console.log('Example plugin initialized successfully');
  }
  
  // Optional cleanup
  async shutdown() {
    console.log('Shutting down example plugin...');
  }
}

// Export the plugin class as default
export default ExamplePlugin;
