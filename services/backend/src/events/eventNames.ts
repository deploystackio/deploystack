/**
 * Event name constants for the DeployStack Global Event Bus
 * 
 * Event names are aligned with the existing permission structure:
 * - users.* permissions → user.* events
 * - teams.* permissions → team.* events
 * - settings.* permissions → settings.* events
 * - mcp.* permissions → mcp.* events
 */

export const EVENT_NAMES = {
  // User Events (aligned with users.* permissions)
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATED: 'user.created',        // matches users.create permission
  USER_UPDATED: 'user.updated',        // matches users.edit permission
  USER_DELETED: 'user.deleted',        // matches users.delete permission
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_EMAIL_VERIFIED: 'user.email_verified',

  // Team Events (aligned with teams.* permissions)
  TEAM_CREATED: 'team.created',        // matches teams.create permission
  TEAM_UPDATED: 'team.updated',        // matches teams.edit permission
  TEAM_DELETED: 'team.deleted',        // matches teams.delete permission
  TEAM_MEMBER_ADDED: 'team.member_added',
  TEAM_MEMBER_REMOVED: 'team.member_removed',

  // Settings Events (aligned with settings.* permissions)
  SETTINGS_UPDATED: 'settings.updated', // matches settings.edit permission
  SETTINGS_DELETED: 'settings.deleted', // matches settings.delete permission
  SETTINGS_GROUP_CREATED: 'settings.group_created',

  // MCP Events (aligned with mcp.* permissions)
  MCP_INSTALLATION_CREATED: 'mcp.installation_created', // matches mcp.installations.create
  MCP_INSTALLATION_UPDATED: 'mcp.installation_updated', // matches mcp.installations.edit
  MCP_INSTALLATION_DELETED: 'mcp.installation_deleted', // matches mcp.installations.delete
  MCP_SERVER_CREATED: 'mcp.server_created',             // matches mcp.servers.create
  MCP_SERVER_UPDATED: 'mcp.server_updated',             // matches mcp.servers.edit
  MCP_SERVER_DELETED: 'mcp.server_deleted',             // matches mcp.servers.delete
  MCP_DEPLOYMENT_CREATED: 'mcp.deployment_created',     // matches mcp.servers.deploy permission
  MCP_DEPLOYMENT_SUCCEEDED: 'mcp.deployment_succeeded', // deployment completed successfully
  MCP_DEPLOYMENT_FAILED: 'mcp.deployment_failed',       // deployment failed with error

  // Satellite Events (aligned with satellites.* permissions)
  SATELLITE_UPDATED: 'satellite.updated',               // matches satellites.manage permission
  SATELLITE_DELETED: 'satellite.deleted',               // matches satellites.delete permission

  // System Events
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
} as const;

// Type-safe event names
export type EventName = typeof EVENT_NAMES[keyof typeof EVENT_NAMES];
