import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm'
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema, pluginTables } from './schema';
import { type Plugin } from '../plugin-system/types';
import fs from 'node:fs';
import path from 'node:path';

// Create SQLite database instance
export function createDatabase(dbPath: string) {
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  return {
    sqlite,
    db,
    schema,
  };
}

// Initialize database with migrations
export async function initializeDatabase(dbPath: string, migrationsPath: string) {
  // Check if database exists
  const dbExists = fs.existsSync(dbPath);
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[INFO] Migrations path provided: ${migrationsPath}`);
  
  // Create database
  const { sqlite, db } = createDatabase(dbPath);
  
  // Log database status
  if (!dbExists) {
    console.log(`[INFO] Database created at: ${dbPath}`);
  } else {
    console.log(`[INFO] Using existing database at: ${dbPath}`);
  }
  
  // Ensure migrations tracking table exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE,
      applied_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  // Apply drizzle-kit migrations
  const drizzleMigrationsPath = path.join(process.cwd(), 'drizzle', 'migrations');
  
  if (fs.existsSync(drizzleMigrationsPath)) {
    console.log(`[INFO] Checking for new migrations...`);
    
    // Get list of applied migrations
    const appliedMigrations = db.select({
      name: sql`migration_name`
    })
    .from(sql`__drizzle_migrations`)
    .all()
    .map(row => row.name);
    
    // Get all migration files
    const migrationFiles = fs
      .readdirSync(drizzleMigrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Apply only new migrations
    for (const file of migrationFiles) {
      if (!appliedMigrations.includes(file)) {
        console.log(`[INFO] Applying migration: ${file}`);
        const migrationPath = path.join(drizzleMigrationsPath, file);
        
        try {
          // Start a transaction
          sqlite.exec('BEGIN TRANSACTION');
          
          // Apply the migration
          const sqlContent = fs.readFileSync(migrationPath, 'utf8');
          const statements = sqlContent.split('--> statement-breakpoint');
          
          for (const statement of statements) {
            const trimmedStatement = statement.trim();
            if (trimmedStatement) {
              sqlite.exec(trimmedStatement);
            }
          }
          
          // Record the migration as applied
          sqlite.exec(`
            INSERT INTO __drizzle_migrations (migration_name)
            VALUES ('${file}')
          `);
          
          // Commit the transaction
          sqlite.exec('COMMIT');
          
          console.log(`[INFO] Applied migration: ${file}`);
        } catch (error) {
          // Rollback on error
          sqlite.exec('ROLLBACK');
          console.error(`[ERROR] Failed to apply migration ${file}:`, error);
          throw error;
        }
      } else {
        console.log(`[INFO] Migration already applied: ${file}`);
      }
    }
  } else {
    console.log(`[WARN] Drizzle migrations directory not found at: ${drizzleMigrationsPath}`);
  }
  
  return {
    sqlite,
    db,
  };
}

// Add plugin tables to the schema
export function registerPluginTables(plugins: Plugin[]) {
  // Get all plugins with database extensions
  const dbPlugins = plugins.filter(plugin => plugin.databaseExtension);
  
  // Add plugin tables to the schema
  for (const plugin of dbPlugins) {
    if (!plugin.databaseExtension) continue;
    
    const { tables } = plugin.databaseExtension;
    
    for (const table of tables) {
      // Get the table name safely
      // @ts-expect-error Symbol access is expected and works at runtime
      const tableName = table[Symbol.for('drizzle:Name')] as string;
      
      // Add the table to pluginTables with proper typing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pluginTables as Record<string, any>)[tableName] = table;
    }
  }
  
  // Update the schema with the new plugin tables
  Object.assign(schema, pluginTables);
}

// Create plugin tables directly in the database
export async function createPluginTables(db: BetterSQLite3Database, plugins: Plugin[]) {
  console.log('[INFO] Creating plugin tables...');
  
  // Get all plugins with database extensions
  const dbPlugins = plugins.filter(plugin => plugin.databaseExtension);
  
  // Create tables for each plugin
  for (const plugin of dbPlugins) {
    if (!plugin.databaseExtension) continue;
    
    const { tables } = plugin.databaseExtension;
    
    for (const table of tables) {
      try {
        // @ts-expect-error Symbol access is expected and works at runtime
        const tableName = table[Symbol.for('drizzle:Name')] as string;
        console.log(`[INFO] Creating table if it doesn't exist: ${tableName}`);
        
        // Use SQL DDL directly for the known table structure
        // This is for the example_entities table specifically
        if (tableName === 'example_entities') {
          db.run(sql`
            CREATE TABLE IF NOT EXISTS example_entities (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
            )
          `);
          console.log(`[INFO] Table ${tableName} created or already exists`);
        } else if (tableName === 'users') {
          db.run(sql`
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              email TEXT NOT NULL UNIQUE,
              name TEXT,
              created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
              updated_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
            )
          `);
          console.log(`[INFO] Table ${tableName} created or already exists`);
        } else {
          console.log(`[WARN] No creation SQL defined for table: ${tableName}`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to create table for plugin ${plugin.meta.id}:`, error);
      }
    }
  }
}

// Initialize plugin database extensions
export async function initializePluginDatabases(
  db: BetterSQLite3Database, 
  plugins: Plugin[]
) {
  // Run database initialization for plugins
  for (const plugin of plugins) {
    if (plugin.databaseExtension?.onDatabaseInit) {
      await plugin.databaseExtension.onDatabaseInit(db);
    }
  }
}
