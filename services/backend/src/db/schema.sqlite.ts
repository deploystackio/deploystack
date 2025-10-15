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
import { nanoid } from 'nanoid';

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
  official_name: text('official_name'), // Official reverse-DNS name like "io.github.upstash/context7"
  slug: text('slug').notNull().unique(), // Globally unique with team prefix for team servers
  description: text('description').notNull(), // Short description
  long_description: text('long_description'), // Full README content
  
  // Version Information
  version: text('version'), // Current version from official registry
  
  repository_url: text('repository_url'), // Official repository.url - supports GitHub, GitLab, etc.
  repository_source: text('repository_source'), // "github", "gitlab", etc.
  repository_id: text('repository_id'), // Platform-specific repo ID for API calls
  repository_subfolder: text('repository_subfolder'), // For monorepos
  git_branch: text('git_branch').default('main'),
  website_url: text('website_url'),
  
  // Technical Details
  language: text('language').notNull(), // 'typescript', 'javascript', 'python', 'go'
  runtime: text('runtime').notNull(), // 'node', 'python', 'docker'
  
  // GitHub Integration
  github_account_id: text('github_account_id'), // GitHub Account ID (owner.id from GitHub API)
  github_readme_base64: text('github_readme_base64'), // Base64 encoded README content
  github_stars: integer('github_stars'), // Star count from GitHub
  
  // Installation & Package Methods
  packages: text('packages'), // Official packages array (JSON)
  remotes: text('remotes'), // Official remotes array (JSON)
  
  // MCP Capabilities (JSON array)
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
  
  // Template Level (Fixed - never changes) - All stored as arrays
  template_args: text('template_args'), // JSON: [{"value":"-y", "locked":true, "description":"..."}]
  template_env: text('template_env'), // JSON: [{"name":"FIXED_VAR", "value":"fixed_value", "locked":true, "description":"..."}]
  template_headers: text('template_headers'), // JSON: [{"name":"Authorization", "value":"Bearer token", "locked":true, "description":"..."}]
  
  // Team Level Schema (what teams can configure)
  team_args_schema: text('team_args_schema'), // JSON: [{name, type, required, description}]
  team_env_schema: text('team_env_schema'), // JSON: [{name, type, required, description}]
  team_headers_schema: text('team_headers_schema'), // JSON: [{name, type, required, description}]
  
  // User Level Schema (what individual users can configure)
  user_args_schema: text('user_args_schema'), // JSON: [{name, type, required, description, min_items, max_items}]
  user_env_schema: text('user_env_schema'), // JSON: [{name, type, required, description}]
  user_headers_schema: text('user_headers_schema'), // JSON: [{name, type, required, description}]
  
  // Legacy fields - REMOVED (zero backward compatibility)
  // environment_variables: text('environment_variables'), // REMOVED
  // args: text('args'), // REMOVED
  
  dependencies: text('dependencies'), // JSON of dependencies
  
  meta_extensions: text('meta_extensions'), // JSON object for _meta field
  
  // Metadata & Status
  category_id: text('category_id').references(() => mcpCategories.id),
  tags: text('tags'), // JSON array: ["browser", "automation", "testing"]
  status: text('status').notNull().default('active'), // 'active', 'deprecated', 'maintenance'
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  auto_install_new_default_team: integer('auto_install_new_default_team', { mode: 'boolean' }).notNull().default(false),
  
  // Official Registry Sync Tracking
  synced_from_official_registry: integer('synced_from_official_registry', { mode: 'boolean' }).notNull().default(false),
  official_registry_server_id: text('official_registry_server_id'),
  official_registry_version_id: text('official_registry_version_id'),
  official_registry_published_at: integer('official_registry_published_at', { mode: 'timestamp' }),
  official_registry_updated_at: integer('official_registry_updated_at', { mode: 'timestamp' }),
  
  // Timestamps
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_sync_at: integer('last_sync_at', { mode: 'timestamp' }), // Last GitHub sync
}, (table) => ({
  visibilityIdx: index('mcp_servers_visibility_idx').on(table.visibility),
  categoryIdx: index('mcp_servers_category_idx').on(table.category_id),
  statusIdx: index('mcp_servers_status_idx').on(table.status),
  ownerTeamIdx: index('mcp_servers_owner_team_idx').on(table.owner_team_id),
  officialNameIdx: index('mcp_servers_official_name_idx').on(table.official_name),
  syncedFlagIdx: index('mcp_servers_synced_flag_idx').on(table.synced_from_official_registry),
  registryServerIdIdx: index('mcp_servers_registry_server_id_idx').on(table.official_registry_server_id),
  repositoryUrlIdx: index('mcp_servers_repository_url_idx').on(table.repository_url),
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
  installation_type: text('installation_type').notNull().default('global'), // 'global' or 'team'
  
  // Team-level shared configurations (Tier 2)
  team_args: text('team_args'), // JSON: ["shared-config-value"] - team-wide argument values
  team_env: text('team_env'), // JSON: {"SHARED_API_KEY": "team-secret"} - team-wide environment variables
  team_headers: text('team_headers'), // JSON: {"Authorization": "Bearer team_token"} - team-wide headers
  
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
  
  // NOTE: No device identification needed for Satellite Service
  // Users simply add URLs to VS Code - no device-specific configurations required
  
  // User-specific configurations (Tier 3)
  user_args: text('user_args'), // JSON: ["/Users/john/Desktop", "/Users/john/Projects"] - variable length arrays
  user_env: text('user_env'), // JSON: {"MEMORY_FILE_PATH": "/Users/john/memory.json", "DEBUG_MODE": "true"}
  user_headers: text('user_headers'), // JSON: {"Authorization": "Bearer user_personal_token"} - user-specific headers
  
  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }),
}, (table) => ({
  installationUserIdx: index('mcp_user_configs_installation_user_idx').on(table.installation_id, table.user_id),
  userIdx: index('mcp_user_configs_user_idx').on(table.user_id),
  installationIdx: index('mcp_user_configs_installation_idx').on(table.installation_id),
  // One configuration per user per installation (no device distinction needed)
  uniqueUserInstallation: index('mcp_user_configs_unique_user_installation').on(table.installation_id, table.user_id),
}));

