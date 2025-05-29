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
  // Added .defaultNow() to let Drizzle handle dialect-specific default timestamp generation
  createdAt: (columnBuilder: any) => columnBuilder('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: (columnBuilder: any) => columnBuilder('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
};

// Enum for authentication types
// This will be translated to pgEnum or similar in db/index.ts
export const authTypeEnumValues = ['email_signup', 'github'] as const;

export const authUserTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(), // Lucia typically uses string IDs
  username: (columnBuilder: any) => columnBuilder('username').notNull().unique(),
  email: (columnBuilder: any) => columnBuilder('email').notNull().unique(),
  auth_type: (columnBuilder: any) => columnBuilder('auth_type').notNull(), // Will be handled specially in db/index.ts for enums
  first_name: (columnBuilder: any) => columnBuilder('first_name'),
  last_name: (columnBuilder: any) => columnBuilder('last_name'),
  github_id: (columnBuilder: any) => columnBuilder('github_id').unique(),
  hashed_password: (columnBuilder: any) => columnBuilder('hashed_password'), // For email auth
};

export const authSessionTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(),
  user_id: (columnBuilder: any) => columnBuilder('user_id').notNull(), // Foreign key to authUser.id
  expires_at: (columnBuilder: any) => columnBuilder('expires_at', { mode: 'number' }).notNull(), // Lucia v3 uses expires_at
};

export const authKeyTableColumns = {
  id: (columnBuilder: any) => columnBuilder('id').primaryKey(), // e.g., 'email:user@example.com' or 'github:123456'
  user_id: (columnBuilder: any) => columnBuilder('user_id').notNull(), // Foreign key to authUser.id
  primary_key: (columnBuilder: any) => columnBuilder('primary_key').notNull(),
  hashed_password: (columnBuilder: any) => columnBuilder('hashed_password'), // Nullable for OAuth keys
  expires: (columnBuilder: any) => columnBuilder('expires', { mode: 'number' }), // Nullable, for things like password reset
};

// This object will hold definitions for all base tables.
export const baseTableDefinitions = {
  users: usersTableColumns, // Keeping existing users table for now, can be deprecated/merged later
  authUser: authUserTableColumns,
  authSession: authSessionTableColumns,
  authKey: authKeyTableColumns,
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
// import { pgTable, text as pgTextColumnBuilder, integer as pgIntegerColumnBuilder } from 'drizzle-orm/pg-core';
//
// const users = pgTable('users', {
//   id: baseTableDefinitions.users.id(pgTextColumnBuilder),
//   email: baseTableDefinitions.users.email(pgTextColumnBuilder),
//   name: baseTableDefinitions.users.name(pgTextColumnBuilder),
//   createdAt: baseTableDefinitions.users.createdAt(pgIntegerColumnBuilder),
//   updatedAt: baseTableDefinitions.users.updatedAt(pgIntegerColumnBuilder),
// });
//
// export const schema = { users };
