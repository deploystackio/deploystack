/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { type Plugin, type DatabaseExtension } from '../plugin-system/types';

// Config
import { getDatabaseConfig, validateDatabaseConfig, type DatabaseConfig } from './config';

// Schema Definitions
import { pluginTableDefinitions as inputPluginTableDefinitions } from './schema.sqlite';

// Drizzle imports for different database types
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import SqliteDriver from 'better-sqlite3';
import { createClient } from '@libsql/client';
import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';

// Types for database instances
 
export type AnyDatabase = BetterSQLite3Database<any> | any; // LibSQL instances
 
export type AnySchema = Record<string, any>;

// Global state
let dbInstance: AnyDatabase | null = null;
let dbSchema: AnySchema | null = null;
let dbConfig: DatabaseConfig | null = null;
let isDbInitialized = false;

const MIGRATIONS_TABLE_NAME = '__drizzle_migrations';

// Helper function to check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

function getColumnBuilder(type: 'text' | 'integer' | 'timestamp') {
  if (type === 'text') return sqliteText;
  if (type === 'integer') return sqliteInteger;
  if (type === 'timestamp') return sqliteInteger; // SQLite uses integer for timestamps
  throw new Error(`Unsupported column type ${type}`);
}

import * as staticSchema from './schema.sqlite';

function generateSchema(): AnySchema {
  const generatedSchema: AnySchema = { ...staticSchema };

  // Add plugin tables to the static schema
  for (const [tableName, tableColumns] of Object.entries(inputPluginTableDefinitions)) {
    const columns: Record<string, ReturnType<typeof tableColumns[keyof typeof tableColumns]>> = {};
    for (const [columnName, columnDefFunc] of Object.entries(tableColumns)) {
      let builderType: 'text' | 'integer' | 'timestamp' = 'text';
      if (columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
        builderType = 'timestamp';
      } else if (['id', 'count', 'age', 'quantity', 'order', 'status', 'number'].some(keyword => columnName.toLowerCase().includes(keyword))) {
        builderType = 'integer';
      }
      const builder = getColumnBuilder(builderType);
      columns[columnName] = columnDefFunc(builder);
    }
    generatedSchema[tableName] = sqliteTable(tableName, columns);
  }
  return generatedSchema;
}


/**
 * Create database instance based on configuration
 */
