/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyBaseLogger } from 'fastify';
import { type Plugin, type DatabaseExtension } from '../plugin-system/types';
import type { DatabaseConfig } from './config';
import { sql } from 'drizzle-orm';

// Types for database instances
export type AnyDatabase = any;
export type AnySchema = Record<string, any>;

const PLUGIN_MIGRATIONS_TABLE_NAME = '__plugin_migrations';

// Plugin system functions
interface DatabaseExtensionWithTables extends DatabaseExtension {
  tableDefinitions?: Record<string, Record<string, (columnBuilder: any) => any>>;
  onDatabaseInit?: (db: AnyDatabase, schema: AnySchema, logger: FastifyBaseLogger) => Promise<void>;
}

/**
 * Apply plugin migrations for PostgreSQL
 */
async function applyPluginMigrations(db: AnyDatabase, config: DatabaseConfig, logger: FastifyBaseLogger) {
  if (config.type !== 'postgresql') {
    throw new Error('Only PostgreSQL is supported');
  }

  const createPluginMigrationsTableQuery = `
    CREATE TABLE IF NOT EXISTS ${PLUGIN_MIGRATIONS_TABLE_NAME} (
      id SERIAL PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      schema_hash TEXT NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      UNIQUE(plugin_id, table_name)
    )
  `;

  try {
    await db.execute(sql.raw(createPluginMigrationsTableQuery));

    if (process.env.NODE_ENV !== 'test') {
      logger.info({
        operation: 'apply_plugin_migrations',
        databaseType: 'postgresql'
      }, `Plugin migrations table created/verified`);
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error({
      operation: 'apply_plugin_migrations',
      databaseType: 'postgresql',
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
        column.defaultValue = "DEFAULT_NOW";
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
      type = 'TIMESTAMP WITH TIME ZONE';
    } else if (columnName.toLowerCase().includes('id') || columnName.toLowerCase().includes('count') ||
               columnName.toLowerCase().includes('age') || columnName.toLowerCase().includes('quantity') ||
               columnName.toLowerCase().includes('order') || columnName.toLowerCase().includes('number')) {
      type = 'INTEGER';
    }

    const column = createColumn(type);

    // For timestamp columns with mode, automatically set default if not already set
    if (options?.mode === 'timestamp' && !column.defaultValue) {
      column.defaultValue = "DEFAULT_NOW";
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
    dbType: 'postgresql',
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

  // Simple hash function
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
  pluginId: string,
  tableName: string,
  schemaHash: string
): Promise<boolean> {
  try {
    const queryResult = await db.execute(sql`
      SELECT schema_hash FROM ${sql.identifier(PLUGIN_MIGRATIONS_TABLE_NAME)}
      WHERE plugin_id = ${pluginId} AND table_name = ${tableName}
    `);
    const result = queryResult.rows?.[0];

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
  pluginId: string,
  tableName: string,
  schemaHash: string
) {
  await db.execute(sql`
    INSERT INTO ${sql.identifier(PLUGIN_MIGRATIONS_TABLE_NAME)}
    (plugin_id, table_name, schema_hash)
    VALUES (${pluginId}, ${tableName}, ${schemaHash})
    ON CONFLICT (plugin_id, table_name)
    DO UPDATE SET schema_hash = ${schemaHash}, applied_at = NOW()
  `);
}

/**
 * Convert column definition object to SQL string for PostgreSQL
 */
function convertColumnDefToSQL(columnName: string, columnDef: any): string {
  let sqlType = columnDef.type;
  if (columnDef.type === 'INTEGER') {
    sqlType = 'INTEGER';
  } else if (columnDef.type === 'TEXT') {
    sqlType = 'TEXT';
  }

  let sql = `"${columnName}" ${sqlType}`;

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
    if (columnDef.defaultValue === 'DEFAULT_NOW') {
      sql += ` DEFAULT NOW()`;
    } else if (typeof columnDef.defaultValue === 'string') {
      sql += ` DEFAULT '${columnDef.defaultValue}'`;
    } else if (typeof columnDef.defaultValue === 'boolean') {
      sql += ` DEFAULT ${columnDef.defaultValue ? 'TRUE' : 'FALSE'}`;
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
    const mockBuilder = createMockColumnBuilder();
    const columnDef = columnDefFunc(mockBuilder);
    const sqlColumn = convertColumnDefToSQL(columnName, columnDef);
    columns.push(sqlColumn);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columns.join(',\n  ')}\n)`;
}

/**
 * Create and manage plugin tables with migration support (PostgreSQL only)
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

  if (config.type !== 'postgresql') {
    throw new Error('Only PostgreSQL is supported');
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

          await db.execute(sql.raw(dropTableSQL));
        }

        // Execute the CREATE TABLE statement
        await db.execute(sql.raw(createTableSQL));

        // Record the migration as applied
        await recordPluginMigration(db, plugin.meta.id, tableName, schemaHash);

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
            await recordPluginMigration(db, plugin.meta.id, tableName, schemaHash);
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
