# DeployStack Plugin System

This document explains how to create and integrate plugins into DeployStack. The plugin system enables extending DeployStack with additional functionality, cloud providers, database tables, APIs, and UI components.

## Overview

DeployStack's plugin architecture allows for extensible, modular development with built-in security and isolation. Plugins can:

- Add new database tables and schemas
- Register new API routes (automatically namespaced for security)
- Extend core functionality
- Add support for additional cloud providers
- Implement custom business logic
- Define global settings and configuration groups

## Security Features

### Route Isolation & Security

DeployStack implements strict route isolation to ensure plugins cannot interfere with core functionality or each other:

- **Automatic Namespacing**: All plugin routes are automatically prefixed with `/api/plugin/<plugin-id>/`
- **No Direct Route Access**: Plugins cannot register routes directly on the global Fastify instance
- **Sandboxed Registration**: Plugins use `PluginRouteManager` which enforces namespacing
- **Core Route Protection**: Plugins cannot access or modify core routes (`/api/auth/*`, `/api/users/*`, etc.)

### Security Benefits

1. **Prevents Route Hijacking**: Malicious plugins cannot override authentication or user management routes
2. **Eliminates Route Conflicts**: Multiple plugins cannot register conflicting routes
3. **Predictable API Surface**: All plugin APIs follow consistent `/api/plugin/<name>/` structure
4. **Easy Auditing**: Route ownership is immediately clear from the URL structure
5. **Fail-Safe Design**: Plugins that don't follow the new system simply won't have routes registered

### Example Security Enforcement

```typescript
// ❌ This will NOT work - no direct app access
async initialize(app: FastifyInstance, db: AnyDatabase | null) {
  app.get('/api/auth/bypass', handler); // Cannot access core routes
}

// ✅ This is the ONLY way to register routes
async registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null) {
  // Automatically becomes /api/plugin/my-plugin/data
  routeManager.get('/data', handler);
}
```

## Plugin Structure

A basic plugin consists of the following files:

```bash
your-plugin/
├── package.json      # Plugin metadata
├── index.ts          # Main plugin entry point (metadata, DB extensions, global settings)
├── routes.ts         # API route definitions (isolated and namespaced)
└── schema.ts         # Optional database schema extensions
```

### Required Files

1. **package.json** - Defines plugin metadata and dependencies
2. **index.ts** - Implements the Plugin interface and exports the plugin class
3. **routes.ts** - Contains all API route definitions (automatically namespaced)
4. **schema.ts** - (Optional) Contains database schema extensions

### File Responsibilities

- **index.ts**: Plugin metadata, database extensions, global settings, non-route initialization
- **routes.ts**: All API route definitions using the isolated `PluginRouteManager`
- **schema.ts**: Database table definitions and schema extensions
- **package.json**: Plugin metadata and dependency declarations

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

### 4. Create Routes File

Create a `routes.ts` file for your API routes:

```typescript
import { type PluginRouteManager } from '../../plugin-system/route-manager';
import { type AnyDatabase, getSchema } from '../../db';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { type PgTable } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Helper type guard for database type checking
function isSQLiteDB(db: AnyDatabase): db is BetterSQLite3Database<any> {
  return typeof (db as BetterSQLite3Database).get === 'function' &&
         typeof (db as BetterSQLite3Database).all === 'function' &&
         typeof (db as BetterSQLite3Database).run === 'function';
}

/**
 * Register all routes for your custom plugin
 * 
 * All routes registered here will be automatically namespaced under:
 * /api/plugin/my-custom-plugin/
 */
export async function registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null): Promise<void> {
  if (!db) {
    console.warn(`[${routeManager.getPluginId()}] Database not available, skipping routes.`);
    return;
  }

  const currentSchema = getSchema();
  const tableNameInSchema = `${routeManager.getPluginId()}_my_custom_entities`;
  const table = currentSchema[tableNameInSchema];

  if (!table) {
    console.error(`[${routeManager.getPluginId()}] Table ${tableNameInSchema} not found in schema!`);
    return;
  }

  // Register GET /entities route
  // This becomes: GET /api/plugin/my-custom-plugin/entities
  routeManager.get('/entities', async () => {
    if (isSQLiteDB(db)) {
      const entities = await db.select().from(table as SQLiteTable).all();
      return { entities };
    } else {
      const entities = await (db as NodePgDatabase).select().from(table as PgTable);
      return { entities };
    }
  });

  // Register GET /entities/:id route
  // This becomes: GET /api/plugin/my-custom-plugin/entities/:id
  routeManager.get('/entities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    let entity;

    if (isSQLiteDB(db)) {
      const typedTable = table as SQLiteTable & { id: any };
      entity = await db
        .select()
        .from(typedTable)
        .where(eq(typedTable.id, id))
        .get();
    } else {
      const typedTable = table as PgTable & { id: any };
      const rows = await (db as NodePgDatabase)
        .select()
        .from(typedTable)
        .where(eq(typedTable.id, id));
      entity = rows[0] ?? null;
    }

    if (!entity) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    return entity;
  });

  // Register POST /entities route
  // This becomes: POST /api/plugin/my-custom-plugin/entities
  routeManager.post('/entities', async (request, reply) => {
    const body = request.body as { name: string; data?: string };

    if (!body.name) {
      return reply.status(400).send({ error: 'Name is required' });
    }

    const id = crypto.randomUUID();
    const entityData = {
      id,
      name: body.name,
      data: body.data || null,
    };

    if (isSQLiteDB(db)) {
      await db.insert(table as SQLiteTable).values(entityData).run();
    } else {
      await (db as NodePgDatabase).insert(table as PgTable).values(entityData);
    }

    return { id, ...body };
  });

  console.log(`[${routeManager.getPluginId()}] Routes registered successfully under ${routeManager.getNamespace()}`);
}
```