// OAuth2 Authorization Codes for PKCE flow (Team-Aware)
export const oauthAuthorizationCodes = sqliteTable('oauth_authorization_codes', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }), // Team context for OAuth flow
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

// OAuth2 Access Tokens (Team-Aware)
export const oauthAccessTokens = sqliteTable('oauth_access_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }), // Team context for token
  client_id: text('client_id').notNull(),
  scope: text('scope').notNull(),
  token_hash: text('token_hash').notNull().unique(), // Argon2 hash of the token
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// OAuth2 Refresh Tokens (Team-Aware)
export const oauthRefreshTokens = sqliteTable('oauth_refresh_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }), // Team context for refresh token
  client_id: text('client_id').notNull(),
  token_hash: text('token_hash').notNull().unique(), // Argon2 hash of the token
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// OAuth2 Client Management - Team-Aware MCP Clients
export const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  client_id: text('client_id').notNull().unique(),
  client_secret_hash: text('client_secret_hash'), // Argon2 hash (NULL for public clients)
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(), // JSON array of allowed redirect URIs
  scope: text('scope').notNull(), // Default scopes for this client
  team_id: text('team_id').references(() => teams.id), // NULL for global clients
  created_by_user_id: text('created_by_user_id').references(() => authUser.id),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  clientIdIdx: index('oauth_clients_client_id_idx').on(table.client_id),
  teamIdx: index('oauth_clients_team_idx').on(table.team_id),
  activeIdx: index('oauth_clients_active_idx').on(table.is_active),
}));

