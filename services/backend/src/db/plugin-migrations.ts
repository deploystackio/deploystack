/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyBaseLogger } from 'fastify';
import { type Plugin, type DatabaseExtension } from '../plugin-system/types';
import type { DatabaseConfig } from './config';

// Types for database instances
export type AnyDatabase = any; // BetterSQLite3Database<any> | LibSQL instances
export type AnySchema = Record<string, any>;

const PLUGIN_MIGRATIONS_TABLE_NAME = '__plugin_migrations';

// Plugin system functions
interface DatabaseExtensionWithTables extends DatabaseExtension {
  tableDefinitions?: Record<string, Record<string, (columnBuilder: any) => any>>;
  onDatabaseInit?: (db: AnyDatabase, schema: AnySchema, logger: FastifyBaseLogger) => Promise<void>;
}

/**
 * Apply plugin migrations - similar to core migrations but for plugin tables
 */
async function applyPluginMigrations(db: AnyDatabase, config: DatabaseConfig, logger: FastifyBaseLogger) {
  // Ensure plugin migrations table exists
  const createPluginMigrationsTableQuery = `
    CREATE TABLE IF NOT EXISTS ${PLUGIN_MIGRATIONS_TABLE_NAME} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plugin_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      schema_hash TEXT NOT NULL,
      applied_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
      UNIQUE(plugin_id, table_name)
    )
  `;

  try {
    if (config.type === 'sqlite') {
      (db as any).$client.exec(createPluginMigrationsTableQuery);
    } else if (config.type === 'turso') {
      if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
        await (db as any).$client.execute(createPluginMigrationsTableQuery);
      } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
        const prepared = (db as any).$client.prepare(createPluginMigrationsTableQuery);
        await prepared.run();
      } else {
        await db.run(createPluginMigrationsTableQuery);
      }
    }
    
    if (process.env.NODE_ENV !== 'test') {
      logger.info({
        operation: 'apply_plugin_migrations',
        databaseType: config.type
      }, `Plugin migrations table created/verified`);
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error({
      operation: 'apply_plugin_migrations',
      databaseType: config.type,
      error: typedError,
      errorMessage: typedError.message
    }, `Failed to create plugin migrations table`);
    throw error;
  }
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
 * Generate a hash for plugin table schema to detect changes
 */
function generateSchemaHash(tableName: string, columnDefs: Record<string, (columnBuilder: any) => any>): string {
  const schemaString = JSON.stringify({
    tableName,
    columns: Object.keys(columnDefs).sort(),
    definitions: Object.entries(columnDefs).map(([name, def]) => {
      const mockBuilder = createMockColumnBuilder();
      const columnDef = def(mockBuilder);
      return {
        name,
        type: columnDef.type,
        isPrimaryKey: columnDef.isPrimaryKey,
        isNotNull: columnDef.isNotNull,
        isUnique: columnDef.isUnique,
        defaultValue: columnDef.defaultValue
      };
    }).sort((a, b) => a.name.localeCompare(b.name))
  });
  
  // Simple hash function (for production, consider using crypto.createHash)
  let hash = 0;
  for (let i = 0; i < schemaString.length; i++) {
    const char = schemaString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Check if plugin table needs migration
 */
async function needsPluginMigration(
  db: AnyDatabase, 
  config: DatabaseConfig, 
  pluginId: string, 
  tableName: string, 
  schemaHash: string
): Promise<boolean> {
  const query = `SELECT schema_hash FROM ${PLUGIN_MIGRATIONS_TABLE_NAME} WHERE plugin_id = ? AND table_name = ?`;
  
  try {
    let result: any;
    if (config.type === 'sqlite') {
      result = (db as any).$client.prepare(query).get(pluginId, tableName);
    } else if (config.type === 'turso') {
      if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
        const queryResult = await (db as any).$client.execute(query, [pluginId, tableName]);
        result = queryResult.rows?.[0];
      } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
        const prepared = (db as any).$client.prepare(query);
        const queryResult = await prepared.get([pluginId, tableName]);
        result = queryResult;
      } else {
        const queryResult = await db.get(query, [pluginId, tableName]);
        result = queryResult;
      }
    }
    
    if (!result) {
      return true; // No record means table doesn't exist or needs creation
    }
    
    return result.schema_hash !== schemaHash; // Schema changed
  } catch {
    // If query fails, assume migration is needed
    return true;
  }
}

/**
 * Record plugin migration as applied
 */
