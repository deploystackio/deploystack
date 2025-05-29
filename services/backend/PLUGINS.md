# DeployStack Plugin System

This document explains how to create and integrate plugins into DeployStack. The plugin system enables extending DeployStack with additional functionality, cloud providers, database tables, APIs, and UI components.

## Overview

DeployStack's plugin architecture allows for extensible, modular development. Plugins can:

- Add new database tables and schemas
- Register new API routes
- Extend core functionality
- Add support for additional cloud providers
- Implement custom business logic

## Plugin Structure

A basic plugin consists of the following files:

```bash
your-plugin/
├── package.json      # Plugin metadata
├── index.ts          # Main plugin entry point
└── schema.ts         # Optional database schema extensions
```

### Required Files

1. **package.json** - Defines plugin metadata and dependencies
2. **index.ts** - Implements the Plugin interface and exports the plugin class
3. **schema.ts** - (Optional) Contains database schema extensions

## Creating a New Plugin

### 1. Create Plugin Directory

Create a directory for your plugin:

```bash
mkdir -p plugins/my-custom-plugin
cd plugins/my-custom-plugin
```

### 2. Create package.json

Add basic plugin information:

```json
{
  "name": "deploystack-my-custom-plugin",
  "version": "1.0.0",
  "main": "index.js",
  "private": true
}
```

### 3. Define Database Schema (Optional)

If your plugin requires database tables, create a `schema.ts` file:

```typescript
import { sqliteTable, text, integer, sql } from 'drizzle-orm/sqlite-core';

// Define your plugin's tables
export const myCustomEntities = sqliteTable('my_custom_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  data: text('data'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// You can define multiple tables if needed
export const myCustomRelations = sqliteTable('my_custom_relations', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => myCustomEntities.id),
  relationType: text('relation_type').notNull(),
});
```

### 4. Implement the Plugin Interface

Create an `index.ts` file that implements the Plugin interface:

```typescript
import { type Plugin, type DatabaseExtension } from '../../src/plugin-system/types';
import { type FastifyInstance } from 'fastify';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { myCustomEntities, myCustomRelations } from './schema';

class MyCustomPlugin implements Plugin {
  // Plugin metadata
  meta = {
    id: 'my-custom-plugin',
    name: 'My Custom Plugin',
    version: '1.0.0',
    description: 'Adds custom functionality to DeployStack',
    author: 'Your Name',
  };
  
  // Database extension (optional - remove if not needed)
  databaseExtension: DatabaseExtension = {
    // Register tables defined in schema.ts
    tables: [myCustomEntities, myCustomRelations],
    
    // Optional initialization function for seeding data
    async onDatabaseInit(db: BetterSQLite3Database) {
      console.log('Initializing my custom plugin database...');
      
      // Example: seed initial data if needed
      const count = await db
        .select({ count: sql`count(*)` })
        .from(myCustomEntities)
        .get();
      
      if (count && count.count === 0) {
        // Insert initial data
        await db.insert(myCustomEntities).values({
          id: 'initial-entity',
          name: 'Initial Entity',
          data: JSON.stringify({ initialized: true }),
        }).run();
        
        console.log('My custom plugin: Seeded initial data');
      }
    },
  };
  
  // Plugin initialization
  async initialize(app: FastifyInstance, db: BetterSQLite3Database) {
    console.log('Initializing my custom plugin...');
    
    // Register API routes
    app.get('/api/my-custom', async (request, reply) => {
      const entities = await db.select().from(myCustomEntities).all();
      return { entities };
    });
    
    app.get('/api/my-custom/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const entity = await db
        .select()
        .from(myCustomEntities)
        .where(eq(myCustomEntities.id, id))
        .get();
      
      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }
      
      return entity;
    });
    
    app.post('/api/my-custom', async (request, reply) => {
      const body = request.body as { name: string; data?: string };
      
      if (!body.name) {
        return reply.status(400).send({ error: 'Name is required' });
      }
      
      const id = crypto.randomUUID();
      
      await db.insert(myCustomEntities).values({
        id,
        name: body.name,
        data: body.data || null,
      }).run();
      
      return { id, ...body };
    });
    
    console.log('My custom plugin initialized successfully');
  }
  
  // Optional shutdown method for cleanup
  async shutdown() {
    console.log('Shutting down my custom plugin...');
    // Perform any cleanup needed
  }
}

// Export the plugin class as default
export default MyCustomPlugin;
```

## Plugin Integration Points

### Database Extension

The `databaseExtension` property allows your plugin to:

1. Define tables using Drizzle ORM
2. Initialize data (seeding, migrations, etc.)
3. Integrate with the core database schema

### API Routes

Register API routes during the plugin's `initialize` method:

```typescript
app.get('/api/my-feature', async (request, reply) => {
  // Handle request
  return { feature: 'data' };
});
```

### Access to Core Services

Plugins receive access to:

- **Fastify instance** (`app`) - For registering routes, hooks, and decorations
- **Database instance** (`db`) - For database operations
- **Configuration** - Through the plugin manager (if provided)

## Plugin Lifecycle

Plugins follow this lifecycle:

1. **Loading** - Plugin is discovered and loaded
2. **Database Registration** - Schema tables are registered
3. **Database Initialization** - `onDatabaseInit` is called if provided
4. **Initialization** - `initialize` method is called
5. **Runtime** - Plugin operates as part of the application
6. **Shutdown** - `shutdown` method is called during application termination

## Testing Your Plugin

To test your plugin:

1. Place it in the `plugins` directory
2. Start the DeployStack server
3. Check server logs for initialization messages
4. Test your plugin's API endpoints

## Advanced Plugin Features

### Configuration

Your plugin can access configuration provided by the plugin manager:

```typescript
async initialize(app: FastifyInstance, db: BetterSQLite3Database) {
  // Access plugin-specific configuration
  const config = app.pluginManager.getPluginConfig(this.meta.id);
  
  // Use configuration values
  const apiKey = config?.apiKey as string;
  
  // Initialize with configuration
}
```

### Plugin Manager APIs

Plugins can access other plugins through the plugin manager:

```typescript
// Check if another plugin is available
const hasAnotherPlugin = app.pluginManager.getPlugin('another-plugin-id');

// Conditionally use functionality if available
if (hasAnotherPlugin) {
  // Integrate with the other plugin
}
```

### Frontend Integration

If your plugin needs to extend the UI, you can:

1. Register API endpoints that provide UI configuration
2. Use the Plugin Manager to register UI components
3. Follow frontend plugin documentation for UI extensions

## Best Practices

1. **Unique IDs** - Ensure your plugin ID is unique and descriptive
2. **Error Handling** - Properly handle errors in your plugin
3. **Database Relationships** - Be careful with cross-plugin table relationships
4. **Schema Design** - Follow naming conventions for your plugin's tables
5. **Documentation** - Include a README.md with your plugin
6. **Versioning** - Use semantic versioning for your plugin

## Troubleshooting

### Plugin Not Loading

- Check plugin directory structure
- Ensure your plugin class is exported as default
- Verify package.json contains required fields

### Database Errors

- Check your schema definitions
- Ensure proper initialization in `onDatabaseInit`
- Verify SQL queries in your plugin

### Integration Issues

- Look for errors during plugin initialization
- Check console logs for error messages
- Verify API routes are registered correctly

## Example Plugins

See the `plugins/example-plugin` directory for a working example.

## Plugin API Reference

The complete Plugin interface is defined in `src/plugin-system/types.ts`.

---

For additional questions or support, please contact the DeployStack team or open an issue on GitHub.