// OAuth2 Team Consents - User consent per team per client
export const oauthTeamConsents = sqliteTable('oauth_team_consents', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  client_id: text('client_id').notNull(),
  scope: text('scope').notNull(), // Consented scopes
  granted_at: integer('granted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => ({
  userTeamClientIdx: index('oauth_team_consents_user_team_client_idx').on(table.user_id, table.team_id, table.client_id),
  teamIdx: index('oauth_team_consents_team_idx').on(table.team_id),
  clientIdx: index('oauth_team_consents_client_idx').on(table.client_id),
  activeIdx: index('oauth_team_consents_active_idx').on(table.is_active),
  // Unique constraint: one consent per user per team per client
  uniqueUserTeamClient: index('oauth_team_consents_unique_user_team_client').on(table.user_id, table.team_id, table.client_id),
}));

// NOTE: Device management system removed as part of strategic pivot to Satellite Service
// Users now simply add URLs to VS Code instead of installing CLI software
// No need for device tracking in satellite-based architecture

// Satellite Management Tables - DeployStack Satellite Communication Infrastructure

// Satellite Registry - Central registry for all registered satellites
export const satellites = sqliteTable('satellites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // User-friendly name like "company-satellite-1"
  satellite_type: text('satellite_type', { enum: ['global', 'team'] }).notNull(), // Deployment model
  team_id: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // NULL for global satellites
  status: text('status', { enum: ['active', 'inactive', 'maintenance', 'error'] }).notNull().default('active'),
  capabilities: text('capabilities').notNull(), // JSON array of supported MCP server types
  api_key_hash: text('api_key_hash').notNull(), // Argon2 hashed API key for satellite authentication
  last_heartbeat: integer('last_heartbeat', { mode: 'timestamp' }), // Timestamp of last communication
  system_info: text('system_info'), // JSON: Hardware and OS information
  config: text('config'), // JSON: Satellite-specific configuration and policies
  created_by: text('created_by').notNull().references(() => authUser.id),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  satelliteTypeIdx: index('satellites_type_idx').on(table.satellite_type),
  teamIdx: index('satellites_team_idx').on(table.team_id),
  statusIdx: index('satellites_status_idx').on(table.status),
  lastHeartbeatIdx: index('satellites_last_heartbeat_idx').on(table.last_heartbeat),
  // Unique satellite names per team (global satellites have NULL team_id)
  uniqueTeamName: index('satellites_unique_team_name').on(table.team_id, table.name),
}));

// Satellite Registration Tokens - Secure token-based satellite pairing system
export const satelliteRegistrationTokens = sqliteTable('satelliteRegistrationTokens', {
  // Primary identification
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  
  // Token type and scope
  token_type: text('token_type', { enum: ['global', 'team'] }).notNull(),
  team_id: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  
  // Token data (security)
  token_hash: text('token_hash').notNull().unique(), // Argon2 hashed token
  token_prefix: text('token_prefix').notNull(), // 'deploystack_satellite_global_' or 'deploystack_satellite_team_'
  
  // Token metadata
  created_by: text('created_by').notNull().references(() => authUser.id),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull(),
  
  // Token usage tracking
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  used_at: text('used_at'),
  used_by_satellite_id: text('used_by_satellite_id').references(() => satellites.id),
  
  // Expiration and lifecycle
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  
  // Indexes for performance
}, (table) => ({
  tokenHashIdx: index('satelliteRegistrationTokens_token_hash_idx').on(table.token_hash),
  teamScopeIdx: index('satelliteRegistrationTokens_team_scope_idx').on(table.team_id, table.token_type),
  expirationIdx: index('satelliteRegistrationTokens_expiration_idx').on(table.expires_at),
  creatorIdx: index('satelliteRegistrationTokens_creator_idx').on(table.created_by),
  usageIdx: index('satelliteRegistrationTokens_usage_idx').on(table.used, table.used_at),
}));