async function recordPluginMigration(
  db: AnyDatabase,
  config: DatabaseConfig,
  pluginId: string,
  tableName: string,
  schemaHash: string
) {
  const query = `
    INSERT OR REPLACE INTO ${PLUGIN_MIGRATIONS_TABLE_NAME} 
    (plugin_id, table_name, schema_hash) 
    VALUES (?, ?, ?)
  `;
  
  if (config.type === 'sqlite') {
    (db as any).$client.prepare(query).run(pluginId, tableName, schemaHash);
  } else if (config.type === 'turso') {
    if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
      await (db as any).$client.execute(query, [pluginId, tableName, schemaHash]);
    } else if ((db as any).$client && typeof (db as any).$client.prepare === 'function') {
      const prepared = (db as any).$client.prepare(query);
      await prepared.run([pluginId, tableName, schemaHash]);
    } else {
      await db.run(query, [pluginId, tableName, schemaHash]);
    }
  }
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
 * Create and manage plugin tables with migration support
 */
export async function createPluginTables(
  plugins: Plugin[], 
  db: AnyDatabase, 
  config: DatabaseConfig, 
  logger: FastifyBaseLogger
) {
  if (!db) {
    logger.warn({
      operation: 'create_plugin_tables'
    }, 'Database not initialized, skipping plugin table creation.');
    return;
  }

  // Initialize plugin migrations system
  await applyPluginMigrations(db, config, logger);

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
  }, `Processing tables for ${pluginsWithTables.length} plugins...`);

  for (const plugin of pluginsWithTables) {
    const ext = plugin.databaseExtension as DatabaseExtensionWithTables;
    if (!ext.tableDefinitions) continue;

    for (const [tableName, columnDefs] of Object.entries(ext.tableDefinitions || {})) {
      const fullTableName = `${plugin.meta.id}_${tableName}`;
      const schemaHash = generateSchemaHash(fullTableName, columnDefs);
      
      try {
        // Check if migration is needed
        const needsMigration = await needsPluginMigration(
          db, 
          config, 
          plugin.meta.id, 
          tableName, 
          schemaHash
        );

        if (!needsMigration) {
          logger.debug({
            operation: 'create_plugin_tables',
            pluginId: plugin.meta.id,
            tableName: fullTableName
          }, `Plugin table ${fullTableName} is up to date, skipping.`);
          continue;
        }

        // Generate CREATE TABLE SQL dynamically
        const createTableSQL = generateCreateTableSQL(fullTableName, columnDefs);
        
        logger.info({
          operation: 'create_plugin_tables',
          pluginId: plugin.meta.id,
          tableName: fullTableName,
          sql: createTableSQL
        }, `Creating/updating plugin table: ${fullTableName}`);

        // For development: Drop and recreate (preserves data in production through migrations)
        if (process.env.NODE_ENV === 'development') {
          const dropTableSQL = `DROP TABLE IF EXISTS "${fullTableName}"`;
          
          logger.debug({
            operation: 'create_plugin_tables',
            pluginId: plugin.meta.id,
            tableName: fullTableName,
            sql: dropTableSQL
          }, `[DEV] Dropping existing plugin table: ${fullTableName}`);

          // Execute the DROP TABLE statement
          if (config.type === 'sqlite') {
            (db as any).$client.exec(dropTableSQL);
          } else if (config.type === 'turso') {
            if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
              await (db as any).$client.execute(dropTableSQL);
            } else {
              await db.run(dropTableSQL);
            }
          }
        }

        // Execute the CREATE TABLE statement
        if (config.type === 'sqlite') {
          (db as any).$client.exec(createTableSQL);
        } else if (config.type === 'turso') {
          if ((db as any).$client && typeof (db as any).$client.execute === 'function') {
            await (db as any).$client.execute(createTableSQL);
          } else {
            await db.run(createTableSQL);
          }
        }

        // Record the migration as applied
        await recordPluginMigration(db, config, plugin.meta.id, tableName, schemaHash);

        logger.info({
          operation: 'create_plugin_tables',
          pluginId: plugin.meta.id,
          tableName: fullTableName
        }, `✅ Created/updated plugin table: ${fullTableName}`);

      } catch (error) {
        const typedError = error as Error;
        // Check if table already exists (not an error in production)
        if (typedError.message.includes('already exists') || (typedError.message.includes('table') && typedError.message.includes('already'))) {
          logger.debug({
            operation: 'create_plugin_tables',
            pluginId: plugin.meta.id,
            tableName: fullTableName
          }, `Table ${fullTableName} already exists, recording migration.`);
          
          // Still record the migration to track schema
          try {
            await recordPluginMigration(db, config, plugin.meta.id, tableName, schemaHash);
          } catch (recordError) {
            logger.warn({
              operation: 'create_plugin_tables',
              pluginId: plugin.meta.id,
              tableName: fullTableName,
              error: recordError
            }, `Failed to record plugin migration for existing table`);
          }
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
  }, '✅ Plugin table processing completed.');
}
