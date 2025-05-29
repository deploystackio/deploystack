// This file is specifically for drizzle-kit when generating SQLite migrations.
// It imports table definitions from the central schema.ts and instantiates them
// using sqliteTable and SQLite-specific column types/builders.

import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';
import { baseTableDefinitions, pluginTableDefinitions } from './schema'; // Central definitions

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tables: Record<string, any> = {};

// Helper to get the correct SQLite column builder
function getSqliteColumnBuilder(type: 'text' | 'integer' | 'timestamp') {
  if (type === 'text') return sqliteText;
  if (type === 'integer') return sqliteInteger;
  // For SQLite, timestamp is often handled as integer with mode, or text.
  // The columnDefFunc from schema.ts for createdAt/updatedAt already includes { mode: 'timestamp' }
  // when using sqliteInteger.
  if (type === 'timestamp') return sqliteInteger; 
  throw new Error(`Unsupported column type for SQLite: ${type}`);
}

// Instantiate base tables for SQLite
for (const [tableName, tableColumnDefinitions] of Object.entries(baseTableDefinitions)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Record<string, any> = {};
  for (const [columnName, columnDefFunc] of Object.entries(tableColumnDefinitions)) {
    // Determine builder type (heuristic, same as in db/index.ts and schema.pg.ts)
    let builderType: 'text' | 'integer' | 'timestamp' = 'text';
    if (columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
      builderType = 'timestamp';
    } else if (['count', 'age', 'quantity', 'order', 'status', 'number'].some(keyword => columnName.toLowerCase().includes(keyword)) && !columnName.toLowerCase().includes('text')) {
      const idIsText = tableName === 'users' && columnName === 'id';
      if (!idIsText) builderType = 'integer';
    }
    if (tableName === 'users' && columnName === 'id') builderType = 'text'; // users.id is text
    
    const builder = getSqliteColumnBuilder(builderType);
    columns[columnName] = columnDefFunc(builder);
  }
  tables[tableName] = sqliteTable(tableName, columns);
}

// Instantiate plugin tables for SQLite (similar logic)
for (const [tableName, tableColumnDefinitions] of Object.entries(pluginTableDefinitions)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Record<string, any> = {};
  for (const [columnName, columnDefFunc] of Object.entries(tableColumnDefinitions)) {
    let builderType: 'text' | 'integer' | 'timestamp' = 'text';
    if (columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
      builderType = 'timestamp';
    } else if (['id', 'count', 'age', 'quantity', 'order', 'status', 'number'].some(keyword => columnName.toLowerCase().includes(keyword))) {
      builderType = 'integer';
    }
    const builder = getSqliteColumnBuilder(builderType);
    columns[columnName] = columnDefFunc(builder);
  }
  tables[tableName] = sqliteTable(tableName, columns);
}

// Export all tables for drizzle-kit to find.
// Drizzle Kit expects top-level exports of table objects.
export const { users, ...otherBaseTables } = tables; // Assuming 'users' is a key in tables
// Similar to schema.pg.ts, explicit exports might be needed for all tables if the spread doesn't work.
// For now, relying on destructuring for known tables like 'users'.