// Command Queue Management - Priority-based command queue for satellite orchestration
export const satelliteCommands = sqliteTable('satelliteCommands', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  command_type: text('command_type', { 
    enum: ['spawn', 'kill', 'restart', 'configure', 'health_check'] 
  }).notNull(),
  priority: text('priority', { enum: ['immediate', 'high', 'normal', 'low'] }).notNull().default('normal'),
  payload: text('payload').notNull(), // JSON command data with team context
  status: text('status', { 
    enum: ['pending', 'acknowledged', 'executing', 'completed', 'failed'] 
  }).notNull().default('pending'),
  target_team_id: text('target_team_id').references(() => teams.id), // Team context for command execution
  correlation_id: text('correlation_id'), // For request tracing across systems
  retry_count: integer('retry_count').notNull().default(0), // Number of retry attempts
  max_retries: integer('max_retries').notNull().default(3), // Maximum retry attempts
  error_message: text('error_message'), // Error details for failed commands
  result: text('result'), // JSON result data from satellite
  created_by: text('created_by').references(() => authUser.id), // User who initiated the command
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  satelliteStatusIdx: index('satellite_commands_satellite_status_idx').on(table.satellite_id, table.status),
  priorityStatusIdx: index('satellite_commands_priority_status_idx').on(table.priority, table.status),
  correlationIdx: index('satellite_commands_correlation_idx').on(table.correlation_id),
  targetTeamIdx: index('satellite_commands_target_team_idx').on(table.target_team_id),
}));

// Process Tracking - Real-time tracking of MCP server processes running on satellites
export const satelliteProcesses = sqliteTable('satelliteProcesses', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  installation_id: text('installation_id').references(() => mcpServerInstallations.id, { onDelete: 'cascade' }), // Links to existing MCP system
  server_name: text('server_name').notNull(), // MCP server name for identification
  process_pid: integer('process_pid'), // Process ID on satellite system
  local_port: integer('local_port'), // Local port for HTTP communication
  status: text('status', { 
    enum: ['pending', 'starting', 'running', 'stopping', 'stopped', 'failed'] 
  }).notNull().default('pending'),
  health_status: text('health_status', { 
    enum: ['healthy', 'unhealthy', 'unknown'] 
  }).notNull().default('unknown'),
  performance_metrics: text('performance_metrics'), // JSON: CPU, memory, response time tracking
  team_id: text('team_id').notNull().references(() => teams.id), // Denormalized team context for performance
  error_message: text('error_message'), // Error details for failed processes
  started_at: integer('started_at', { mode: 'timestamp' }),
  stopped_at: integer('stopped_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  satelliteStatusIdx: index('satellite_processes_satellite_status_idx').on(table.satellite_id, table.status),
  teamStatusIdx: index('satellite_processes_team_status_idx').on(table.team_id, table.status),
  healthStatusIdx: index('satellite_processes_health_status_idx').on(table.health_status),
  installationIdx: index('satellite_processes_installation_idx').on(table.installation_id),
}));

// Usage Analytics and Audit - Comprehensive usage logging for analytics and compliance
export const satelliteUsageLogs = sqliteTable('satelliteUsageLogs', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => authUser.id), // User attribution (may be NULL for system requests)
  team_id: text('team_id').notNull().references(() => teams.id), // Team context
  process_id: text('process_id').references(() => satelliteProcesses.id), // Associated process
  request_method: text('request_method').notNull(), // HTTP method (GET, POST, etc.)
  request_path: text('request_path').notNull(), // Request path/endpoint
  tool_name: text('tool_name'), // MCP tool name if applicable
  duration_ms: integer('duration_ms'), // Request duration in milliseconds
  status_code: integer('status_code'), // HTTP status code
  error_message: text('error_message'), // Error details for failed requests
  request_size_bytes: integer('request_size_bytes'), // Request payload size
  response_size_bytes: integer('response_size_bytes'), // Response payload size
  user_agent: text('user_agent'), // Client user agent
  ip_address: text('ip_address'), // Client IP address (if available)
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  date_partition: text('date_partition').notNull(), // YYYY-MM-DD for efficient partitioning
}, (table) => ({
  satelliteTimestampIdx: index('satellite_usage_logs_satellite_timestamp_idx').on(table.satellite_id, table.timestamp),
  teamTimestampIdx: index('satellite_usage_logs_team_timestamp_idx').on(table.team_id, table.timestamp),
  userTimestampIdx: index('satellite_usage_logs_user_timestamp_idx').on(table.user_id, table.timestamp),
  datePartitionIdx: index('satellite_usage_logs_date_partition_idx').on(table.date_partition),
  toolNameIdx: index('satellite_usage_logs_tool_name_idx').on(table.tool_name),
}));

