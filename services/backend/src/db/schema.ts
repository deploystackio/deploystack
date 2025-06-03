/* eslint-disable @typescript-eslint/no-explicit-any */
// This file exports table column definitions.
// The actual Drizzle table objects (sqliteTable, pgTable) will be constructed
// in db/index.ts based on the selected database dialect.
// This file does not import from Drizzle directly to keep it purely structural.
// Type safety for Drizzle builders is handled in db/index.ts where these
// definitions are consumed.

// The functions for columns expect a Drizzle column builder function
// (e.g., sqliteText, pgText, sqliteInteger, pgInteger) as their argument.

export const usersTableColumns = {
  // Parameter 'columnBuilder' is expected to be a function like `text` or `integer`
  // from the appropriate Drizzle dialect module (e.g., drizzle-orm/sqlite-core or drizzle-orm/pg-core)
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  email: (columnBuilder: any) => columnBuilder('email').notNull().unique(),
  name: (columnBuilder: any) => columnBuilder('name'),
  // Use $defaultFn for SQLite timestamp generation
  createdAt: (columnBuilder: any) => columnBuilder('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: (columnBuilder: any) => columnBuilder('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
};

// Enum for authentication types
// This will be translated to pgEnum or similar in db/index.ts
export const authTypeEnumValues = ['email_signup', 'github'] as const;

export const rolesTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  name: (columnBuilder: any) => columnBuilder('name').notNull().unique(),
  description: (columnBuilder: any) => columnBuilder('description'),
  permissions: (columnBuilder: any) => columnBuilder('permissions').notNull(), // JSON string
  is_system_role: (columnBuilder: any) => columnBuilder('is_system_role').notNull().default(false),
  created_at: (columnBuilder: any) => columnBuilder('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: (columnBuilder: any) => columnBuilder('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
};

export const authUserTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(), // Lucia typically uses string IDs
  username: (columnBuilder: any) => columnBuilder('username').notNull().unique(),
  email: (columnBuilder: any) => columnBuilder('email').notNull().unique(),
  auth_type: (columnBuilder: any) => columnBuilder('auth_type').notNull(), // Will be handled specially in db/index.ts for enums
  first_name: (columnBuilder: any) => columnBuilder('first_name'),
  last_name: (columnBuilder: any) => columnBuilder('last_name'),
  github_id: (columnBuilder: any) => columnBuilder('github_id').unique(),
  hashed_password: (columnBuilder: any) => columnBuilder('hashed_password'), // For email auth
  role_id: (columnBuilder: any) => columnBuilder('role_id'), // Foreign key to roles.id
};

export const authSessionTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  user_id: (columnBuilder: any) => columnBuilder('user_id').notNull(), // Foreign key to authUser.id
  expires_at: (columnBuilder: any) => columnBuilder('expires_at').notNull(), // Lucia v3 uses expires_at as integer timestamp
};

export const authKeyTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(), // e.g., 'email:user@example.com' or 'github:123456'
  user_id: (columnBuilder: any) => columnBuilder('user_id').notNull(), // Foreign key to authUser.id
  primary_key: (columnBuilder: any) => columnBuilder('primary_key').notNull(),
  hashed_password: (columnBuilder: any) => columnBuilder('hashed_password'), // Nullable for OAuth keys
  expires: (columnBuilder: any) => columnBuilder('expires'), // Nullable, for things like password reset
};

export const teamsTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  name: (columnBuilder: any) => columnBuilder('name').notNull(),
  slug: (columnBuilder: any) => columnBuilder('slug').notNull().unique(),
  description: (columnBuilder: any) => columnBuilder('description'),
  owner_id: (columnBuilder: any) => columnBuilder('owner_id').notNull(), // Foreign key to authUser.id
  created_at: (columnBuilder: any) => columnBuilder('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: (columnBuilder: any) => columnBuilder('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
};

// Enum for team member roles
export const teamRoleEnumValues = ['team_admin', 'team_user'] as const;

export const teamMembershipsTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  team_id: (columnBuilder: any) => columnBuilder('team_id').notNull(), // Foreign key to teams.id
  user_id: (columnBuilder: any) => columnBuilder('user_id').notNull(), // Foreign key to authUser.id
  role: (columnBuilder: any) => columnBuilder('role').notNull(), // team_admin or team_user
  joined_at: (columnBuilder: any) => columnBuilder('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
};

export const globalSettingGroupsTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  name: (columnBuilder: any) => columnBuilder('name').notNull(),
  description: (columnBuilder: any) => columnBuilder('description'),
  icon: (columnBuilder: any) => columnBuilder('icon'),
  sort_order: (columnBuilder: any) => columnBuilder('sort_order').notNull().default(0),
  created_at: (columnBuilder: any) => columnBuilder('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: (columnBuilder: any) => columnBuilder('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
};

export const globalSettingsTableColumns = {
  key: (columnBuilder: any) => columnBuilder('key').primaryKey(),
  value: (columnBuilder: any) => columnBuilder('value').notNull(),
  type: (columnBuilder: any) => columnBuilder('type').notNull().default('string'),
  description: (columnBuilder: any) => columnBuilder('description'),
  is_encrypted: (columnBuilder: any) => columnBuilder('is_encrypted').notNull().default(false),
  group_id: (columnBuilder: any) => columnBuilder('group_id'), // Foreign key to globalSettingGroups.id
  created_at: (columnBuilder: any) => columnBuilder('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: (columnBuilder: any) => columnBuilder('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
};

// This object will hold definitions for all base tables.
export const baseTableDefinitions = {
  users: usersTableColumns, // Keeping existing users table for now, can be deprecated/merged later
  roles: rolesTableColumns,
  authUser: authUserTableColumns,
  authSession: authSessionTableColumns,
  authKey: authKeyTableColumns,
  teams: teamsTableColumns,
  teamMemberships: teamMembershipsTableColumns,
  globalSettingGroups: globalSettingGroupsTableColumns,
  globalSettings: globalSettingsTableColumns,
  // e.g., posts: postsTableColumns,
};

// This object will hold definitions for plugin tables, to be populated dynamically.
// The structure should mirror baseTableDefinitions.
// Key: Table name (e.g., 'myPlugin_myTable')
// Value: Column definitions object (e.g., { id: (b:any)=>b('id'), name: (b:any)=>b('name') })
export const pluginTableDefinitions: Record<string, Record<string, (columnBuilder: any) => any>> = {};


// Note: The final `schema` object that Drizzle ORM uses will be constructed
// in `services/backend/src/db/index.ts`. This file, `schema.ts`, now only
// provides the definitions (column names, types, constraints via chained methods).
//
// Example of how it will be used in db/index.ts:
//
// import { baseTableDefinitions } from './schema';
// import { sqliteTable, text as sqliteTextColumnBuilder, integer as sqliteIntegerColumnBuilder } from 'drizzle-orm/sqlite-core';
//
// const users = sqliteTable('users', {
//   id: baseTableDefinitions.users.id(sqliteTextColumnBuilder),
//   email: baseTableDefinitions.users.email(sqliteTextColumnBuilder),
//   name: baseTableDefinitions.users.name(sqliteTextColumnBuilder),
//   createdAt: baseTableDefinitions.users.createdAt(sqliteIntegerColumnBuilder),
//   updatedAt: baseTableDefinitions.users.updatedAt(sqliteIntegerColumnBuilder),
// });
//
// // The actual schema is built in 'services/backend/src/db/schema.sqlite.ts'
// // and augmented with plugin tables in 'services/backend/src/db/index.ts'
// // export const schema = { users };
