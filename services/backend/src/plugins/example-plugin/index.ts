/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyBaseLogger } from 'fastify';
import { 
  type Plugin, 
  type DatabaseExtension,
  type GlobalSettingsExtension,
  type PluginRouteManager
} from '../../plugin-system/types';

import { type AnyDatabase, type AnySchema } from '../../db';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type SQLiteTable } from 'drizzle-orm/sqlite-core'; 
import { type PgTable } from 'drizzle-orm/pg-core'; 
// import { exampleEntities } from './schema'; // No longer directly used for queries
import { sql } from 'drizzle-orm';
import { EVENT_NAMES } from '../../events';
import type { EventData, EventContext, EventListeners } from '../../events/types';

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
    created_at: (b: any) => b('created_at', { mode: 'timestamp' }).notNull().defaultNow(), // Use defaultNow for portability
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

  // Event listeners for various system events
  eventListeners: EventListeners = {
    [EVENT_NAMES.USER_REGISTERED]: this.handleUserRegistered.bind(this),
    [EVENT_NAMES.USER_LOGIN]: this.handleUserLogin.bind(this),
    [EVENT_NAMES.TEAM_CREATED]: this.handleTeamCreated.bind(this),
    [EVENT_NAMES.TEAM_MEMBER_ADDED]: this.handleTeamMemberAdded.bind(this),
    [EVENT_NAMES.SETTINGS_UPDATED]: this.handleSettingsUpdated.bind(this),
    [EVENT_NAMES.MCP_INSTALLATION_CREATED]: this.handleMcpInstallationCreated.bind(this),
  };

  // Define global settings provided by this plugin
  globalSettingsExtension: GlobalSettingsExtension = {
    groups: [
      {
        id: 'example_plugin_settings',
        name: 'Example Plugin Settings',
        description: 'Configuration for the Example Plugin.',
        icon: 'puzzle', // Example icon (Lucide icon name)
        sort_order: 100, // Example sort order
      },
    ],
    settings: [
      {
        key: 'examplePlugin.config.featureEnabled',
        defaultValue: false,
        type: 'boolean',
        description: 'Enable or disable a specific feature in the example plugin.',
        encrypted: false,
        required: false,
        groupId: 'example_plugin_settings',
      },
      {
        key: 'examplePlugin.config.maxRetries',
        defaultValue: 3,
        type: 'number',
        description: 'Maximum number of retries for API calls.',
        encrypted: false,
        required: false,
        groupId: 'example_plugin_settings',
      },
      {
        key: 'examplePlugin.secret.apiKey',
        defaultValue: '',
        type: 'string',
        description: 'API Key for an external service used by the example plugin.',
        encrypted: true,
        required: false,
        groupId: 'example_plugin_settings',
      },
      { // Example of a setting not in a custom group (will go to default or no group)
        key: 'examplePlugin.general.logLevel',
        defaultValue: 'info',
        type: 'string',
        description: 'Logging level for the example plugin.',
        encrypted: false,
        required: false,
      }
    ],
  };
  
  // Database extension
  databaseExtension: DatabaseExtension = {
    tableDefinitions: examplePluginTableDefinitions, // Use tableDefinitions
    
    // Optional initialization function
    onDatabaseInit: async (db: AnyDatabase, schema: AnySchema, logger: FastifyBaseLogger) => {
      logger.debug({
        operation: 'plugin_database_init',
        pluginId: 'example-plugin'
      }, 'Initializing example plugin database...');

      // Use hardcoded plugin ID since 'this' is not available in arrow function
      const tableNameInSchema = `example-plugin_example_entities`; 
      const table = schema[tableNameInSchema];

      if (!table) {
        logger.error({
          operation: 'plugin_database_init',
          pluginId: 'example-plugin',
          tableNameInSchema,
          availableTables: Object.keys(schema)
        }, 'Critical: Table not found in global schema! Cannot initialize database for plugin.');
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
        logger.debug({
          operation: 'plugin_database_seed',
          pluginId: 'example-plugin'
        }, 'Seeding initial data for example plugin...');
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
        logger.info({
          operation: 'plugin_database_seed',
          pluginId: 'example-plugin'
        }, 'Seeded initial data for example plugin');
      }
    },
  };
  
  // Initialize the plugin (non-route initialization only)
   
  async initialize(db: AnyDatabase | null, logger: FastifyBaseLogger) {
    logger.info({
      operation: 'plugin_init',
      pluginId: this.meta.id
    }, 'Initializing...');
    // Non-route initialization only - routes are now registered via registerRoutes method
    logger.info({
      operation: 'plugin_init',
      pluginId: this.meta.id
    }, 'Initialized successfully');
  }
  
  // Register plugin routes using the isolated route manager
  async registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null, logger: FastifyBaseLogger) {
    const { registerRoutes } = await import('./routes');
    await registerRoutes(routeManager, db, logger);
  }
  
  // Event handler methods
  private async handleUserRegistered(data: EventData<typeof EVENT_NAMES.USER_REGISTERED>, context: EventContext) {
    context.logger.info({
      operation: 'event_handler',
      pluginId: this.meta.id,
      event: 'user.registered',
      userId: data.user.id
    }, 'User registered event received');
    
    // Example: Track user registration in plugin's database
    // Could create a welcome record, send notification, etc.
  }

  private async handleUserLogin(data: EventData<typeof EVENT_NAMES.USER_LOGIN>, context: EventContext) {
    context.logger.debug({
      operation: 'event_handler',
      pluginId: this.meta.id,
      event: 'user.login',
      userId: data.user.id
    }, 'User login event received');
    
    // Example: Track login activity, update last seen, etc.
  }

  private async handleTeamCreated(data: EventData<typeof EVENT_NAMES.TEAM_CREATED>, context: EventContext) {
    context.logger.info({
      operation: 'event_handler',
      pluginId: this.meta.id,
      event: 'team.created',
      teamId: data.team.id,
      createdBy: data.createdBy.id
    }, 'Team created event received');
    
    // Example: Initialize team-specific plugin data
  }

  private async handleTeamMemberAdded(data: EventData<typeof EVENT_NAMES.TEAM_MEMBER_ADDED>, context: EventContext) {
    context.logger.info({
      operation: 'event_handler',
      pluginId: this.meta.id,
      event: 'team.member_added',
      teamId: data.team.id,
      userId: data.member.id
    }, 'Team member added event received');
    
    // Example: Send welcome message to new team member
  }

  private async handleSettingsUpdated(data: EventData<typeof EVENT_NAMES.SETTINGS_UPDATED>, context: EventContext) {
    context.logger.debug({
      operation: 'event_handler',
      pluginId: this.meta.id,
      event: 'settings.updated',
      settingKey: data.setting.key
    }, 'Settings updated event received');
    
    // Example: React to plugin-specific setting changes
    if (data.setting.key?.startsWith('examplePlugin.')) {
      context.logger.info({
        operation: 'plugin_config_change',
        pluginId: this.meta.id,
        settingKey: data.setting.key,
        newValue: data.setting.newValue
      }, 'Plugin setting updated');
    }
  }

  private async handleMcpInstallationCreated(data: EventData<typeof EVENT_NAMES.MCP_INSTALLATION_CREATED>, context: EventContext) {
    context.logger.info({
      operation: 'event_handler',
      pluginId: this.meta.id,
      event: 'mcp.installation_created',
      serverId: data.installation.serverId
    }, 'MCP installation created event received');
    
    // Example: Update plugin functionality based on available MCP servers
  }

  // Optional cleanup
  async shutdown(logger: FastifyBaseLogger) {
    logger.info({
      operation: 'plugin_shutdown',
      pluginId: this.meta.id
    }, 'Shutting down example plugin...');
  }
}

// Export the plugin class as default
export default ExamplePlugin;
