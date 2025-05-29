import { type FastifyInstance } from 'fastify';
// import { type SQLiteTable } from 'drizzle-orm/sqlite-core'; // Replaced by tableDefinitions
// import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'; // Replaced by AnyDatabase
import { type AnyDatabase } from '../db'; // Import AnyDatabase

/**
 * Plugin metadata interface
 */
export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
}

/**
 * Database extension interface
 * Allows plugins to extend the database schema
 */
export interface DatabaseExtension {
  /**
   * Table definitions to be added to the database schema.
   * Key: Preferred table name (plugin manager might prefix this).
   * Value: Column definitions object, similar to baseTableDefinitions in schema.ts.
   * e.g., { id: (b:any)=>b('id'), name: (b:any)=>b('name') }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tableDefinitions?: Record<string, Record<string, (columnBuilder: any) => any>>;
  
  /**
   * Run after the database (and its tables, including plugin tables) is initialized.
   * Can be used for seeding or additional setup.
   * This is called only if the main database initializes successfully.
   */
  onDatabaseInit?: (db: AnyDatabase) => Promise<void>; // db here will be non-null
}

/**
 * Core plugin interface that all plugins must implement
 */
export interface Plugin {
  /**
   * Plugin metadata
   */
  meta: PluginMeta;
  
  /**
   * Optional database extension
   */
  databaseExtension?: DatabaseExtension;
  
  /**
   * Initialize the plugin
   * @param app The Fastify instance
   * @param db The database instance (can be null if not configured/initialized)
   */
  initialize: (app: FastifyInstance, db: AnyDatabase | null) => Promise<void>;
  
  /**
   * Shutdown the plugin gracefully
   */
  shutdown?: () => Promise<void>;
}

/**
 * Plugin constructor interface
 */
export interface PluginConstructor {
  new (): Plugin;
}

/**
 * The plugin package structure
 */
export interface PluginPackage {
  /**
   * The plugin implementation
   */
  default: PluginConstructor;
}

/**
 * Plugin loading options
 */
export interface PluginOptions {
  /**
   * Whether to enable the plugin by default
   */
  enabled?: boolean;
  
  /**
   * Plugin-specific configuration
   */
  config?: Record<string, unknown>;
}

/**
 * Plugin configuration that can be loaded from a config file
 */
export interface PluginConfiguration {
  /**
   * Paths to load plugins from
   */
  paths?: string[];
  
  /**
   * Plugins and their options
   */
  plugins?: Record<string, PluginOptions>;
}
