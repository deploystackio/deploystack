 
// Global Settings and Team Credentials Tables

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { authUser } from './auth';
import { teams } from './teams';

// Global Setting Groups - Organize settings into groups
export const globalSettingGroups = sqliteTable('globalSettingGroups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Global Settings - Platform-wide configuration
export const globalSettings = sqliteTable('globalSettings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  type: text('type').notNull().default('string'),
  description: text('description'),
  is_encrypted: integer('is_encrypted', { mode: 'boolean' }).notNull().default(false),
  group_id: text('group_id').references(() => globalSettingGroups.id),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Team Cloud Credentials - Encrypted cloud provider credentials
export const teamCloudCredentials = sqliteTable('teamCloudCredentials', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  provider_id: text('provider_id').notNull(), // 'render', 'aws', etc.
  name: text('name').notNull(), // User-friendly name like "Production Render"
  comment: text('comment'), // Optional comment/description
  credentials: text('credentials').notNull(), // Encrypted JSON of credential fields
  created_by: text('created_by').notNull().references(() => authUser.id),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