// Health Monitoring - Real-time health monitoring and system metrics
export const satelliteHeartbeats = sqliteTable('satelliteHeartbeats', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['active', 'degraded', 'error'] }).notNull(),
  system_metrics: text('system_metrics').notNull(), // JSON: CPU, memory, disk, network usage
  process_count: integer('process_count').notNull().default(0), // Number of running MCP processes
  healthy_process_count: integer('healthy_process_count').notNull().default(0), // Number of healthy processes
  error_count: integer('error_count').notNull().default(0), // Recent error count
  response_time_ms: integer('response_time_ms'), // Communication latency with backend
  uptime_seconds: integer('uptime_seconds'), // Satellite uptime
  version: text('version'), // Satellite software version
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  satelliteTimestampIdx: index('satellite_heartbeats_satellite_timestamp_idx').on(table.satellite_id, table.timestamp),
  statusIdx: index('satellite_heartbeats_status_idx').on(table.status),
  timestampIdx: index('satellite_heartbeats_timestamp_idx').on(table.timestamp),
}));

// Dynamic OAuth2 Client Registration - RFC 7591 compliant storage
export const dynamicOauthClients = sqliteTable('dynamic_oauth_clients', {
  client_id: text('client_id').primaryKey(),
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(), // JSON array
  grant_types: text('grant_types').notNull(), // JSON array  
  response_types: text('response_types').notNull(), // JSON array
  scope: text('scope').notNull(),
  token_endpoint_auth_method: text('token_endpoint_auth_method').notNull(),
  client_id_issued_at: integer('client_id_issued_at').notNull(),
  expires_at: integer('expires_at'), // Optional expiration timestamp
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  expiresAtIdx: index('dynamic_oauth_clients_expires_at_idx').on(table.expires_at),
  createdAtIdx: index('dynamic_oauth_clients_created_at_idx').on(table.created_at),
}));

// Background Job Queue System - Persistent job processing with retry logic
export const queueJobBatches = sqliteTable('queueJobBatches', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  type: text('type').notNull(),
  total_jobs: integer('total_jobs').notNull(),
  completed_jobs: integer('completed_jobs').notNull().default(0),
  failed_jobs: integer('failed_jobs').notNull().default(0),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  metadata: text('metadata'), // JSON
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  statusIdx: index('job_batches_status_idx').on(table.status),
  createdAtIdx: index('job_batches_created_at_idx').on(table.created_at),
}));

