import { type FastifyInstance } from 'fastify';
import { type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

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
   * Tables to be added to the database schema
   */
  tables: SQLiteTable[];
  
  /**
   * Run after the tables are created
   * Can be used for seeding or additional setup
   */
  onDatabaseInit?: (db: BetterSQLite3Database) => Promise<void>;
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
   * @param db The database instance
   */
  initialize: (app: FastifyInstance, db: BetterSQLite3Database) => Promise<void>;
  
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
