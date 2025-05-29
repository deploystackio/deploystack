import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm'

// Core tables that are part of the main application
// These are always present regardless of plugins

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Export the base schema tables
export const baseSchema = {
  users,
};

// This will be populated with additional tables from plugins
export const pluginTables = {};

// Combined schema will include base tables and plugin tables
export const schema = {
  ...baseSchema,
  ...pluginTables,
};
