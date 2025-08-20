/* eslint-disable @typescript-eslint/no-explicit-any */
// SINGLE SOURCE OF TRUTH FOR DATABASE SCHEMA
// This file is the definitive schema definition for the SQLite database.
// It is used by:
// - Drizzle Kit for generating migrations (npm run db:generate)
// - The application runtime for table definitions and type safety
// - All database operations and queries
//
// IMPORTANT: When making schema changes:
// 1. Edit this file (schema.sqlite.ts) ONLY
// 2. Run `npm run db:generate` to create migrations
// 3. The changes will be automatically applied on next server start
//
// DO NOT create or edit schema.ts - this file has been removed to avoid confusion.

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Define tables with proper foreign key relationships
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
  username: text('username').notNull(),
  email: text('email').notNull().unique(),
  auth_type: text('auth_type').notNull(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  github_id: text('github_id').unique(),
  hashed_password: text('hashed_password'),
  role_id: text('role_id').references(() => roles.id),
  email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
});

// User Preferences - Separate table for flexible preference management
export const userPreferences = sqliteTable('userPreferences', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  preference_key: text('preference_key').notNull(),
  preference_value: text('preference_value').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userKeyIdx: index('user_preferences_user_key_idx').on(table.user_id, table.preference_key),
  userIdx: index('user_preferences_user_idx').on(table.user_id),
  keyIdx: index('user_preferences_key_idx').on(table.preference_key),
  // Unique constraint to prevent duplicate keys per user
  uniqueUserKey: index('user_preferences_unique_user_key').on(table.user_id, table.preference_key),
}));

export const authSession = sqliteTable('authSession', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  expires_at: integer('expires_at').notNull(),
});

