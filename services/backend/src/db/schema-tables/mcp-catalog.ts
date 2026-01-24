
// MCP Server Catalog Tables

import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { authUser } from './auth';
import { teams } from './teams';

// MCP Categories - Organize MCP servers by category
export const mcpCategories = pgTable('mcpCategories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'), // Icon name/class for UI
  sort_order: integer('sort_order').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// MCP Servers - Main catalog of available MCP servers
export const mcpServers = pgTable('mcpServers', {
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
  git_branch: text('git_branch'), // Git branch - no default, only set when repository_url exists
  git_commit_sha: text('git_commit_sha'), // Git commit SHA for GitHub deployments
  website_url: text('website_url'),
  icon_url: text('icon_url'), // Icon/logo URL for display in frontend

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
  template_url_query_params: text('template_url_query_params'), // JSON: [{"name":"token", "value":"fixed_token_value", "locked":true, "description":"..."}]

  // Team Level Schema (what teams can configure)
  team_args_schema: text('team_args_schema'), // JSON: [{name, type, required, description}]
  team_env_schema: text('team_env_schema'), // JSON: [{name, type, required, description}]
  team_headers_schema: text('team_headers_schema'), // JSON: [{name, type, required, description}]
  team_url_query_params_schema: text('team_url_query_params_schema'), // JSON: [{name, type, required, description}]

  // User Level Schema (what individual users can configure)
  user_args_schema: text('user_args_schema'), // JSON: [{name, type, required, description, min_items, max_items}]
  user_env_schema: text('user_env_schema'), // JSON: [{name, type, required, description}]
  user_headers_schema: text('user_headers_schema'), // JSON: [{name, type, required, description}]
  user_url_query_params_schema: text('user_url_query_params_schema'), // JSON: [{name, type, required, description}]

  dependencies: text('dependencies'), // JSON of dependencies

  meta_extensions: text('meta_extensions'), // JSON object for _meta field

  // Metadata & Status
  category_id: text('category_id').references(() => mcpCategories.id),
  tags: text('tags'), // JSON array: ["browser", "automation", "testing"]
  status: text('status').notNull().default('active'), // 'active', 'deprecated', 'maintenance', 'disabled'
  featured: boolean('featured').notNull().default(false),
  auto_install_new_default_team: boolean('auto_install_new_default_team').notNull().default(false),

  // Source Tracking
  source: text('source', { enum: ['official_registry', 'manual', 'github'] }).notNull().default('manual'),

  // Official Registry Sync Tracking
  synced_from_official_registry: boolean('synced_from_official_registry').notNull().default(false),
  official_registry_server_id: text('official_registry_server_id'),
  official_registry_version_id: text('official_registry_version_id'),
  official_registry_published_at: timestamp('official_registry_published_at', { withTimezone: true }),
  official_registry_updated_at: timestamp('official_registry_updated_at', { withTimezone: true }),

  // OAuth Support
  requires_oauth: boolean('requires_oauth').notNull().default(false),

  // Health Check Status (for cumulative health checks at template level)
  health_status: text('health_status').notNull().default('unknown'), // 'unknown' | 'online' | 'offline'
  last_health_check_at: timestamp('last_health_check_at', { withTimezone: true }), // When health was last checked
  health_check_error: text('health_check_error'), // Error message if offline

  // Timestamps
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  last_sync_at: timestamp('last_sync_at', { withTimezone: true }), // Last GitHub sync
}, (table) => ({
  visibilityIdx: index('mcp_servers_visibility_idx').on(table.visibility),
  categoryIdx: index('mcp_servers_category_idx').on(table.category_id),
  statusIdx: index('mcp_servers_status_idx').on(table.status),
  ownerTeamIdx: index('mcp_servers_owner_team_idx').on(table.owner_team_id),
  officialNameIdx: index('mcp_servers_official_name_idx').on(table.official_name),
  sourceIdx: index('mcp_servers_source_idx').on(table.source),
  syncedFlagIdx: index('mcp_servers_synced_flag_idx').on(table.synced_from_official_registry),
  registryServerIdIdx: index('mcp_servers_registry_server_id_idx').on(table.official_registry_server_id),
  repositoryUrlIdx: index('mcp_servers_repository_url_idx').on(table.repository_url),
}));

// MCP Server Versions - Track releases/versions
export const mcpServerVersions = pgTable('mcpServerVersions', {
  id: text('id').primaryKey(),
  server_id: text('server_id').notNull().references(() => mcpServers.id, { onDelete: 'cascade' }),
  version: text('version').notNull(), // 0.0.29, 1.2.3
  git_commit: text('git_commit'), // GitHub commit hash
  changelog: text('changelog'), // Release notes
  is_latest: boolean('is_latest').notNull().default(false),
  is_stable: boolean('is_stable').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverVersionIdx: index('mcp_server_versions_server_idx').on(table.server_id),
  latestIdx: index('mcp_server_versions_latest_idx').on(table.is_latest),
}));