### 5. Implement the Plugin Interface

Create an `index.ts` file that implements the Plugin interface:

```typescript
import { 
  type Plugin, 
  type DatabaseExtension,
  type PluginRouteManager
} from '../../plugin-system/types';
import { type AnyDatabase, getSchema } from '../../db';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { type PgTable } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Helper type guard for database type checking
function isSQLiteDB(db: AnyDatabase): db is BetterSQLite3Database<any> {
  return typeof (db as BetterSQLite3Database).get === 'function' &&
         typeof (db as BetterSQLite3Database).all === 'function' &&
         typeof (db as BetterSQLite3Database).run === 'function';
}

// Table definitions for this plugin
const myCustomPluginTableDefinitions = {
  'my_custom_entities': {
    id: (b: any) => b('id').primaryKey(),
    name: (b: any) => b('name').notNull(),
    data: (b: any) => b('data'),
    createdAt: (b: any) => b('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  }
};

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
    tableDefinitions: myCustomPluginTableDefinitions,
    
    // Optional initialization function for seeding data
    onDatabaseInit: async (db: AnyDatabase) => {
      console.log(`[${this.meta.id}] Initializing database...`);

      const currentSchema = getSchema();
      const tableNameInSchema = `${this.meta.id}_my_custom_entities`;
      const table = currentSchema[tableNameInSchema];

      if (!table) {
        console.error(`[${this.meta.id}] Table ${tableNameInSchema} not found in schema!`);
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
        const rows = await (db as NodePgDatabase)
          .select({ count: sql<number>`count(*)` })
          .from(table as PgTable);
        currentCount = rows[0]?.count ?? 0;
      }

      if (currentCount === 0) {
        console.log(`[${this.meta.id}] Seeding initial data...`);
        const dataToSeed = {
          id: 'initial-entity',
          name: 'Initial Entity',
          data: JSON.stringify({ initialized: true }),
        };

        if (isSQLiteDB(db)) {
          await db.insert(table as SQLiteTable).values(dataToSeed).run();
        } else {
          await (db as NodePgDatabase).insert(table as PgTable).values(dataToSeed);
        }
        console.log(`[${this.meta.id}] Seeded initial data`);
      }
    },
  };
  
  // Plugin initialization (non-route initialization only)
  async initialize(db: AnyDatabase | null) {
    console.log(`[${this.meta.id}] Initializing...`);
    // Non-route initialization only - routes are registered via registerRoutes method
    console.log(`[${this.meta.id}] Initialized successfully`);
  }

  // Register plugin routes using the isolated route manager
  async registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null) {
    const { registerRoutes } = await import('./routes');
    await registerRoutes(routeManager, db);
  }
  
  // Optional shutdown method for cleanup
  async shutdown() {
    console.log(`[${this.meta.id}] Shutting down...`);
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
- **Global Settings** - Plugins can define their own global settings

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

## Defining Global Settings via Plugins

Plugins can contribute their own global settings to the DeployStack system. These settings will be managed alongside core global settings and will be editable by users with the `global_admin` role.

### How it Works

1. **Define `globalSettingsExtension`**: In your plugin class, add an optional property `globalSettingsExtension`.
2. **Structure**: This property should be an object implementing the `GlobalSettingsExtension` interface (defined in `src/plugin-system/types.ts`). It can contain:

- `groups`: An optional array of `GlobalSettingGroupForPlugin` objects to define new setting groups.
- `settings`: A mandatory array of `GlobalSettingDefinitionForPlugin` objects to define individual settings.

3. **Initialization**: During server startup, the `PluginManager` will:

- Collect all group and setting definitions from active plugins.
- Create any new groups defined by plugins if they don't already exist. If a group ID already exists, the plugin's group definition is ignored for that specific group, and the existing group is used.
- Initialize the plugin's global settings with their default values, but only if a setting with the same key doesn't already exist (either from core settings or another plugin). Core settings always take precedence.

4. **Access Control**: All plugin-defined global settings are subject to the same access control as core settings (i.e., manageable by `global_admin`).

5. **Security**:

- **Core Precedence**: Core global settings (defined in `services/backend/src/global-settings/`) cannot be overridden by plugins.
- **Duplicate Keys**: If a plugin attempts to register a setting with a key that already exists (from core or another plugin), the plugin's setting will be ignored, and a warning will be logged.

### Example: Defining Global Settings in a Plugin

```typescript
// In your plugin's index.ts