export const authKey = sqliteTable('authKey', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  primary_key: text('primary_key').notNull(),
  hashed_password: text('hashed_password'),
  expires: integer('expires'),
});

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  owner_id: text('owner_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
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

export const globalSettingGroups = sqliteTable('globalSettingGroups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

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

export const emailVerificationTokens = sqliteTable('emailVerificationTokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const passwordResetTokens = sqliteTable('passwordResetTokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

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

// MCP Server Categories for better organization
export const mcpCategories = sqliteTable('mcpCategories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'), // Icon name/class for UI
  sort_order: integer('sort_order').notNull().default(0),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Main MCP Server catalog table
export const mcpServers = sqliteTable('mcpServers', {
  id: text('id').primaryKey(),
  
  // Basic Information
  name: text('name').notNull(), // Display name like "Playwright MCP"
  slug: text('slug').notNull().unique(), // Globally unique with team prefix for team servers
  description: text('description').notNull(), // Short description
  long_description: text('long_description'), // Full README content
  
  // Repository & Package Info
  github_url: text('github_url'), // https://github.com/microsoft/playwright-mcp
  git_branch: text('git_branch').default('main'), // main, master, develop
  homepage_url: text('homepage_url'), // https://playwright.dev
  
  // Technical Details
  language: text('language').notNull(), // 'typescript', 'javascript', 'python', 'go'
  runtime: text('runtime').notNull(), // 'node', 'python', 'docker'
  runtime_min_version: text('runtime_min_version'), // e.g., "Node.js 18+", "Python 3.11+"
  
  // Installation Methods (JSON array of objects)
  installation_methods: text('installation_methods').notNull(), // [{"type": "npm", "command": "npx @playwright/mcp"}, {"type": "docker", "image": "..."}]
  
  // MCP Capabilities (JSON array)
  tools: text('tools').notNull(), // JSON array of tool definitions with descriptions
  resources: text('resources'), // JSON array of resource types
  prompts: text('prompts'), // JSON array of available prompts
  
  // Access Control & Visibility
  visibility: text('visibility').notNull().default('team'), // 'global', 'team'
  owner_team_id: text('owner_team_id').references(() => teams.id, { onDelete: 'cascade' }), // NULL for global servers
  created_by: text('created_by').notNull().references(() => authUser.id),
  
  // Organization/Author Info
  author_name: text('author_name'), // Microsoft Corporation, Fábio Ferreira
  author_contact: text('author_contact'), // @fabiomlferreira, email
  organization: text('organization'), // Microsoft, NoopStudios
  license: text('license'), // Apache-2.0, MIT
  
  // Deployment & Configuration - THREE-TIER ARCHITECTURE
  transport_type: text('transport_type', { enum: ['stdio', 'http', 'sse'] }).notNull().default('stdio'), // MCP transport type
  
  // Template Level (Fixed - never changes)
  template_args: text('template_args'), // JSON: ["-y", "@modelcontextprotocol/server-filesystem"]
  template_env: text('template_env'), // JSON: {"FIXED_VAR": "fixed_value"}
  
  // Team Level Schema (what teams can configure)
  team_args_schema: text('team_args_schema'), // JSON: [{name, type, required, description}]
  team_env_schema: text('team_env_schema'), // JSON: [{name, type, required, description}]
  
  // User Level Schema (what individual users can configure)
  user_args_schema: text('user_args_schema'), // JSON: [{name, type, required, description, min_items, max_items}]
  user_env_schema: text('user_env_schema'), // JSON: [{name, type, required, description}]
  
  // Legacy fields - REMOVED (zero backward compatibility)
  // environment_variables: text('environment_variables'), // REMOVED
  // args: text('args'), // REMOVED
  
  dependencies: text('dependencies'), // JSON of dependencies
  
  // Metadata & Status
  category_id: text('category_id').references(() => mcpCategories.id),
  tags: text('tags'), // JSON array: ["browser", "automation", "testing"]
  status: text('status').notNull().default('active'), // 'active', 'deprecated', 'maintenance'
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  auto_install_new_default_team: integer('auto_install_new_default_team', { mode: 'boolean' }).notNull().default(false),
  
  // Timestamps
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_sync_at: integer('last_sync_at', { mode: 'timestamp' }), // Last GitHub sync
}, (table) => ({
  visibilityIdx: index('mcp_servers_visibility_idx').on(table.visibility),
  categoryIdx: index('mcp_servers_category_idx').on(table.category_id),
  statusIdx: index('mcp_servers_status_idx').on(table.status),
  ownerTeamIdx: index('mcp_servers_owner_team_idx').on(table.owner_team_id),
}));

// MCP Server Versions/Releases tracking
export const mcpServerVersions = sqliteTable('mcpServerVersions', {
  id: text('id').primaryKey(),
  server_id: text('server_id').notNull().references(() => mcpServers.id, { onDelete: 'cascade' }),
  version: text('version').notNull(), // 0.0.29, 1.2.3
  git_commit: text('git_commit'), // GitHub commit hash
  changelog: text('changelog'), // Release notes
  is_latest: integer('is_latest', { mode: 'boolean' }).notNull().default(false),
  is_stable: integer('is_stable', { mode: 'boolean' }).notNull().default(true),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  serverVersionIdx: index('mcp_server_versions_server_idx').on(table.server_id),
  latestIdx: index('mcp_server_versions_latest_idx').on(table.is_latest),
}));

// MCP Server Installations - Team installations of MCP servers (Tier 2)
export const mcpServerInstallations = sqliteTable('mcpServerInstallations', {
  id: text('id').primaryKey(),
  
  // References
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  server_id: text('server_id').notNull().references(() => mcpServers.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull().references(() => authUser.id), // User who created the team installation
  
  // Installation details
  installation_name: text('installation_name').notNull(), // User-friendly name like "DevOps Team Filesystem"
  installation_type: text('installation_type').notNull().default('local'), // 'local' or 'cloud'
  
  // Team-level shared configurations (Tier 2)
  team_args: text('team_args'), // JSON: ["shared-config-value"] - team-wide argument values
  team_env: text('team_env'), // JSON: {"SHARED_API_KEY": "team-secret"} - team-wide environment variables
  
  // Legacy fields - REMOVED (zero backward compatibility)
  // user_environment_variables: text('user_environment_variables'), // REMOVED - moved to mcpUserConfigurations
  // user_args: text('user_args'), // REMOVED - moved to mcpUserConfigurations
  
  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }),
}, (table) => ({
  teamInstallationNameIdx: index('mcp_installations_team_name_idx').on(table.team_id, table.installation_name),
  teamServerIdx: index('mcp_installations_team_server_idx').on(table.team_id, table.server_id),
  createdByIdx: index('mcp_installations_created_by_idx').on(table.created_by),
}));

// MCP User Configurations - Individual user configurations per team installation (Tier 3)
export const mcpUserConfigurations = sqliteTable('mcpUserConfigurations', {
  id: text('id').primaryKey(),
  
  // References
  installation_id: text('installation_id').notNull().references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  
  // UPDATED: Replace device_name with device_id reference
  device_id: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  
  // User-specific configurations (Tier 3)
  user_args: text('user_args'), // JSON: ["/Users/john/Desktop", "/Users/john/Projects"] - variable length arrays
  user_env: text('user_env'), // JSON: {"MEMORY_FILE_PATH": "/Users/john/memory.json", "DEBUG_MODE": "true"}
  
  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }),
}, (table) => ({
  installationUserDeviceIdx: index('mcp_user_configs_installation_user_device_idx').on(table.installation_id, table.user_id, table.device_id),
  deviceIdx: index('mcp_user_configs_device_idx').on(table.device_id),
  userIdx: index('mcp_user_configs_user_idx').on(table.user_id),
  installationIdx: index('mcp_user_configs_installation_idx').on(table.installation_id),
  // UPDATED: Unique constraint now includes device_id instead of device_name
  uniqueUserInstallationDevice: index('mcp_user_configs_unique_user_installation_device').on(table.installation_id, table.user_id, table.device_id),
}));

