 
// Satellite Infrastructure Management Tables

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { authUser } from './auth';
import { teams } from './teams';
import { mcpServerInstallations } from './mcp-installations';

// Satellite Registry - Central registry for all satellites
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
  uniqueTeamName: index('satellites_unique_team_name').on(table.team_id, table.name),
}));

// Satellite Registration Tokens - Secure token-based pairing
export const satelliteRegistrationTokens = sqliteTable('satelliteRegistrationTokens', {
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
}, (table) => ({
  tokenHashIdx: index('satelliteRegistrationTokens_token_hash_idx').on(table.token_hash),
  teamScopeIdx: index('satelliteRegistrationTokens_team_scope_idx').on(table.team_id, table.token_type),
  expirationIdx: index('satelliteRegistrationTokens_expiration_idx').on(table.expires_at),
  creatorIdx: index('satelliteRegistrationTokens_creator_idx').on(table.created_by),
  usageIdx: index('satelliteRegistrationTokens_usage_idx').on(table.used, table.used_at),
}));

// Command Queue - Priority-based command queue for satellite orchestration
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
  retry_count: integer('retry_count').notNull().default(0),
  max_retries: integer('max_retries').notNull().default(3),
  error_message: text('error_message'),
  result: text('result'), // JSON result data from satellite
  created_by: text('created_by').references(() => authUser.id),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  satelliteStatusIdx: index('satellite_commands_satellite_status_idx').on(table.satellite_id, table.status),
  priorityStatusIdx: index('satellite_commands_priority_status_idx').on(table.priority, table.status),
  correlationIdx: index('satellite_commands_correlation_idx').on(table.correlation_id),
  targetTeamIdx: index('satellite_commands_target_team_idx').on(table.target_team_id),
}));

// Process Tracking - Real-time tracking of MCP processes on satellites
export const satelliteProcesses = sqliteTable('satelliteProcesses', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  installation_id: text('installation_id').references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  server_name: text('server_name').notNull(),
  process_pid: integer('process_pid'),
  local_port: integer('local_port'),
  status: text('status', {
    enum: ['pending', 'starting', 'running', 'stopping', 'stopped', 'failed']
  }).notNull().default('pending'),
  health_status: text('health_status', {
    enum: ['healthy', 'unhealthy', 'unknown']
  }).notNull().default('unknown'),
  performance_metrics: text('performance_metrics'), // JSON: CPU, memory, response time
  team_id: text('team_id').notNull().references(() => teams.id),
  error_message: text('error_message'),
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

// Usage Analytics - Comprehensive usage logging
export const satelliteUsageLogs = sqliteTable('satelliteUsageLogs', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => authUser.id),
  team_id: text('team_id').notNull().references(() => teams.id),
  process_id: text('process_id').references(() => satelliteProcesses.id),
  request_method: text('request_method').notNull(),
  request_path: text('request_path').notNull(),
  tool_name: text('tool_name'),
  duration_ms: integer('duration_ms'),
  status_code: integer('status_code'),
  error_message: text('error_message'),
  request_size_bytes: integer('request_size_bytes'),
  response_size_bytes: integer('response_size_bytes'),
  user_agent: text('user_agent'),
  ip_address: text('ip_address'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  date_partition: text('date_partition').notNull(), // YYYY-MM-DD for partitioning
}, (table) => ({
  satelliteTimestampIdx: index('satellite_usage_logs_satellite_timestamp_idx').on(table.satellite_id, table.timestamp),
  teamTimestampIdx: index('satellite_usage_logs_team_timestamp_idx').on(table.team_id, table.timestamp),
  userTimestampIdx: index('satellite_usage_logs_user_timestamp_idx').on(table.user_id, table.timestamp),
  datePartitionIdx: index('satellite_usage_logs_date_partition_idx').on(table.date_partition),
  toolNameIdx: index('satellite_usage_logs_tool_name_idx').on(table.tool_name),
}));

// Health Monitoring - Real-time health and system metrics
export const satelliteHeartbeats = sqliteTable('satelliteHeartbeats', {
  id: text('id').primaryKey(),
  satellite_id: text('satellite_id').notNull().references(() => satellites.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['active', 'degraded', 'error'] }).notNull(),
  system_metrics: text('system_metrics').notNull(), // JSON: CPU, memory, disk, network
  process_count: integer('process_count').notNull().default(0),
  healthy_process_count: integer('healthy_process_count').notNull().default(0),
  error_count: integer('error_count').notNull().default(0),
  response_time_ms: integer('response_time_ms'),
  uptime_seconds: integer('uptime_seconds'),
  version: text('version'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  satelliteTimestampIdx: index('satellite_heartbeats_satellite_timestamp_idx').on(table.satellite_id, table.timestamp),
  statusIdx: index('satellite_heartbeats_status_idx').on(table.status),
  timestampIdx: index('satellite_heartbeats_timestamp_idx').on(table.timestamp),
}));
