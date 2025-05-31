// This file is specifically for drizzle-kit when generating SQLite migrations.
// It defines the actual SQLite tables with proper foreign key relationships.

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Define tables with proper foreign key relationships
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  permissions: text('permissions').notNull(),
  is_system_role: integer('is_system_role', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const authUser = sqliteTable('authUser', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  auth_type: text('auth_type').notNull(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  github_id: text('github_id').unique(),
  hashed_password: text('hashed_password'),
  role_id: text('role_id').references(() => roles.id),
});

export const authSession = sqliteTable('authSession', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  expires_at: integer('expires_at', { mode: 'number' }).notNull(),
});

export const authKey = sqliteTable('authKey', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  primary_key: text('primary_key').notNull(),
  hashed_password: text('hashed_password'),
  expires: integer('expires', { mode: 'number' }),
});

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  owner_id: text('owner_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const teamMemberships = sqliteTable('teamMemberships', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'team_admin' or 'team_user'
  joined_at: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
