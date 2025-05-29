import fs from 'node:fs/promises';
import path from 'node:path';
import { type Plugin, type DatabaseExtension } from '../plugin-system/types'; // Added DatabaseExtension

// Config
import { getDbConfig, saveDbConfig, type DbConfig, type SQLiteConfig, type PostgresConfig } from './config';

// Schema Definitions
import { baseTableDefinitions, pluginTableDefinitions as inputPluginTableDefinitions, authTypeEnumValues } from './schema';

// Drizzle SQLite
import { drizzle as drizzleSqliteAdapter, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import SqliteDriver from 'better-sqlite3'; // Default import is the constructor
import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';

// Drizzle PostgreSQL
import { drizzle as drizzlePgAdapter, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import { pgTable, text as pgText, integer as pgInteger, timestamp as pgTimestamp, pgEnum } from 'drizzle-orm/pg-core';

// Types for Drizzle instance and schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDatabase = BetterSQLite3Database<any> | NodePgDatabase<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = Record<string, any>; // Represents the schema object Drizzle uses

// Global state for database instance and schema
let dbInstance: AnyDatabase | null = null;
let dbSchema: AnySchema | null = null;
let dbConnection: SqliteDriver.Database | PgPool | null = null; // Correct type for better-sqlite3 instance
let currentDbConfig: DbConfig | null = null;
let isDbInitialized = false;
let isDbConfigured = false;

// const MIGRATIONS_DIR_NAME = 'migrations'; // This is now dialect-specific
const MIGRATIONS_TABLE_NAME = '__drizzle_migrations';


function getColumnBuilder(dialect: 'sqlite' | 'postgres', type: 'text' | 'integer' | 'timestamp') {
  if (dialect === 'sqlite') {
    if (type === 'text') return sqliteText;
    if (type === 'integer') return sqliteInteger;
    if (type === 'timestamp') return sqliteInteger; 
  } else { // postgres
    if (type === 'text') return pgText;
    if (type === 'integer') return pgInteger;
    if (type === 'timestamp') return pgTimestamp;
  }
  throw new Error(`Unsupported column type ${type} for dialect ${dialect}`);
}

function generateSchema(dialect: 'sqlite' | 'postgres'): AnySchema {
  const generatedSchema: AnySchema = {};

  // Create enum for PostgreSQL auth_type
  let authTypeEnum: any = null;
  if (dialect === 'postgres') {
    authTypeEnum = pgEnum('auth_type', authTypeEnumValues);
  }

  for (const [tableName, tableColumns] of Object.entries(baseTableDefinitions)) {
    const columns: Record<string, ReturnType<typeof tableColumns[keyof typeof tableColumns]>> = {};
    for (const [columnName, columnDefFunc] of Object.entries(tableColumns)) {
      let builderType: 'text' | 'integer' | 'timestamp' = 'text';
      
      // Special handling for specific columns
      if (columnName === 'id') {
        builderType = 'text'; // All IDs are text (Lucia uses string IDs)
      } else if (columnName === 'expires_at') {
        builderType = 'integer'; // Lucia uses number for expires_at
      } else if (columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
        builderType = 'timestamp';
      } else if (['count', 'age', 'quantity', 'order', 'status', 'number'].some(keyword => columnName.toLowerCase().includes(keyword)) && !columnName.toLowerCase().includes('text')) {
        builderType = 'integer';
      }
      
      const builder = getColumnBuilder(dialect, builderType);
      
      // Special handling for auth_type enum
      if (columnName === 'auth_type' && tableName === 'authUser') {
        if (dialect === 'postgres' && authTypeEnum) {
          columns[columnName] = authTypeEnum('auth_type').notNull();
        } else {
          columns[columnName] = columnDefFunc(builder);
        }
      } else {
        columns[columnName] = columnDefFunc(builder);
      }
    }
    generatedSchema[tableName] = dialect === 'sqlite' ? sqliteTable(tableName, columns) : pgTable(tableName, columns);
  }

  for (const [tableName, tableColumns] of Object.entries(inputPluginTableDefinitions)) {
    const columns: Record<string, ReturnType<typeof tableColumns[keyof typeof tableColumns]>> = {};
     for (const [columnName, columnDefFunc] of Object.entries(tableColumns)) {
      let builderType: 'text' | 'integer' | 'timestamp' = 'text';
       if (columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
        builderType = 'timestamp';
      } else if (['id', 'count', 'age', 'quantity', 'order', 'status', 'number'].some(keyword => columnName.toLowerCase().includes(keyword))) {
        builderType = 'integer';
      }
      const builder = getColumnBuilder(dialect, builderType);
      columns[columnName] = columnDefFunc(builder);
    }
    generatedSchema[tableName] = dialect === 'sqlite' ? sqliteTable(tableName, columns) : pgTable(tableName, columns);
  }
  return generatedSchema;
}


async function ensureMigrationsTable(_db: AnyDatabase, dialect: 'sqlite' | 'postgres') { // db param not used due to raw exec
  const idColumnType = dialect === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
  const nameColumnType = 'TEXT UNIQUE';
  const appliedAtType = dialect === 'sqlite' ? `INTEGER DEFAULT (strftime('%s', 'now'))` : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';

  // Use string directly for raw execution
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
      id ${idColumnType},
      migration_name ${nameColumnType} NOT NULL,
      applied_at ${appliedAtType} NOT NULL
    )
  `;
  
  if (dialect === 'sqlite') {
    (dbConnection as SqliteDriver.Database).exec(createTableQuery);
  } else {
    await (dbConnection as PgPool).query(createTableQuery);
  }
}

async function applyMigrations(db: AnyDatabase, dialect: 'sqlite' | 'postgres') {
  const projectRootMigrationsDir = path.join(process.cwd(), 'drizzle');

  // fs.stat is async with fs/promises, so await it or use fs.existsSync
  try {
    await fs.stat(projectRootMigrationsDir); // Check if 'services/backend/drizzle' exists
  } catch {
     // This might be too noisy if the directory simply doesn't exist yet.
     // console.warn(`[WARN] Base Drizzle directory not found at: ${projectRootMigrationsDir}.`);
  }
  
  const dialectMigrationsSubDir = dialect === 'sqlite' ? 'migrations_sqlite' : 'migrations_pg';
  const migrationsPath = path.join(projectRootMigrationsDir, dialectMigrationsSubDir);

  try {
    await fs.access(migrationsPath);
  } catch {
    console.log(`[INFO] Migrations directory not found at: ${migrationsPath}, skipping migrations.`);
    return;
  }

  console.log(`[INFO] Checking for new migrations in ${migrationsPath}...`);
  await ensureMigrationsTable(db, dialect);

  let appliedMigrations: { name: string }[] = [];
  const selectAppliedQuery = `SELECT migration_name as name FROM ${MIGRATIONS_TABLE_NAME}`;

  if (dialect === 'sqlite') {
    appliedMigrations = (dbConnection as SqliteDriver.Database).prepare(selectAppliedQuery).all() as {name: string}[];
  } else {
    const result = await (dbConnection as PgPool).query(selectAppliedQuery);
    appliedMigrations = result.rows as {name: string}[];
  }
  const appliedMigrationNames = appliedMigrations.map(row => row.name);

  const migrationFiles = (await fs.readdir(migrationsPath))
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    if (!appliedMigrationNames.includes(file)) {
      console.log(`[INFO] Applying migration: ${file}`);
      const migrationFilePath = path.join(migrationsPath, file);
      const sqlContent = await fs.readFile(migrationFilePath, 'utf8');
      const statements = sqlContent.split('--> statement-breakpoint');

      try {
        if (dialect === 'sqlite') {
          const sqliteConn = dbConnection as SqliteDriver.Database;
          sqliteConn.exec('BEGIN');
          for (const statement of statements) {
            const trimmedStatement = statement.trim();
            if (trimmedStatement) sqliteConn.exec(trimmedStatement);
          }
          sqliteConn.prepare(`INSERT INTO ${MIGRATIONS_TABLE_NAME} (migration_name) VALUES (?)`).run(file);
          sqliteConn.exec('COMMIT');
        } else { 
          const pgConn = dbConnection as PgPool;
          const client = await pgConn.connect();
          try {
            await client.query('BEGIN');
            for (const statement of statements) {
              const trimmedStatement = statement.trim();
              if (trimmedStatement) await client.query(trimmedStatement);
            }
            await client.query(`INSERT INTO ${MIGRATIONS_TABLE_NAME} (migration_name) VALUES ($1)`, [file]);
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          } finally {
            client.release();
          }
        }
        console.log(`[INFO] Applied migration: ${file}`);
      } catch (error) {
        const typedError = error as Error;
        console.error(`[ERROR] Failed to apply migration ${file}:`, typedError.message, typedError.stack);
        throw error;
      }
    } else {
      console.log(`[INFO] Migration already applied: ${file}`);
    }
  }
}

export async function initializeDatabase(): Promise<boolean> {
  if (isDbInitialized) {
    console.log('[INFO] Database already initialized.');
    return true;
  }

  currentDbConfig = await getDbConfig();
  if (!currentDbConfig) {
    console.warn('[WARN] Database not configured. API setup required.');
    isDbConfigured = false;
    return false;
  }
  isDbConfigured = true;

  const dialect = currentDbConfig.type;
  dbSchema = generateSchema(dialect);

  let dbExists = false;

  if (dialect === 'sqlite') {
    const sqliteConfig = currentDbConfig as SQLiteConfig;
    // process.cwd() is .../services/backend due to the npm script `cd services/backend && ...`
    // sqliteConfig.dbPath is 'persistent_data/database/deploystack.db'
    // So, this correctly resolves to .../services/backend/persistent_data/database/deploystack.db
    const absoluteDbPath = path.join(process.cwd(), sqliteConfig.dbPath);
    const dbDir = path.dirname(absoluteDbPath);
    await fs.mkdir(dbDir, { recursive: true });
    
    try {
        await fs.access(absoluteDbPath);
        dbExists = true;
    } catch {
        dbExists = false;
    }

    const sqliteConn = new SqliteDriver(absoluteDbPath); // Use constructor
    dbConnection = sqliteConn;
    dbInstance = drizzleSqliteAdapter(sqliteConn, { schema: dbSchema, logger: false });
    console.log(`[INFO] Connected to SQLite database at: ${absoluteDbPath}`);
    if (!dbExists) console.log(`[INFO] SQLite database created at: ${absoluteDbPath}`);

  } else { 
    const pgConfig = currentDbConfig as PostgresConfig;
    const pool = new PgPool({ connectionString: pgConfig.connectionString });
    try {
      const client = await pool.connect();
      console.log('[INFO] Successfully connected to PostgreSQL.');
      client.release();
      dbExists = true; 
    } catch (error) {
        const typedError = error as Error;
        console.error('[ERROR] Failed to connect to PostgreSQL:', typedError.message);
        throw new Error(`Failed to connect to PostgreSQL: ${typedError.message}`);
    }
    dbConnection = pool;
    dbInstance = drizzlePgAdapter(pool, { schema: dbSchema, logger: false });
  }

  if (dbInstance) { // Ensure dbInstance is not null
    await applyMigrations(dbInstance, dialect);
  } else {
    throw new Error("Database instance could not be created.");
  }
  
  isDbInitialized = true;
  console.log('[INFO] Database initialized successfully.');
  return true;
}

export async function setupNewDatabase(config: DbConfig): Promise<boolean> {
  if (isDbConfigured && isDbInitialized) {
    console.warn('[WARN] Database is already configured and initialized.');
    return true;
  }
  if (isDbConfigured && !isDbInitialized) {
     console.warn('[WARN] Database is configured but not initialized. Attempting initialization.');
  } else {
    await saveDbConfig(config);
    currentDbConfig = config; 
    isDbConfigured = true;
    console.log(`[INFO] Database configuration saved: ${config.type}`);
  }
  
  isDbInitialized = false; 
  dbInstance = null;
  dbSchema = null;
  if (dbConnection) {
    // Check type before calling close/end
    if (currentDbConfig?.type === 'sqlite' && 'close' in dbConnection) {
       (dbConnection as SqliteDriver.Database).close();
    } else if (currentDbConfig?.type === 'postgres' && 'end' in dbConnection) {
      await (dbConnection as PgPool).end();
    }
    dbConnection = null;
  }

  return initializeDatabase();
}


export function getDb(): AnyDatabase {
  if (!dbInstance || !isDbInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase() first or ensure setup is complete.');
  }
  return dbInstance;
}

export function getSchema(): AnySchema {
  if (!dbSchema || !isDbInitialized) {
    throw new Error('Database schema not generated. Call initializeDatabase() first.');
  }
  return dbSchema;
}

// Helper function to safely execute database operations with proper typing
export function executeDbOperation<T>(
  operation: (db: any, schema: any) => Promise<T> | T
): Promise<T> | T {
  const db = getDb();
  const schema = getSchema();
  return operation(db, schema);
}

export function getDbConnection(): SqliteDriver.Database | PgPool { // Corrected return type
   if (!dbConnection || !isDbInitialized) {
    throw new Error('Database connection not established. Call initializeDatabase() first.');
  }
  return dbConnection;
}

export function getDbStatus() {
    return {
        configured: isDbConfigured,
        initialized: isDbInitialized,
        dialect: currentDbConfig?.type || null,
    };
}

// Define a more specific type for DatabaseExtension if possible, or use 'any' for now.
interface DatabaseExtensionWithTables extends DatabaseExtension {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tableDefinitions?: Record<string, Record<string, (columnBuilder: any) => any>>;
    onDatabaseInit?: (db: AnyDatabase) => Promise<void>; // Ensure onDatabaseInit accepts AnyDatabase
}

export function registerPluginTables(plugins: Plugin[]) {
  const dbPlugins = plugins.filter(plugin => plugin.databaseExtension);
  for (const plugin of dbPlugins) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables | undefined; // Cast here
    if (!ext || !ext.tableDefinitions) continue;
    
    for (const [defName, definition] of Object.entries(ext.tableDefinitions)) {
        inputPluginTableDefinitions[`${plugin.meta.id}_${defName}`] = definition;
    }
  }
  if (isDbInitialized) {
      console.warn("[WARN] Plugins registered after DB initialization. Schema may be stale. Consider restarting.")
  }
}

export async function createPluginTables(_db: AnyDatabase, plugins: Plugin[]) { // db param not used
  console.log('[INFO] Attempting to create plugin tables (Note: Better handled by migrations)...');
  if (!currentDbConfig) {
      console.error("[ERROR] Cannot create plugin tables: DB config unknown.");
      return;
  }
  // const dialect = currentDbConfig.type; // Not used currently

  const dbPlugins = plugins.filter(plugin => plugin.databaseExtension);
  for (const plugin of dbPlugins) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables | undefined; // Cast here
    if (!ext || !ext.tableDefinitions) continue;

    for (const [defName] of Object.entries(ext.tableDefinitions)) {
      const fullTableName = `${plugin.meta.id}_${defName}`;
      if (dbSchema && dbSchema[fullTableName]) {
        console.log(`[INFO] Table ${fullTableName} already defined in schema. Creation should be handled by migrations.`);
      } else {
          console.warn(`[WARN] Table definition for ${fullTableName} not found in generated schema. Skipping creation.`);
      }
    }
  }
}

export async function initializePluginDatabases(db: AnyDatabase, plugins: Plugin[]) {
  for (const plugin of plugins) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables | undefined; // Cast here
    if (ext?.onDatabaseInit) {
      console.log(`[INFO] Initializing database for plugin: ${plugin.meta.id}`);
      await ext.onDatabaseInit(db); // db is AnyDatabase, should be compatible
    }
  }
}
