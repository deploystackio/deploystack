
// MCP Client Activity Tracking Tables

import { pgTable, text, integer, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { authUser } from './auth';
import { teams } from './teams';
import { satellites } from './satellites';

// MCP Client Activity - Personal dashboard tracking active MCP clients
export const mcpClientActivity = pgTable('mcpClientActivity', {
  id: text('id').primaryKey(),

  // Who and where
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),

  // Authentication (extensible for future)
  auth_type: text('auth_type', { enum: ['oauth', 'api_key', 'instance_token'] }).notNull(),
  oauth_client_id: text('oauth_client_id'), // References dynamicOauthClients.client_id
  api_key_id: text('api_key_id'), // Future: references to API key table
  auth_identifier: text('auth_identifier').notNull(), // Computed: 'oauth:{client_id}' or 'apikey:{key_id}'

  // Client identification
  client_name: text('client_name'), // "VS Code", "Cursor", "Claude.ai"
  user_agent: text('user_agent'),
  ip_address: text('ip_address'),

  // Session tracking (optional - debug only)
  current_session_id: text('current_session_id'), // Latest Mcp-Session-Id header

  // Activity tracking
  first_seen_at: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  last_activity_at: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  total_requests: integer('total_requests').notNull().default(0),
  total_tool_calls: integer('total_tool_calls').notNull().default(0),

  // Metadata
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTeamSatelliteIdx: index('mcp_activity_user_team_satellite_idx').on(
    table.user_id, table.team_id, table.satellite_id
  ),
  lastActivityIdx: index('mcp_activity_last_activity_idx').on(table.last_activity_at),
  teamActivityIdx: index('mcp_activity_team_activity_idx').on(table.team_id, table.last_activity_at),
  oauthClientIdx: index('mcp_activity_oauth_client_idx').on(table.oauth_client_id),
  apiKeyIdx: index('mcp_activity_api_key_idx').on(table.api_key_id),
  authTypeIdx: index('mcp_activity_auth_type_idx').on(table.auth_type),
  authIdentifierIdx: index('mcp_activity_auth_identifier_idx').on(table.auth_identifier),
  sessionIdx: index('mcp_activity_session_idx').on(table.current_session_id),
  uniqueUserTeamAuthSatellite: index('mcp_activity_unique_user_team_auth_satellite').on(
    table.user_id,
    table.team_id,
    table.auth_identifier,
    table.satellite_id
  ),
}));

// MCP Client Activity Metrics - Time-series metrics
export const mcpClientActivityMetrics = pgTable('mcpClientActivityMetrics', {
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
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lookupIdx: index('mcp_activity_metrics_lookup_idx').on(
    table.user_id,
    table.team_id,
    table.bucket_timestamp,
    table.bucket_interval
  ),
  timeIdx: index('mcp_activity_metrics_time_idx').on(table.bucket_timestamp),
  satelliteIdx: index('mcp_activity_metrics_satellite_idx').on(
    table.satellite_id,
    table.bucket_timestamp
  ),
  uniqueBucket: unique('mcp_activity_metrics_unique_bucket').on(
    table.user_id,
    table.team_id,
    table.satellite_id,
    table.auth_identifier,
    table.bucket_timestamp,
    table.bucket_interval
  ),
}));