import { 
  type Plugin, 
  type GlobalSettingsExtension,
  // ... other imports
} from '../../plugin-system/types';

class MyAwesomePlugin implements Plugin {
  meta = {
    id: 'my-awesome-plugin',
    name: 'My Awesome Plugin',
    version: '1.0.0',
    // ... other metadata
  };

  globalSettingsExtension: GlobalSettingsExtension = {
    groups: [
      {
        id: 'my_awesome_plugin_group', // Unique ID for the group
        name: 'My Awesome Plugin Config',
        description: 'Settings specific to My Awesome Plugin.',
        icon: 'settings-2', // Example: Lucide icon name
        sort_order: 150,    // Controls tab order in UI
      }
    ],
    settings: [
      {
        key: 'myAwesomePlugin.features.enableSuperFeature',
        defaultValue: true,
        type: 'boolean',
        description: 'Enables the super feature of this plugin.',
        encrypted: false,
        required: false,
        groupId: 'my_awesome_plugin_group', // Link to the group defined above
      },
      {
        key: 'myAwesomePlugin.credentials.externalApiKey',
        defaultValue: '',
        type: 'string',
        description: 'API key for an external service used by this plugin.',
        encrypted: true, // Sensitive value, will be encrypted
        required: true,
        groupId: 'my_awesome_plugin_group',
      },
      {
        key: 'myAwesomePlugin.performance.maxRetries',
        defaultValue: 5,
        type: 'number',
        description: 'Maximum number of retries for API calls.',
        encrypted: false,
        required: false,
        groupId: 'my_awesome_plugin_group',
      },
      {
        // Example of a setting not belonging to a new custom group
        // It might appear in a default group or ungrouped in the UI,
        // or you can assign it to an existing core group ID if appropriate.
        key: 'myAwesomePlugin.performance.cacheDurationSeconds',
        defaultValue: 3600,
        type: 'number',
        description: 'Cache duration in seconds for plugin data.',
        encrypted: false,
        required: false,
        // groupId: 'system', // Example: if you want to add to an existing core group
      }
    ]
  };

  // ... rest of your plugin implementation (databaseExtension, initialize, etc.)
  async initialize(app: FastifyInstance, db: AnyDatabase | null) {
    console.log(`[${this.meta.id}] Initializing...`);
    
    // You can try to access your plugin's settings here if needed during init,
    // using GlobalSettingsService.get('myAwesomePlugin.features.enableSuperFeature')
    // Note: Ensure GlobalSettingsService is available or handle potential errors.
  }
}

export default MyAwesomePlugin;
```

### Important Considerations

- **Key Uniqueness**: Ensure your setting keys are unique, preferably prefixed with your plugin ID (e.g., `yourPluginId.category.settingName`) to avoid conflicts.
- **Group IDs**: If defining new groups, ensure their IDs are unique.
- **Default Values**: Provide sensible default values.
- **Encryption**: Mark sensitive settings (API keys, passwords) with `encrypted: true`.
- **Documentation**: Document any global settings your plugin introduces in its own README or documentation.

---

For additional questions or support, please contact the DeployStack team or open an issue on GitHub.