export const queueJobs = sqliteTable('queueJobs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  type: text('type').notNull(),
  payload: text('payload').notNull(), // JSON
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  scheduled_for: integer('scheduled_for', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  attempts: integer('attempts').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  batch_id: text('batch_id').references(() => queueJobBatches.id, { onDelete: 'cascade' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  statusScheduledIdx: index('jobs_status_scheduled_idx').on(table.status, table.scheduled_for),
  typeIdx: index('jobs_type_idx').on(table.type),
  createdAtIdx: index('jobs_created_at_idx').on(table.created_at),
  batchIdIdx: index('jobs_batch_id_idx').on(table.batch_id),
}));

// MCP Client Activity Tracking - Personal dashboard feature tracking user's active MCP clients
export const mcpClientActivity = sqliteTable('mcpClientActivity', {
  id: text('id').primaryKey(),
  
  // Who and where
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  
  // Authentication (extensible for future)
  auth_type: text('auth_type', { enum: ['oauth', 'api_key'] }).notNull(),
  oauth_client_id: text('oauth_client_id'), // References dynamicOauthClients.client_id (nullable for API keys)
  api_key_id: text('api_key_id'), // Future: references to API key table (nullable for OAuth)
  auth_identifier: text('auth_identifier').notNull(), // Computed: 'oauth:{client_id}' or 'apikey:{key_id}'
  
  // Client identification
  client_name: text('client_name'), // "VS Code", "Cursor", "Claude.ai" (derived from dynamicOauthClients.client_name)
  user_agent: text('user_agent'),
  ip_address: text('ip_address'),
  
  // Session tracking (optional - for debugging with Mcp-Session-Id header)
  current_session_id: text('current_session_id'), // Latest Mcp-Session-Id if provided by client (debug only)
  
  // Activity tracking
  first_seen_at: integer('first_seen_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_activity_at: integer('last_activity_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  total_requests: integer('total_requests').notNull().default(0),
  total_tool_calls: integer('total_tool_calls').notNull().default(0),
  
  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  // Primary indexes for dashboard queries
  userTeamSatelliteIdx: index('mcp_activity_user_team_satellite_idx').on(
    table.user_id, table.team_id, table.satellite_id
  ),
  lastActivityIdx: index('mcp_activity_last_activity_idx').on(table.last_activity_at),
  teamActivityIdx: index('mcp_activity_team_activity_idx').on(table.team_id, table.last_activity_at),
  
  // Auth lookup indexes
  oauthClientIdx: index('mcp_activity_oauth_client_idx').on(table.oauth_client_id),
  apiKeyIdx: index('mcp_activity_api_key_idx').on(table.api_key_id),
  authTypeIdx: index('mcp_activity_auth_type_idx').on(table.auth_type),
  authIdentifierIdx: index('mcp_activity_auth_identifier_idx').on(table.auth_identifier),
  
  // Session tracking (debug only)
  sessionIdx: index('mcp_activity_session_idx').on(table.current_session_id),
  
  // Unique constraint: one row per user/team/auth_identifier/satellite
  uniqueUserTeamAuthSatellite: index('mcp_activity_unique_user_team_auth_satellite').on(
    table.user_id, 
    table.team_id, 
    table.auth_identifier, // Always non-NULL (computed field)
    table.satellite_id
  ),
}));

// MCP Client Activity Metrics - Time-series metrics for activity tracking
export const mcpClientActivityMetrics = sqliteTable('mcpClientActivityMetrics', {
  id: text('id').primaryKey(),
  
  // Context
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  auth_identifier: text('auth_identifier').notNull(),
  
  // Time bucket
  bucket_timestamp: integer('bucket_timestamp').notNull(),
  bucket_interval: text('bucket_interval', { enum: ['15m', '1h'] }).notNull(),
  
  // Metrics
  request_count: integer('request_count').notNull().default(0),
  tool_call_count: integer('tool_call_count').notNull().default(0),
  active_client_count: integer('active_client_count').notNull().default(0),
  
  // Timestamps
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  // Primary index for fast lookups by user/team/time
  lookupIdx: index('mcp_activity_metrics_lookup_idx').on(
    table.user_id,
    table.team_id,
    table.bucket_timestamp,
    table.bucket_interval
  ),
  
  // Time-based index for range queries and cleanup
  timeIdx: index('mcp_activity_metrics_time_idx').on(table.bucket_timestamp),
  
  // Satellite index for satellite-specific queries
  satelliteIdx: index('mcp_activity_metrics_satellite_idx').on(
    table.satellite_id,
    table.bucket_timestamp
  ),
  
  // Composite unique constraint
  uniqueBucket: index('mcp_activity_metrics_unique_bucket').on(
    table.user_id,
    table.team_id,
    table.satellite_id,
    table.auth_identifier,
    table.bucket_timestamp,
    table.bucket_interval
  ),
}));

// Plugin table definitions - populated dynamically by the plugin system
// This object will hold definitions for plugin tables, to be populated dynamically.
// Key: Table name (e.g., 'myPlugin_myTable')
// Value: Column definitions object (e.g., { id: (b:any)=>b('id'), name: (b:any)=>b('name') })
export const pluginTableDefinitions: Record<string, Record<string, (columnBuilder: any) => any>> = {};
