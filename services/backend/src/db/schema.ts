/* eslint-disable @typescript-eslint/no-explicit-any */
// SINGLE SOURCE OF TRUTH FOR DATABASE SCHEMA
// This file is the definitive schema definition for the DeployStack backend.
// Database: PostgreSQL only
//
// It is used by:
// - Drizzle Kit for generating migrations (npm run db:generate)
// - The application runtime for table definitions and type safety
// - All database operations and queries
//
// IMPORTANT: When making schema changes:
// 1. Edit table files in schema-tables/ directory
// 2. Run `npm run db:generate` to create migrations
// 3. The changes will be automatically applied on next server start

// =============================================================================
// SCHEMA ORGANIZATION
// =============================================================================
// Tables are organized into logical groups in the schema-tables/ directory:
//
// - auth.ts               - Authentication and authorization (roles, users, sessions, tokens)
// - teams.ts              - Team management and user preferences
// - settings.ts           - Global settings and team credentials
// - mcp-catalog.ts        - MCP server catalog (categories, servers, versions)
// - mcp-installations.ts  - MCP installations and user configurations
// - oauth.ts              - OAuth2 authorization system
// - satellites.ts         - Satellite infrastructure management
// - jobs.ts               - Background job queue system
// - mcp-activity.ts       - MCP client activity tracking
//
// =============================================================================

// Authentication and Authorization Tables
export {
  roles,
  authUser,
  authSession,
  authKey,
  emailVerificationTokens,
  passwordResetTokens,
} from './schema-tables/auth';

// Team and User Preference Tables
export {
  teams,
  teamMemberships,
  userPreferences,
} from './schema-tables/teams';

// Global Settings and Team Credentials Tables
export {
  globalSettingGroups,
  globalSettings,
  teamCloudCredentials,
} from './schema-tables/settings';

// MCP Server Catalog Tables
export {
  mcpCategories,
  mcpServers,
  mcpServerVersions,
} from './schema-tables/mcp-catalog';

// MCP Installation and Configuration Tables
export {
  mcpOauthProviders,
  mcpServerInstallations,
  mcpUserConfigurations,
  mcpToolMetadata,
  mcpOauthTokens,
} from './schema-tables/mcp-installations';

// OAuth2 Authorization System Tables
export {
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthClients,
  oauthTeamConsents,
  dynamicOauthClients,
} from './schema-tables/oauth';

// Satellite Infrastructure Management Tables
export {
  satellites,
  satelliteRegistrationTokens,
  satelliteCommands,
  satelliteProcesses,
  satelliteUsageLogs,
  satelliteHeartbeats,
} from './schema-tables/satellites';

// Background Job Queue System Tables
export {
  queueJobBatches,
  queueJobs,
} from './schema-tables/jobs';

// MCP Client Activity Tracking Tables
export {
  mcpClientActivity,
  mcpClientActivityMetrics,
} from './schema-tables/mcp-activity';

// Plugin table definitions - populated dynamically by the plugin system
// This object will hold definitions for plugin tables, to be populated dynamically.
// Key: Table name (e.g., 'myPlugin_myTable')
// Value: Column definitions object (e.g., { id: (b:any)=>b('id'), name: (b:any)=>b('name') })
export const pluginTableDefinitions: Record<string, Record<string, (columnBuilder: any) => any>> = {};