// OAuth2 Authorization Codes for PKCE flow
export const oauthAuthorizationCodes = sqliteTable('oauth_authorization_codes', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  client_id: text('client_id').notNull(),
  redirect_uri: text('redirect_uri').notNull(),
  scope: text('scope').notNull(),
  state: text('state').notNull(),
  code_challenge: text('code_challenge').notNull(),
  code_challenge_method: text('code_challenge_method').notNull(),
  code: text('code').notNull().unique(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// OAuth2 Access Tokens
export const oauthAccessTokens = sqliteTable('oauth_access_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  client_id: text('client_id').notNull(),
  scope: text('scope').notNull(),
  token_hash: text('token_hash').notNull().unique(), // Argon2 hash of the token
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// OAuth2 Refresh Tokens
export const oauthRefreshTokens = sqliteTable('oauth_refresh_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  client_id: text('client_id').notNull(),
  token_hash: text('token_hash').notNull().unique(), // Argon2 hash of the token
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// Device Management System - Enterprise-grade device tracking and security
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  
  // Device Identification
  device_name: text('device_name').notNull(), // User-friendly name (default: hostname)
  hostname: text('hostname'), // System hostname
  hardware_id: text('hardware_id').unique(), // Unique hardware fingerprint
  
  // Device Metadata
  os_type: text('os_type'), // 'macOS', 'Windows', 'Linux'
  os_version: text('os_version'), // '14.1.1', 'Windows 11', etc.
  arch: text('arch'), // 'arm64', 'x64'
  node_version: text('node_version'), // Node.js version for compatibility
  
  // Network and Security
  last_ip: text('last_ip'), // Last known IP address
  user_agent: text('user_agent'), // Browser/CLI user agent string
  
  // Status and Lifecycle
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  is_trusted: integer('is_trusted', { mode: 'boolean' }).notNull().default(true),
  last_login_at: integer('last_login_at', { mode: 'timestamp' }),
  last_activity_at: integer('last_activity_at', { mode: 'timestamp' }),
  
  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userDeviceIdx: index('devices_user_idx').on(table.user_id),
  hardwareIdIdx: index('devices_hardware_id_idx').on(table.hardware_id),
  activeIdx: index('devices_active_idx').on(table.is_active),
  lastActivityIdx: index('devices_last_activity_idx').on(table.last_activity_at),
}));

// Plugin table definitions - populated dynamically by the plugin system
// This object will hold definitions for plugin tables, to be populated dynamically.
// Key: Table name (e.g., 'myPlugin_myTable')
// Value: Column definitions object (e.g., { id: (b:any)=>b('id'), name: (b:any)=>b('name') })
export const pluginTableDefinitions: Record<string, Record<string, (columnBuilder: any) => any>> = {};
