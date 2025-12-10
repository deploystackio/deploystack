
// MCP Installation and Configuration Tables

import { pgTable, text, integer, boolean, timestamp, index, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { authUser } from './auth';
import { teams } from './teams';
import { mcpServers } from './mcp-catalog';

// MCP OAuth Providers - Pre-registered OAuth providers for non-DCR auth servers (GitHub, Google, etc.)
export const mcpOauthProviders = pgTable('mcpOauthProviders', {
  id: text('id').primaryKey(),

  // Provider identity
  name: text('name').notNull(), // Display name: "GitHub", "Google"
  slug: text('slug').notNull(), // Identifier: "github", "google"
  icon_url: text('icon_url'), // Provider logo URL

  // Authorization server matching
  auth_server_patterns: text('auth_server_patterns').notNull(), // JSON array of regex patterns to match auth server URLs

  // OAuth credentials (pre-registered with provider)
  client_id: text('client_id').notNull(), // OAuth App client ID
  client_secret: text('client_secret'), // Encrypted client_secret (NULL for public clients)

  // OAuth endpoints
  authorization_endpoint: text('authorization_endpoint').notNull(), // e.g., "https://github.com/login/oauth/authorize"
  token_endpoint: text('token_endpoint').notNull(), // e.g., "https://github.com/login/oauth/access_token"

  // OAuth configuration
  default_scopes: text('default_scopes'), // JSON array of default scopes
  pkce_required: boolean('pkce_required').notNull().default(true),
  token_endpoint_auth_method: text('token_endpoint_auth_method').notNull().default('client_secret_post'), // 'client_secret_post', 'client_secret_basic', 'none'

  // Status
  enabled: boolean('enabled').notNull().default(true),

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('mcp_oauth_providers_slug_idx').on(table.slug),
  enabledIdx: index('mcp_oauth_providers_enabled_idx').on(table.enabled),
}));

// MCP Server Installations - Team installations (Tier 2)
export const mcpServerInstallations = pgTable('mcpServerInstallations', {
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
  oauth_pending: boolean('oauth_pending').notNull().default(false), // Installation awaiting OAuth
  oauth_pending_expires_at: timestamp('oauth_pending_expires_at', { withTimezone: true }), // Expiry for pending state

  // OAuth Dynamic Client Registration (RFC 7591)
  oauth_client_id: text('oauth_client_id'), // Dynamically registered client_id from MCP OAuth server
  oauth_client_secret: text('oauth_client_secret'), // Encrypted client_secret (if provided by registration endpoint)

  // Pre-registered OAuth Provider (for non-DCR auth servers like GitHub, Google)
  oauth_provider_id: text('oauth_provider_id').references(() => mcpOauthProviders.id, { onDelete: 'set null' }), // Reference to pre-registered provider
  oauth_token_endpoint: text('oauth_token_endpoint'), // Stored token endpoint for callback handler
  oauth_token_endpoint_auth_method: text('oauth_token_endpoint_auth_method'), // Auth method for token exchange

  // Installation Status Tracking
  status: text('status').notNull().default('provisioning'), // 'provisioning' | 'command_received' | 'connecting' | 'discovering_tools' | 'syncing_tools' | 'online' | 'offline' | 'error' | 'requires_reauth' | 'permanently_failed'
  status_message: text('status_message'), // Human-readable status message or error details
  status_updated_at: timestamp('status_updated_at', { withTimezone: true }).notNull().defaultNow(),
  last_health_check_at: timestamp('last_health_check_at', { withTimezone: true }), // When health was last checked
  last_credential_check_at: timestamp('last_credential_check_at', { withTimezone: true }), // When credentials were last validated (for 15-min checks)

  // Metadata
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  teamInstallationNameIdx: index('mcp_installations_team_name_idx').on(table.team_id, table.installation_name),
  teamServerIdx: index('mcp_installations_team_server_idx').on(table.team_id, table.server_id),
  createdByIdx: index('mcp_installations_created_by_idx').on(table.created_by),
  statusIdx: index('mcp_installations_status_idx').on(table.status), // For querying by status
}));

