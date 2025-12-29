/**
 * Centralized Permission Registry
 * 
 * This is the single source of truth for all permissions and role definitions.
 * All other files should import from this module to ensure consistency.
 */

// Define all role permissions in one place
export const ROLE_DEFINITIONS = {
  global_admin: [
    'users.view',
    'users.create',
    'roles.manage',
    'system.admin',
    'settings.view',
    'settings.edit',
    'settings.delete',
    'teams.create',
    'teams.view',
    'teams.edit',
    'teams.delete',
    'teams.manage',
    'team.members.view',
    'team.members.manage',
    'mcp.categories.view',
    'mcp.categories.create',
    'mcp.categories.edit',
    'mcp.categories.delete',
    'mcp.servers.read',
    'mcp.servers.global.view',
    'mcp.servers.global.create',
    'mcp.servers.global.edit',
    'mcp.servers.global.delete',
    'mcp.servers.team.view_all',
    'mcp.versions.manage',
    'mcp.installations.view_all',
    'mcp.installations.view',
    'mcp.installations.create',
    'mcp.installations.edit',
    'mcp.installations.delete',
    'mcp.tools.view',
    'mcp.tools.stats.view',
    'mcp.tools.manage',
    'email.test',
    'preferences.view',
    'preferences.edit',
    'satellites.view',
    'satellites.manage',
    'satellites.revoke',
    'jobs.view',
    'jobs.monitor',
    'jobs.manage',
    'mcp.registry.sync',
    'metrics.mcp_client_activity_metrics.view',
  ],
  global_user: [
    'profile.view',
    'profile.edit',
    'teams.create',
    'teams.view',
    'teams.edit',
    'teams.delete',
    'team.members.view',
    'mcp.servers.read',
    'mcp.categories.view',
    'preferences.view',
    'preferences.edit',
    'metrics.mcp_client_activity_metrics.view',
  ],
  team_admin: [
    'teams.view',
    'teams.edit',
    'teams.delete',
    'teams.manage',
    'team.members.view',
    'team.members.manage',
    'team.usage.view',
    'cloud_credentials.view',
    'cloud_credentials.create',
    'cloud_credentials.edit',
    'cloud_credentials.delete',
    'mcp.servers.read',
    'mcp.installations.view',
    'mcp.installations.create',
    'mcp.installations.edit',
    'mcp.installations.delete',
    'mcp.tools.view',
    'mcp.tools.stats.view',
    'mcp.tools.manage',
    'satellites.team.view',
  ],
  team_user: [
    'teams.view',
    'team.members.view',
    'team.usage.view',
    'cloud_credentials.view',
    'mcp.servers.read',
    'mcp.installations.view',
    'mcp.tools.view',
    'mcp.tools.stats.view',
    'satellites.team.view',
  ],
} as const;

// Auto-generate available permissions from all role definitions
export const AVAILABLE_PERMISSIONS = [
  ...new Set(
    Object.values(ROLE_DEFINITIONS).flat()
  )
].sort();

// Export types for TypeScript
export type RoleId = keyof typeof ROLE_DEFINITIONS;
export type Permission = typeof AVAILABLE_PERMISSIONS[number];

// Helper functions
export function getRolePermissions(roleId: RoleId): string[] {
  return [...ROLE_DEFINITIONS[roleId]];
}

export function getAllRoleDefinitions(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [roleId, permissions] of Object.entries(ROLE_DEFINITIONS)) {
    result[roleId] = [...permissions];
  }
  return result;
}

export function isValidPermission(permission: string): permission is Permission {
  return (AVAILABLE_PERMISSIONS as readonly string[]).includes(permission);
}

export function isValidRole(roleId: string): roleId is RoleId {
  return roleId in ROLE_DEFINITIONS;
}
