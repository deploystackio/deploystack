
// Global Settings and Team Credentials Tables

import { pgTable, text, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { authUser } from './auth';
import { teams } from './teams';
import { mcpServers } from './mcp-catalog';

// Global Setting Groups - Organize settings into groups
export const globalSettingGroups = pgTable('globalSettingGroups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Global Settings - Platform-wide configuration
export const globalSettings = pgTable('globalSettings', {
  key: text('key').primaryKey(),
  name: text('name'),
  value: text('value').notNull(),
  type: text('type').notNull().default('string'),
  description: text('description'),
  is_encrypted: boolean('is_encrypted').notNull().default(false),
  group_id: text('group_id').references(() => globalSettingGroups.id),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Team Cloud Credentials - Encrypted cloud provider credentials
export const teamCloudCredentials = pgTable('teamCloudCredentials', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  provider_id: text('provider_id').notNull(), // 'render', 'aws', etc.
  name: text('name').notNull(), // User-friendly name like "Production Render"
  comment: text('comment'), // Optional comment/description
  credentials: text('credentials').notNull(), // Encrypted JSON of credential fields
  created_by: text('created_by').notNull().references(() => authUser.id),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Deployment Credentials - OAuth tokens or GitHub App installations for deployment sources
export const deploymentCredentials = pgTable('deploymentCredentials', {
  id: text('id').primaryKey(),

  // Team association
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),

  // Source identification
  source: text('source').notNull(),  // 'github', 'gitlab', 'docker'

  // Authentication type (for migration support)
  auth_type: text('auth_type').notNull().default('oauth'),  // 'oauth' or 'installation'

  // OAuth tokens (legacy, for backward compatibility)
  access_token_encrypted: text('access_token_encrypted'),
  refresh_token_encrypted: text('refresh_token_encrypted'),

  // GitHub App Installation (new preferred method)
  installation_id: text('installation_id'),  // GitHub installation ID (not encrypted)
  account_login: text('account_login'),  // GitHub account/org login
  account_id: text('account_id'),  // GitHub account/org numeric ID

  // Token metadata (OAuth only)
  scopes: text('scopes').array(),
  expires_at: timestamp('expires_at', { withTimezone: true }),

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  uniqueTeamSource: unique().on(table.team_id, table.source)
}));

// Deployment Settings - Per-server deployment configuration
export const deploymentSettings = pgTable('deploymentSettings', {
  id: text('id').primaryKey(),

  // Server reference (one-to-one)
  server_id: text('server_id').notNull().unique().references(() => mcpServers.id, { onDelete: 'cascade' }),

  // Auto-deploy configuration
  auto_deploy_enabled: boolean('auto_deploy_enabled').notNull().default(true),

  // Webhook metadata
  webhook_id: text('webhook_id'),  // GitHub webhook ID
  webhook_secret: text('webhook_secret'),  // HMAC secret

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