async function createDatabaseInstance(config: DatabaseConfig, schema: AnySchema, logger?: FastifyBaseLogger): Promise<AnyDatabase> {
  if (!isTestMode() && logger) {
    logger.info({
      operation: 'create_database_instance',
      databaseType: config.type
    }, `Creating database instance for ${config.type}`);
  }

  switch (config.type) {
    case 'sqlite': {
      const dbPath = path.resolve(process.cwd(), config.dbPath!);
      if (!isTestMode() && logger) {
        logger.info({
          operation: 'create_database_instance',
          databaseType: 'sqlite',
          dbPath
        }, `Creating SQLite connection to: ${dbPath}`);
      }
      const sqliteConn = new SqliteDriver(dbPath);
      const db = drizzleSqlite(sqliteConn, { schema });
      if (!isTestMode() && logger) {
        logger.info({
          operation: 'create_database_instance',
          databaseType: 'sqlite',
          clientType: typeof (db as any).$client
        }, `SQLite database instance created successfully`);
      }
      return db;
    }
    
    case 'turso': {
      if (!isTestMode() && logger) {
        logger.info({
          operation: 'create_database_instance',
          databaseType: 'turso',
          url: config.url,
          hasAuthToken: !!config.authToken
        }, `Creating Turso connection`);
      }
      
      // Create the libSQL client first
      const libsqlClient = createClient({
        url: config.url!,
        authToken: config.authToken!
      });
      
      if (!isTestMode() && logger) {
        logger.info({
          operation: 'create_database_instance',
          databaseType: 'turso',
          clientType: typeof libsqlClient,
          clientMethods: Object.getOwnPropertyNames(libsqlClient)
        }, `LibSQL client created`);
      }
      
      // Create the Drizzle instance with the libSQL client
      const db = drizzleLibSQL(libsqlClient, { schema });
      
      if (!isTestMode() && logger) {
        logger.info({
          operation: 'create_database_instance',
          databaseType: 'turso',
          drizzleType: typeof db,
          drizzleMethods: Object.getOwnPropertyNames(db),
          hasClient: '$client' in db,
          clientType: '$client' in db ? typeof (db as any).$client : 'undefined'
        }, `Turso database instance created successfully`);
      }
      
      return db;
    }
    
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

/**
 * Apply migrations for any database type
 */
async function applyMigrations(db: AnyDatabase, config: DatabaseConfig, logger: FastifyBaseLogger) {
  // Note: Migrations now run in test mode to ensure plugin tables are created

  const projectRootMigrationsDir = path.join(process.cwd(), 'drizzle');
  const migrationsPath = path.join(projectRootMigrationsDir, 'migrations_sqlite');

  try {
    await fs.access(migrationsPath);
  } catch {
    logger.info({
      operation: 'apply_migrations',
      migrationsPath
    }, `Migrations directory not found at: ${migrationsPath}, skipping migrations.`);
    return;
  }

  if (!isTestMode()) {
    logger.info({
      operation: 'apply_migrations',
      migrationsPath,
      databaseType: config.type
    }, `Checking for new migrations in ${migrationsPath}...`);
  }

  // Debug the database instance structure
  if (!isTestMode()) {
    logger.info({
      operation: 'apply_migrations',
      databaseType: config.type,
      dbType: typeof db,
      hasClient: '$client' in db,
      clientType: '$client' in db ? typeof (db as any).$client : 'undefined',
      dbMethods: Object.getOwnPropertyNames(db)
    }, `Database instance structure for migrations`);
  }

  // Ensure migrations table exists
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE NOT NULL,
      applied_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
    )
  `;

  try {
    if (config.type === 'sqlite') {
      // SQLite uses the better-sqlite3 client
      (db as any).$client.exec(createTableQuery);
    } else if (config.type === 'turso') {
      // Turso uses libSQL client - try different approaches
      if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
        // Use execute method for libSQL
        await (db as any).$client.execute(createTableQuery);
      } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
        // Use prepare/run for libSQL
        const prepared = (db as any).$client.prepare(createTableQuery);
        await prepared.run();
      } else {
        // Fallback: use Drizzle's run method
        await db.run(createTableQuery);
      }
    }
    
    if (!isTestMode()) {
      logger.info({
        operation: 'apply_migrations',
        databaseType: config.type
      }, `Migrations table created/verified`);
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error({
      operation: 'apply_migrations',
      databaseType: config.type,
      error: typedError,
      errorMessage: typedError.message
    }, `Failed to create migrations table`);
    throw error;
  }

  // Get applied migrations
  const selectAppliedQuery = `SELECT migration_name as name FROM ${MIGRATIONS_TABLE_NAME}`;
  let appliedMigrations: { name: string }[] = [];

  try {
    if (config.type === 'sqlite') {
      appliedMigrations = (db as any).$client.prepare(selectAppliedQuery).all();
    } else if (config.type === 'turso') {
      // Turso uses libSQL client
      if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
        const result = await (db as any).$client.execute(selectAppliedQuery);
        appliedMigrations = result.rows || [];
      } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
        const prepared = (db as any).$client.prepare(selectAppliedQuery);
        const result = await prepared.all();
        appliedMigrations = result || [];
      } else {
        // Fallback: use Drizzle's all method
        const result = await db.all(selectAppliedQuery);
        appliedMigrations = result || [];
      }
    }
    
    if (!isTestMode()) {
      logger.info({
        operation: 'apply_migrations',
        databaseType: config.type,
        appliedCount: appliedMigrations.length
      }, `Found ${appliedMigrations.length} applied migrations`);
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error({
      operation: 'apply_migrations',
      databaseType: config.type,
      error: typedError,
      errorMessage: typedError.message
    }, `Failed to query applied migrations`);
    throw error;
  }

  const appliedMigrationNames = appliedMigrations.map(row => {
    if (typeof row === 'object' && row !== null) {
      return (row as any).name || (row as any).migration_name;
    }
    return row;
  });

  const migrationFiles = (await fs.readdir(migrationsPath))
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    if (!appliedMigrationNames.includes(file)) {
      if (!isTestMode()) {
        logger.info({
          operation: 'apply_migrations',
          migrationFile: file,
          databaseType: config.type
        }, `Applying migration: ${file}`);
      }
      const migrationFilePath = path.join(migrationsPath, file);
      const sqlContent = await fs.readFile(migrationFilePath, 'utf8');
      const statements = sqlContent.split('--> statement-breakpoint');

      try {
        for (const statement of statements) {
          const trimmedStatement = statement.trim();
          if (trimmedStatement) {
            if (config.type === 'sqlite') {
              (db as any).$client.exec(trimmedStatement);
            } else if (config.type === 'turso') {
              // Turso uses libSQL client
              if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
                await (db as any).$client.execute(trimmedStatement);
              } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
                const prepared = (db as any).$client.prepare(trimmedStatement);
                await prepared.run();
              } else {
                // Fallback: use Drizzle's run method
                await db.run(trimmedStatement);
              }
            }
          }
        }
        
        // Record the migration as applied
        const insertMigrationQuery = `INSERT INTO ${MIGRATIONS_TABLE_NAME} (migration_name) VALUES (?)`;
        if (config.type === 'sqlite') {
          (db as any).$client.prepare(insertMigrationQuery).run(file);
        } else if (config.type === 'turso') {
          // Turso uses libSQL client
          if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
            await (db as any).$client.execute(insertMigrationQuery, [file]);
          } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
            const prepared = (db as any).$client.prepare(insertMigrationQuery);
            await prepared.run([file]);
          } else {
            // Fallback: use Drizzle's run method
            await db.run(insertMigrationQuery, [file]);
          }
        }
        
        if (!isTestMode()) {
          logger.info({
            operation: 'apply_migrations',
            migrationFile: file,
            databaseType: config.type
          }, `Applied migration: ${file}`);
        }
      } catch (error) {
        const typedError = error as Error;
        logger.error({
          operation: 'apply_migrations',
          migrationFile: file,
          databaseType: config.type,
          error: typedError,
          errorMessage: typedError.message
        }, `Failed to apply migration ${file}`);
        throw error;
      }
    } else {
      if (!isTestMode()) {
        logger.debug({
          operation: 'apply_migrations',
          migrationFile: file,
          databaseType: config.type
        }, `Migration already applied: ${file}`);
      }
    }
  }
}

/**
 * Initialize database
 */
export async function initializeDatabase(logger: FastifyBaseLogger): Promise<boolean> {
  if (isDbInitialized) {
    logger.info({
      operation: 'initialize_database'
    }, 'Database already initialized.');
    return true;
  }

  try {
    dbConfig = getDatabaseConfig(logger);
    
    if (!validateDatabaseConfig(dbConfig)) {
      logger.error({
        operation: 'initialize_database',
        error: 'Invalid database configuration'
      }, 'Invalid database configuration');
      return false;
    }

    dbSchema = generateSchema();
    
    // Ensure directory exists for SQLite
    if (dbConfig.type === 'sqlite') {
      const dbDir = path.dirname(path.resolve(process.cwd(), dbConfig.dbPath!));
      await fs.mkdir(dbDir, { recursive: true });
    }

    dbInstance = await createDatabaseInstance(dbConfig, dbSchema, logger);
    
    if (!isTestMode()) {
      logger.info({
        operation: 'initialize_database',
        databaseType: dbConfig.type
      }, `Connected to ${dbConfig.type} database`);
    }

    // Apply migrations
    await applyMigrations(dbInstance, dbConfig, logger);
    
    isDbInitialized = true;
    if (!isTestMode()) {
      logger.info({
        operation: 'initialize_database'
      }, 'Database initialized successfully.');
    }
    return true;
    
  } catch (error) {
    const typedError = error as Error;
    if (typedError.message.includes('No database selection found')) {
      logger.info({
        operation: 'initialize_database'
      }, 'No database configured yet. Please use the /api/db/setup endpoint to configure your database.');
    } else {
      logger.error({
        operation: 'initialize_database',
        error: typedError,
        errorMessage: typedError.message
      }, 'Failed to initialize database');
    }
    return false;
  }
}

/**
 * Get database instance
 */
export function getDb(): AnyDatabase {
  if (!dbInstance || !isDbInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

/**
 * Get database schema
 */
export function getSchema(): AnySchema {
  if (!dbSchema || !isDbInitialized) {
    throw new Error('Database schema not generated. Call initializeDatabase() first.');
  }
  return dbSchema;
}

/**
 * Get database status
 */
export function getDbStatus() {
  try {
    if (!dbConfig) {
      // Try to get config to see if one exists
      const config = getDatabaseConfig();
      if (config) {
        return {
          configured: validateDatabaseConfig(config),
          initialized: isDbInitialized,
          dialect: config.type,
          type: config.type
        };
      }
    }
    
    if (!dbConfig) {
      return {
        configured: false,
        initialized: false,
        dialect: null,
        type: null
      };
    }
    
    return {
      configured: validateDatabaseConfig(dbConfig),
      initialized: isDbInitialized,
      dialect: dbConfig.type,
      type: dbConfig.type
    };
  } catch {
    return {
      configured: false,
      initialized: false,
      dialect: null,
      type: null
    };
  }
}

/**
 * Reset database state (for testing)
 */
export function resetDatabaseState() {
  dbInstance = null;
  dbSchema = null;
  dbConfig = null;
  isDbInitialized = false;
}

/**
 * Helper function to safely execute database operations
 */
export function executeDbOperation<T>(
   
  operation: (db: any, schema: any) => Promise<T> | T
): Promise<T> | T {
  const db = getDb();
  const schema = getSchema();
  return operation(db, schema);
}

// Plugin system functions
interface DatabaseExtensionWithTables extends DatabaseExtension {
   
  tableDefinitions?: Record<string, Record<string, (columnBuilder: any) => any>>;
  onDatabaseInit?: (db: AnyDatabase, schema: AnySchema, logger: FastifyBaseLogger) => Promise<void>;
}

export function registerPluginTables(plugins: Plugin[], logger?: FastifyBaseLogger) {
  const dbPlugins = plugins.filter(plugin => plugin.databaseExtension);
  for (const plugin of dbPlugins) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables | undefined;
    if (!ext || !ext.tableDefinitions) continue;
    
    for (const [defName, definition] of Object.entries(ext.tableDefinitions)) {
      inputPluginTableDefinitions[`${plugin.meta.id}_${defName}`] = definition;
    }
  }
  if (isDbInitialized) {
    if (logger && !isTestMode()) {
      logger.warn({
        operation: 'register_plugin_tables'
      }, "Plugins registered after DB initialization. Schema may be stale. Consider restarting.");
    }
  }
}

export async function createPluginTables(plugins: Plugin[], logger: FastifyBaseLogger) {
  if (!dbInstance || !isDbInitialized) {
    logger.warn({
      operation: 'create_plugin_tables'
    }, 'Database not initialized, skipping plugin table creation.');
    return;
  }

  const pluginsWithTables = plugins.filter(plugin => 
    plugin.databaseExtension && plugin.databaseExtension.tableDefinitions
  );

  if (pluginsWithTables.length === 0) {
    logger.info({
      operation: 'create_plugin_tables'
    }, 'No plugins with table definitions found.');
    return;
  }

  logger.info({
    operation: 'create_plugin_tables',
    pluginCount: pluginsWithTables.length
  }, `Creating tables for ${pluginsWithTables.length} plugins...`);

  for (const plugin of pluginsWithTables) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables;
    if (!ext.tableDefinitions) continue;

    for (const [tableName, columnDefs] of Object.entries(ext.tableDefinitions)) {
      const fullTableName = `${plugin.meta.id}_${tableName}`;
      
      try {
        // Generate CREATE TABLE SQL dynamically
        const createTableSQL = generateCreateTableSQL(fullTableName, columnDefs);
        
        logger.debug({
          operation: 'create_plugin_tables',
          pluginId: plugin.meta.id,
          tableName: fullTableName,
          sql: createTableSQL
        }, `Creating plugin table: ${fullTableName}`);

        // Drop the table first to ensure clean recreation (for development)
        const dropTableSQL = `DROP TABLE IF EXISTS "${fullTableName}"`;
        
        logger.debug({
          operation: 'create_plugin_tables',
          pluginId: plugin.meta.id,
          tableName: fullTableName,
          sql: dropTableSQL
        }, `Dropping existing plugin table: ${fullTableName}`);

        // Execute the DROP TABLE statement
        if (dbConfig?.type === 'sqlite') {
          (dbInstance as any).$client.exec(dropTableSQL);
        } else if (dbConfig?.type === 'turso') {
          if ((dbInstance as any).$client && typeof (dbInstance as any).$client.execute === 'function') {
            await (dbInstance as any).$client.execute(dropTableSQL);
          } else {
            await dbInstance.run(dropTableSQL);
          }
        }

        // Execute the CREATE TABLE statement
        if (dbConfig?.type === 'sqlite') {
          (dbInstance as any).$client.exec(createTableSQL);
        } else if (dbConfig?.type === 'turso') {
          if ((dbInstance as any).$client && typeof (dbInstance as any).$client.execute === 'function') {
            await (dbInstance as any).$client.execute(createTableSQL);
          } else {
            await dbInstance.run(createTableSQL);
          }
        }

        logger.info({
          operation: 'create_plugin_tables',
          pluginId: plugin.meta.id,
          tableName: fullTableName
        }, `✅ Created plugin table: ${fullTableName}`);

      } catch (error) {
        const typedError = error as Error;
        // Check if table already exists (not an error)
        if (typedError.message.includes('already exists') || typedError.message.includes('table') && typedError.message.includes('already')) {
          logger.debug({
            operation: 'create_plugin_tables',
            pluginId: plugin.meta.id,
            tableName: fullTableName
          }, `Table ${fullTableName} already exists, skipping.`);
        } else {
          logger.error({
            operation: 'create_plugin_tables',
            pluginId: plugin.meta.id,
            tableName: fullTableName,
            error: typedError,
            message: typedError.message
          }, `❌ Failed to create plugin table: ${fullTableName}`);
          throw error;
        }
      }
    }
  }

  logger.info({
    operation: 'create_plugin_tables'
  }, '✅ Plugin table creation completed.');
}

/**
 * Generate CREATE TABLE SQL from plugin table definitions
 */
function generateCreateTableSQL(tableName: string, columnDefs: Record<string, (columnBuilder: any) => any>): string {
  const columns: string[] = [];
  
  for (const [columnName, columnDefFunc] of Object.entries(columnDefs)) {
    // Create a mock column builder to extract column definition
    const mockBuilder = createMockColumnBuilder();
    const columnDef = columnDefFunc(mockBuilder);
    
    // Convert the column definition to SQL
    const sqlColumn = convertColumnDefToSQL(columnName, columnDef);
    columns.push(sqlColumn);
  }
  
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columns.join(',\n  ')}\n)`;
}

/**
 * Create a mock column builder that captures column definition details
 */
function createMockColumnBuilder() {
  const createColumn = (type: string) => {
    const column = {
      type,
      isPrimaryKey: false,
      isNotNull: false,
      isUnique: false,
      defaultValue: undefined as any,
      references: undefined as any,
    };

    return {
      ...column,
      primaryKey() {
        column.isPrimaryKey = true;
        return this;
      },
      
      notNull() {
        column.isNotNull = true;
        return this;
      },
      
      unique() {
        column.isUnique = true;
        return this;
      },
      
      default(value: any) {
        column.defaultValue = value;
        return this;
      },
      
      defaultNow() {
        column.defaultValue = "strftime('%s', 'now')";
        return this;
      },
      
      references(ref: any) {
        column.references = ref;
        return this;
      }
    };
  };

  return (columnName: string, options?: any) => {
    // Determine column type based on name patterns and options
    let type = 'TEXT';
    
    if (options?.mode === 'timestamp' || columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
      type = 'INTEGER'; // SQLite uses INTEGER for timestamps
    } else if (columnName.toLowerCase().includes('id') || columnName.toLowerCase().includes('count') || 
               columnName.toLowerCase().includes('age') || columnName.toLowerCase().includes('quantity') ||
               columnName.toLowerCase().includes('order') || columnName.toLowerCase().includes('number')) {
      type = 'INTEGER';
    }
    
    const column = createColumn(type);
    
    // For timestamp columns with mode, automatically set default if not already set
    if (options?.mode === 'timestamp' && !column.defaultValue) {
      column.defaultValue = "strftime('%s', 'now')";
    }
    
    return column;
  };
}

/**
 * Convert column definition object to SQL string
 */
function convertColumnDefToSQL(columnName: string, columnDef: any): string {
  let sql = `"${columnName}" ${columnDef.type}`;
  
  if (columnDef.isPrimaryKey) {
    sql += ' PRIMARY KEY';
  }
  
  if (columnDef.isNotNull) {
    sql += ' NOT NULL';
  }
  
  if (columnDef.isUnique) {
    sql += ' UNIQUE';
  }
  
  if (columnDef.defaultValue !== undefined) {
    if (typeof columnDef.defaultValue === 'string' && columnDef.defaultValue.includes('strftime')) {
      sql += ` DEFAULT (${columnDef.defaultValue})`;
    } else if (typeof columnDef.defaultValue === 'string') {
      sql += ` DEFAULT '${columnDef.defaultValue}'`;
    } else if (typeof columnDef.defaultValue === 'boolean') {
      sql += ` DEFAULT ${columnDef.defaultValue ? 1 : 0}`;
    } else {
      sql += ` DEFAULT ${columnDef.defaultValue}`;
    }
  }
  
  return sql;
}

export async function initializePluginDatabases(db: AnyDatabase, plugins: Plugin[], logger: FastifyBaseLogger) {
  for (const plugin of plugins) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables | undefined;
    if (ext?.onDatabaseInit) {
      if (!isTestMode()) {
        logger.info({
          operation: 'initialize_plugin_databases',
          pluginId: plugin.meta.id
        }, `Initializing database for plugin: ${plugin.meta.id}`);
      }
      try {
        // Create a child logger for this plugin
        const pluginLogger = logger.child({ pluginId: plugin.meta.id });
        // Get the current schema - use dbSchema directly if available, otherwise generate one
        let schema: AnySchema;
        try {
          schema = getSchema();
        } catch {
          // If getSchema fails, generate a basic schema for the plugin
          schema = generateSchema();
        }
        await ext.onDatabaseInit(db, schema, pluginLogger);
        if (!isTestMode()) {
          logger.info({
            operation: 'initialize_plugin_databases',
            pluginId: plugin.meta.id
          }, `✅ Plugin ${plugin.meta.id} database initialization completed successfully`);
        }
      } catch (error) {
        logger.error({
          operation: 'initialize_plugin_databases',
          pluginId: plugin.meta.id,
          error: error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        }, `❌ Plugin ${plugin.meta.id} database initialization failed`);
        throw error; // Re-throw to propagate the error
      }
    }
  }
}
