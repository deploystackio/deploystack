/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { type Plugin, type DatabaseExtension } from '../plugin-system/types';

// Config
import { getDatabaseConfig, validateDatabaseConfig, type DatabaseConfig } from './config';

// Schema - single source of truth (PostgreSQL only)
export * from './schema';
import * as schema from './schema';
import { pluginTableDefinitions } from './schema';

// Drizzle imports for PostgreSQL
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Types for database instances (PostgreSQL only)
export type AnyDatabase = ReturnType<typeof drizzle>;
export type AnySchema = typeof schema;

// Global state
let dbInstance: AnyDatabase | null = null;
let dbConfig: DatabaseConfig | null = null;
let isDbInitialized = false;

const MIGRATIONS_TABLE_NAME = '__drizzle_migrations';

// Helper function to check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Split SQL content into individual statements for better compatibility
 */
function splitSQLStatements(sqlContent: string): string[] {
  // First split by the statement breakpoint marker
  const sections = sqlContent.split('--> statement-breakpoint');
  const statements: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Further split by semicolons to ensure each statement is separate
    const subStatements = trimmed.split(';');

    for (const subStatement of subStatements) {
      const cleanStatement = subStatement.trim();
      if (cleanStatement) {
        // Add semicolon back if it was removed by split
        statements.push(cleanStatement + ';');
      }
    }
  }

  return statements;
}

/**
 * Create PostgreSQL database instance
 */
async function createDatabaseInstance(config: DatabaseConfig, logger?: FastifyBaseLogger): Promise<AnyDatabase> {
  if (config.type !== 'postgresql') {
    throw new Error(`Unsupported database type: ${config.type}. Only PostgreSQL is supported.`);
  }

  if (!isTestMode() && logger) {
    logger.info({
      operation: 'create_database_instance',
      databaseType: 'postgresql',
      host: config.host,
      port: config.port,
      database: config.database
    }, `Creating PostgreSQL connection`);
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    host: config.host!,
    port: config.port!,
    database: config.database!,
    user: config.user!,
    password: config.password!,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });

  // Create the Drizzle instance with the PostgreSQL pool
  const db = drizzle(pool, { schema });

  if (!isTestMode() && logger) {
    logger.info({
      operation: 'create_database_instance',
      databaseType: 'postgresql',
      clientType: typeof pool
    }, `PostgreSQL database instance created successfully`);
  }

  return db;
}

/**
 * Apply migrations for PostgreSQL
 */
