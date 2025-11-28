
// Team and User Preference Tables

import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { authUser } from './auth';

// Teams - Multi-tenant team management
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  owner_id: text('owner_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  is_default: boolean('is_default').notNull().default(false),
  non_http_mcp_limit: integer('non_http_mcp_limit').notNull().default(1),
  mcp_server_limit: integer('mcp_server_limit').notNull().default(5),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Team Memberships - User-team relationships
export const teamMemberships = pgTable('teamMemberships', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'team_admin' or 'team_user'
  joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

// User Preferences - Flexible preference management
export const userPreferences = pgTable('userPreferences', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  preference_key: text('preference_key').notNull(),
  preference_value: text('preference_value').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userKeyIdx: index('user_preferences_user_key_idx').on(table.user_id, table.preference_key),
  userIdx: index('user_preferences_user_idx').on(table.user_id),
  keyIdx: index('user_preferences_key_idx').on(table.preference_key),
  uniqueUserKey: index('user_preferences_unique_user_key').on(table.user_id, table.preference_key),
}));
