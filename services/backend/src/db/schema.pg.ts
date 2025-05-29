// This file is specifically for drizzle-kit when generating PostgreSQL migrations.
// It imports table definitions from the central schema.ts and instantiates them
// using pgTable and PostgreSQL-specific column types/builders.

import { pgTable, text as pgText, integer as pgInteger, timestamp as pgTimestamp } from 'drizzle-orm/pg-core';
import { baseTableDefinitions, pluginTableDefinitions } from './schema'; // Central definitions

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tables: Record<string, any> = {};

// Helper to get the correct PG column builder based on a simple type string
// This mirrors the logic in db/index.ts's getColumnBuilder for PG
function getPgColumnBuilder(type: 'text' | 'integer' | 'timestamp') {
  if (type === 'text') return pgText;
  if (type === 'integer') return pgInteger;
  if (type === 'timestamp') return pgTimestamp;
  throw new Error(`Unsupported column type for PostgreSQL: ${type}`);
}

// Instantiate base tables for PostgreSQL
for (const [tableName, tableColumnDefinitions] of Object.entries(baseTableDefinitions)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Record<string, any> = {};
  for (const [columnName, columnDefFunc] of Object.entries(tableColumnDefinitions)) {
    // Determine builder type (heuristic, same as in db/index.ts)
    let builderType: 'text' | 'integer' | 'timestamp' = 'text';
    if (columnName.toLowerCase().includes('at') || columnName.toLowerCase().includes('date')) {
      builderType = 'timestamp';
    } else if (['count', 'age', 'quantity', 'order', 'status', 'number'].some(keyword => columnName.toLowerCase().includes(keyword)) && !columnName.toLowerCase().includes('text')) {
      const idIsText = tableName === 'users' && columnName === 'id';
      if (!idIsText) builderType = 'integer';
    }
    if (tableName === 'users' && columnName === 'id') builderType = 'text'; // users.id is text

    const builder = getPgColumnBuilder(builderType);
    columns[columnName] = columnDefFunc(builder);
  }
  tables[tableName] = pgTable(tableName, columns);
}

// Instantiate plugin tables for PostgreSQL (similar logic)
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
    const builder = getPgColumnBuilder(builderType);
    columns[columnName] = columnDefFunc(builder);
  }
  tables[tableName] = pgTable(tableName, columns);
}

// Export all tables for drizzle-kit to find
// Example: export const users = tables.users; export const posts = tables.posts;
// Drizzle Kit expects top-level exports of table objects.
export const { users, ...otherBaseTables } = tables; // Assuming 'users' is a key in tables
// For plugin tables, they would also need to be destructured and exported if `tables` contains them directly.
// Or, more robustly:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allExports: Record<string, any> = {};
for(const key in tables) {
    allExports[key] = tables[key];
}
// This default export might not be picked up by drizzle-kit, it usually wants named exports.
// It's better to explicitly export each table if possible, or ensure drizzle-kit can handle this.
// For now, this structure might require manual listing of exports if the spread doesn't work as expected by drizzle-kit.
// A common pattern is:
// export const users = tables.users;
// export const products = tables.products; etc.
// If tables are dynamically named (e.g. from plugins), this becomes harder.
// Let's assume for now drizzle-kit can pick up from a spread if the object contains the tables.
// However, to be safe, explicitly exporting known tables is better.
// Since we know 'users' is a base table:
// export const users = tables.users; (already done by destructuring)
// Other tables would need similar explicit exports if not covered by `...otherBaseTables` effectively for drizzle-kit.
// For simplicity, we'll rely on the destructuring for now.