async function applyMigrations(db: AnyDatabase, config: DatabaseConfig, logger: FastifyBaseLogger) {
  if (config.type !== 'postgresql') {
    throw new Error('Only PostgreSQL migrations are supported');
  }

  const migrationsPath = path.join(process.cwd(), 'drizzle', 'migrations');

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
      migrationsPath
    }, `Checking for new migrations in ${migrationsPath}...`);
  }

  // Ensure migrations table exists
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
      id SERIAL PRIMARY KEY,
      migration_name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `;

  try {
    await (db as any).$client.query(createTableQuery);

    if (!isTestMode()) {
      logger.info({
        operation: 'apply_migrations'
      }, `Migrations table created/verified`);
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error({
      operation: 'apply_migrations',
      error: typedError,
      errorMessage: typedError.message
    }, `Failed to create migrations table`);
    throw error;
  }

  // Get applied migrations
  const selectAppliedQuery = `SELECT migration_name as name FROM ${MIGRATIONS_TABLE_NAME}`;
  let appliedMigrations: { name: string }[] = [];

  try {
    const result = await (db as any).$client.query(selectAppliedQuery);
    appliedMigrations = result.rows || [];

    if (!isTestMode()) {
      logger.info({
        operation: 'apply_migrations',
        appliedCount: appliedMigrations.length
      }, `Found ${appliedMigrations.length} applied migrations`);
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error({
      operation: 'apply_migrations',
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
          migrationFile: file
        }, `Applying migration: ${file}`);
      }
      const migrationFilePath = path.join(migrationsPath, file);
      const sqlContent = await fs.readFile(migrationFilePath, 'utf8');

      // Split SQL statements for better execution
      const statements = splitSQLStatements(sqlContent);

      try {
        let statementCount = 0;
        for (const statement of statements) {
          const trimmedStatement = statement.trim();
          if (trimmedStatement) {
            statementCount++;

            if (!isTestMode()) {
              logger.debug({
                operation: 'apply_migrations',
                migrationFile: file,
                statementNumber: statementCount,
                statementPreview: trimmedStatement.substring(0, 100) + (trimmedStatement.length > 100 ? '...' : '')
              }, `Executing statement ${statementCount}`);
            }

            try {
              await (db as any).$client.query(trimmedStatement);
            } catch (stmtError: any) {
              logger.error({
                operation: 'apply_migrations',
                migrationFile: file,
                statementNumber: statementCount,
                statement: trimmedStatement,
                error: stmtError,
                errorMessage: stmtError.message
              }, `Failed to execute statement ${statementCount}`);
              throw stmtError;
            }
          }
        }

        if (!isTestMode()) {
          logger.info({
            operation: 'apply_migrations',
            migrationFile: file,
            statementCount
          }, `Successfully executed ${statementCount} statements from migration`);
        }

        // Record the migration as applied
        const insertMigrationQuery = `INSERT INTO ${MIGRATIONS_TABLE_NAME} (migration_name) VALUES ($1)`;
        await (db as any).$client.query(insertMigrationQuery, [file]);

        if (!isTestMode()) {
          logger.info({
            operation: 'apply_migrations',
            migrationFile: file
          }, `Applied migration: ${file}`);
        }
      } catch (error) {
        const typedError = error as Error;
        logger.error({
          operation: 'apply_migrations',
          migrationFile: file,
          error: typedError,
          errorMessage: typedError.message
        }, `Failed to apply migration ${file}`);
        throw error;
      }
    } else {
      if (!isTestMode()) {
        logger.debug({
          operation: 'apply_migrations',
          migrationFile: file
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

    if (dbConfig.type !== 'postgresql') {
      logger.error({
        operation: 'initialize_database',
        error: `Unsupported database type: ${dbConfig.type}`
      }, 'Only PostgreSQL is supported');
      return false;
    }

    dbInstance = await createDatabaseInstance(dbConfig, logger);

    if (!isTestMode()) {
      logger.info({
        operation: 'initialize_database'
      }, `Connected to PostgreSQL database`);
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
 * Create a safe database proxy that handles operations gracefully during startup
 */
function createSafeDbProxy(): AnyDatabase {
  const handler = {
    get(target: any, prop: string) {
      // Allow basic property access for type checking
      if (prop === 'constructor' || prop === 'toString' || prop === 'valueOf') {
        return target[prop];
      }

      // For any database operation, throw a more descriptive error
      return () => {
        throw new Error('Database not available. Please complete the setup process at /setup first.');
      };
    }
  };

  // Create a minimal proxy object that looks like a database but safely handles calls
  const mockDb = {
    select: () => { throw new Error('Database not available. Please complete the setup process at /setup first.'); },
    insert: () => { throw new Error('Database not available. Please complete the setup process at /setup first.'); },
    update: () => { throw new Error('Database not available. Please complete the setup process at /setup first.'); },
    delete: () => { throw new Error('Database not available. Please complete the setup process at /setup first.'); },
    $client: null
  };

  return new Proxy(mockDb, handler) as AnyDatabase;
}

/**
 * Get database instance with graceful startup handling
 */
export function getDb(): AnyDatabase {
  if (!dbInstance || !isDbInitialized) {
    // During startup, return a safe proxy instead of throwing immediately
    // This allows the server to start and routes to be registered
    return createSafeDbProxy();
  }
  return dbInstance;
}

/**
 * Get database schema (PostgreSQL only)
 * Returns the schema directly since we no longer need dynamic selection
 */
export function getSchema(): AnySchema {
  return schema;
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
          dialect: 'postgresql',
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
      dialect: 'postgresql',
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
  dbConfig = null;
  isDbInitialized = false;
}

/**
 * Helper function to safely execute database operations
 */
export function executeDbOperation<T>(
  operation: (db: AnyDatabase) => Promise<T> | T
): Promise<T> | T {
  const db = getDb();
  return operation(db);
}

// Import plugin migration functionality
import { createPluginTables as createPluginTablesImpl } from './plugin-migrations';

// Plugin system functions
interface DatabaseExtensionWithTables extends DatabaseExtension {
  tableDefinitions?: Record<string, Record<string, (columnBuilder: any) => any>>;
  onDatabaseInit?: (db: AnyDatabase, logger: FastifyBaseLogger) => Promise<void>;
}

export function registerPluginTables(plugins: Plugin[], logger?: FastifyBaseLogger) {
  const dbPlugins = plugins.filter(plugin => plugin.databaseExtension);
  for (const plugin of dbPlugins) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables | undefined;
    if (!ext || !ext.tableDefinitions) continue;

    for (const [defName, definition] of Object.entries(ext.tableDefinitions)) {
      pluginTableDefinitions[`${plugin.meta.id}_${defName}`] = definition;
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
  if (!dbInstance || !isDbInitialized || !dbConfig) {
    logger.warn({
      operation: 'create_plugin_tables'
    }, 'Database not initialized, skipping plugin table creation.');
    return;
  }

  // Use the extracted plugin migration functionality
  await createPluginTablesImpl(plugins, dbInstance, dbConfig, logger);
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
        await ext.onDatabaseInit(db, pluginLogger);
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
