
// OAuth2 Authorization System Tables

import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { authUser } from './auth';
import { teams } from './teams';

// OAuth2 Authorization Codes - PKCE flow codes (Team-Aware)
export const oauthAuthorizationCodes = pgTable('oauth_authorization_codes', {
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
  resource: text('resource'), // RFC 8707 Resource Indicator for audience binding
  used: boolean('used').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// OAuth2 Access Tokens (Team-Aware)
export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }), // Team context for token
  client_id: text('client_id').notNull(),
  scope: text('scope').notNull(),
  token_hash: text('token_hash').notNull().unique(), // Argon2 hash of the token
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// OAuth2 Refresh Tokens (Team-Aware)
export const oauthRefreshTokens = pgTable('oauth_refresh_tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }), // Team context for refresh token
  client_id: text('client_id').notNull(),
  token_hash: text('token_hash').notNull().unique(), // Argon2 hash of the token
  used: boolean('used').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// OAuth2 Client Management - Team-Aware MCP Clients
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(),
  client_id: text('client_id').notNull().unique(),
  client_secret_hash: text('client_secret_hash'), // Argon2 hash (NULL for public clients)
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(), // JSON array of allowed redirect URIs
  scope: text('scope').notNull(), // Default scopes for this client
  team_id: text('team_id').references(() => teams.id), // NULL for global clients
  created_by_user_id: text('created_by_user_id').references(() => authUser.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clientIdIdx: index('oauth_clients_client_id_idx').on(table.client_id),
  teamIdx: index('oauth_clients_team_idx').on(table.team_id),
  activeIdx: index('oauth_clients_active_idx').on(table.is_active),
}));

// OAuth2 Team Consents - User consent per team per client
export const oauthTeamConsents = pgTable('oauth_team_consents', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  client_id: text('client_id').notNull(),
  scope: text('scope').notNull(), // Consented scopes
  granted_at: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
  is_active: boolean('is_active').notNull().default(true),
}, (table) => ({
  userTeamClientIdx: index('oauth_team_consents_user_team_client_idx').on(table.user_id, table.team_id, table.client_id),
  teamIdx: index('oauth_team_consents_team_idx').on(table.team_id),
  clientIdx: index('oauth_team_consents_client_idx').on(table.client_id),
  activeIdx: index('oauth_team_consents_active_idx').on(table.is_active),
  uniqueUserTeamClient: index('oauth_team_consents_unique_user_team_client').on(table.user_id, table.team_id, table.client_id),
}));

// Dynamic OAuth2 Client Registration - RFC 7591 compliant
export const dynamicOauthClients = pgTable('dynamic_oauth_clients', {
  client_id: text('client_id').primaryKey(),
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(), // JSON array
  grant_types: text('grant_types').notNull(), // JSON array
  response_types: text('response_types').notNull(), // JSON array
  scope: text('scope').notNull(),
  token_endpoint_auth_method: text('token_endpoint_auth_method').notNull(),
  client_id_issued_at: integer('client_id_issued_at').notNull(),
  expires_at: integer('expires_at'), // Optional expiration timestamp
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  expiresAtIdx: index('dynamic_oauth_clients_expires_at_idx').on(table.expires_at),
  createdAtIdx: index('dynamic_oauth_clients_created_at_idx').on(table.created_at),
}));
