// MCP Server Instances - Per-user instance status tracking

import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { mcpServerInstallations } from './mcp-installations';
import { authUser } from './auth';

// MCP Server Instances - Tracks per-user instance status separately from installations
// Each user in a team gets their own instance of an installation with their merged 3-tier config
export const mcpServerInstances = pgTable('mcpServerInstances', {
  id: text('id').primaryKey(),
  installation_id: text('installation_id').notNull().references(() => mcpServerInstallations.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),

  // Status tracking (per-user instance status)
  status: text('status').notNull().default('provisioning'), // 'provisioning' | 'command_received' | 'connecting' | 'discovering_tools' | 'syncing_tools' | 'online' | 'restarting' | 'offline' | 'error' | 'requires_reauth' | 'permanently_failed' | 'awaiting_user_config'
  status_message: text('status_message'), // Human-readable status message or error details
  status_updated_at: timestamp('status_updated_at', { withTimezone: true }),
  last_health_check_at: timestamp('last_health_check_at', { withTimezone: true }), // When health was last checked
  last_credential_check_at: timestamp('last_credential_check_at', { withTimezone: true }), // When credentials were last validated (for 15-min checks)

  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationUserIdx: uniqueIndex('mcp_instances_installation_user_idx').on(table.installation_id, table.user_id), // Ensures one instance per user per installation
  userIdx: index('mcp_instances_user_idx').on(table.user_id),
  statusIdx: index('mcp_instances_status_idx').on(table.status),
}));
