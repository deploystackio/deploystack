 
// MCP Installation and Configuration Tables

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { authUser } from './auth';
import { teams } from './teams';
import { mcpServers } from './mcp-catalog';

// MCP Server Installations - Team installations (Tier 2)
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
  team_url_query_params: text('team_url_query_params'), // JSON: {"token": "team_api_token"} - team-wide URL query parameters

  // OAuth Flow State
  oauth_state: text('oauth_state'), // State parameter for CSRF protection
  oauth_code_verifier: text('oauth_code_verifier'), // PKCE verifier (stored temporarily)
  oauth_pending: integer('oauth_pending', { mode: 'boolean' }).notNull().default(false), // Installation awaiting OAuth
  oauth_pending_expires_at: integer('oauth_pending_expires_at', { mode: 'timestamp' }), // Expiry for pending state

  // OAuth Dynamic Client Registration (RFC 7591)
  oauth_client_id: text('oauth_client_id'), // Dynamically registered client_id from MCP OAuth server
  oauth_client_secret: text('oauth_client_secret'), // Encrypted client_secret (if provided by registration endpoint)

  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }),
}, (table) => ({
  teamInstallationNameIdx: index('mcp_installations_team_name_idx').on(table.team_id, table.installation_name),
  teamServerIdx: index('mcp_installations_team_server_idx').on(table.team_id, table.server_id),
  createdByIdx: index('mcp_installations_created_by_idx').on(table.created_by),
}));

// MCP User Configurations - Individual user configurations per installation (Tier 3)
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
  user_url_query_params: text('user_url_query_params'), // JSON: {"api_key": "user_personal_api_key"} - user-specific URL query parameters

  // Metadata
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }),
}, (table) => ({
  installationUserIdx: index('mcp_user_configs_installation_user_idx').on(table.installation_id, table.user_id),
  userIdx: index('mcp_user_configs_user_idx').on(table.user_id),
  installationIdx: index('mcp_user_configs_installation_idx').on(table.installation_id),
  uniqueUserInstallation: index('mcp_user_configs_unique_user_installation').on(table.installation_id, table.user_id),
}));

// MCP Tool Metadata - Stores discovered tools from MCP servers
export const mcpToolMetadata = sqliteTable('mcpToolMetadata', {
  id: text('id').primaryKey(),

  // References
  installation_id: text('installation_id').notNull().references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),

  // Tool information
  tool_name: text('tool_name').notNull(),
  description: text('description').notNull().default(''),
  input_schema: text('input_schema', { mode: 'json' }), // JSON object stored as text
  token_count: integer('token_count').notNull().default(0),

  // Timestamps
  discovered_at: integer('discovered_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  installationIdx: index('mcp_tool_metadata_installation_idx').on(table.installation_id),
  teamIdx: index('mcp_tool_metadata_team_idx').on(table.team_id),
  uniqueInstallationTool: index('mcp_tool_metadata_unique_installation_tool').on(table.installation_id, table.tool_name),
}));

// MCP OAuth Tokens - Encrypted OAuth tokens for MCP servers requiring OAuth
export const mcpOauthTokens = sqliteTable('mcpOauthTokens', {
  id: text('id').primaryKey(),

  // Foreign Keys
  installation_id: text('installation_id')
    .notNull()
    .references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  user_id: text('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),

  // Token Data (encrypted using AES-256-GCM)
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token'),

  // Token Metadata
  token_type: text('token_type').notNull().default('Bearer'),
  expires_at: integer('expires_at', { mode: 'timestamp' }),
  scope: text('scope'),

  // Timestamps
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  installationUserTeamIdx: index('mcp_oauth_tokens_installation_user_team_idx').on(
    table.installation_id,
    table.user_id,
    table.team_id
  ),
}));