// MCP User Configurations - Individual user configurations per installation (Tier 3)
export const mcpUserConfigurations = pgTable('mcpUserConfigurations', {
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
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  installationUserIdx: index('mcp_user_configs_installation_user_idx').on(table.installation_id, table.user_id),
  userIdx: index('mcp_user_configs_user_idx').on(table.user_id),
  installationIdx: index('mcp_user_configs_installation_idx').on(table.installation_id),
  uniqueUserInstallation: index('mcp_user_configs_unique_user_installation').on(table.installation_id, table.user_id),
}));

// MCP Tool Metadata - Stores discovered tools from MCP servers
export const mcpToolMetadata = pgTable('mcpToolMetadata', {
  id: text('id').primaryKey(),

  // References
  installation_id: text('installation_id').notNull().references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),

  // Tool information
  tool_name: text('tool_name').notNull(),
  description: text('description').notNull().default(''),
  input_schema: jsonb('input_schema'), // JSON object stored as jsonb
  token_count: integer('token_count').notNull().default(0),

  // Tool status
  is_disabled: boolean('is_disabled').notNull().default(false),

  // Timestamps
  discovered_at: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationIdx: index('mcp_tool_metadata_installation_idx').on(table.installation_id),
  teamIdx: index('mcp_tool_metadata_team_idx').on(table.team_id),
  uniqueInstallationTool: index('mcp_tool_metadata_unique_installation_tool').on(table.installation_id, table.tool_name),
  disabledIdx: index('mcp_tool_metadata_disabled_idx').on(table.installation_id, table.is_disabled),
}));

// MCP OAuth Tokens - Encrypted OAuth tokens for MCP servers requiring OAuth
export const mcpOauthTokens = pgTable('mcpOauthTokens', {
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
  expires_at: timestamp('expires_at', { withTimezone: true }),
  scope: text('scope'),

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  installationUserTeamIdx: index('mcp_oauth_tokens_installation_user_team_idx').on(
    table.installation_id,
    table.user_id,
    table.team_id
  ),
}));

// MCP Server Logs - Internal server logs (stderr, startup, connection errors)
export const mcpServerLogs = pgTable('mcpServerLogs', {
  id: text('id').primaryKey(),

  // References
  installation_id: text('installation_id').notNull().references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),

  // Log data
  log_type: text('log_type').notNull().default('mcp_server_log'), // Fixed value for this table
  log_level: text('log_level').notNull(), // 'info' | 'warn' | 'error' | 'debug'
  message: text('message').notNull(), // Log message content
  metadata: jsonb('metadata'), // Structured data (nullable)

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationCreatedAtIdx: index('mcp_server_logs_installation_created_idx').on(table.installation_id, table.created_at),
  teamIdx: index('mcp_server_logs_team_idx').on(table.team_id),
  createdAtIdx: index('mcp_server_logs_created_at_idx').on(table.created_at),
}));

// MCP Request Logs - Incoming client tool call requests
export const mcpRequestLogs = pgTable('mcpRequestLogs', {
  id: text('id').primaryKey(),

  // References
  installation_id: text('installation_id').notNull().references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => authUser.id, { onDelete: 'set null' }), // User who made the request (nullable)

  // Request data
  tool_name: text('tool_name').notNull(), // Name of the tool called
  tool_params: jsonb('tool_params'), // Parameters passed to the tool
  response_time_ms: integer('response_time_ms').notNull(), // How long the call took
  success: boolean('success').notNull(), // Whether the call succeeded
  error_message: text('error_message'), // Error if failed (nullable)

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationCreatedAtIdx: index('mcp_request_logs_installation_created_idx').on(table.installation_id, table.created_at),
  teamIdx: index('mcp_request_logs_team_idx').on(table.team_id),
  createdAtIdx: index('mcp_request_logs_created_at_idx').on(table.created_at),
}));
