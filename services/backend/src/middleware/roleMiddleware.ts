/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { RoleService } from '../services/roleService';
import { TeamService } from '../services/teamService';
import { ROLE_DEFINITIONS } from '../permissions/index';

// FastifyRequest already has user: User | null from authHook
// We'll use the existing type

/**
 * Basic authentication middleware - just checks if user is logged in
 */
export function requireAuthentication() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.user) {
      const errorResponse = {
        success: false,
        error: 'Authentication required'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(401).type('application/json').send(jsonString);
    }
  };
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if user is authenticated
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const roleService = new RoleService();
      
      const hasPermission = await roleService.userHasPermission(request.user.id, permission);
      
      if (!hasPermission) {
        const errorResponse = {
          success: false,
          error: 'Insufficient permissions',
          required_permission: permission
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }
    } catch (error) {
      request.log.error(error, `Error checking user permissions for permission: ${permission}`);
      const errorResponse = {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Middleware to check if user has any of the required permissions
 */
export function requireAnyPermission(permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.user) {
      const errorResponse = {
        success: false,
        error: 'Authentication required'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(401).type('application/json').send(jsonString);
    }

    const roleService = new RoleService();
    
    try {
      for (const permission of permissions) {
        const hasPermission = await roleService.userHasPermission(request.user.id, permission);
        if (hasPermission) {
          return; // User has at least one required permission
        }
      }
      
      const errorResponse = {
        success: false,
        error: 'Insufficient permissions',
        required_permissions: permissions
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(403).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error(error, 'Error checking user permissions');
      const errorResponse = {
        success: false,
        error: 'Internal server error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Middleware to check if user has a specific role
 */
export function requireRole(roleId: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.debug({
      operation: 'role_middleware_check',
      step: 'start',
      requiredRole: roleId,
      userId: request.user?.id
    }, `🔐 Checking if user has required role: ${roleId}`);

    // Check if user is authenticated
    if (!request.user) {
      request.log.warn({
        operation: 'role_middleware_check',
        step: 'auth_check',
        requiredRole: roleId,
        authenticated: false
      }, '❌ User not authenticated');
      
      const errorResponse = {
        success: false,
        error: 'Authentication required'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(401).type('application/json').send(jsonString);
    }

    request.log.debug({
      operation: 'role_middleware_check',
      step: 'auth_check',
      requiredRole: roleId,
      userId: request.user.id,
      authenticated: true
    }, `✅ User authenticated: ${request.user.id}`);

    // Get user's role from database since Lucia User might not have role_id
    const roleService = new RoleService();
    try {
      request.log.debug({
        operation: 'role_middleware_check',
        step: 'get_user_role',
        requiredRole: roleId,
        userId: request.user.id
      }, '📋 Fetching user role from database');

      const userRole = await roleService.getUserRole(request.user.id);
      
      request.log.debug({
        operation: 'role_middleware_check',
        step: 'get_user_role',
        requiredRole: roleId,
        userId: request.user.id,
        userRole: userRole ? { id: userRole.id, name: userRole.name } : null,
        hasRole: !!userRole
      }, `📋 User role retrieved: ${userRole ? `${userRole.name} (${userRole.id})` : 'none'}`);

      if (!userRole || userRole.id !== roleId) {
        request.log.warn({
          operation: 'role_middleware_check',
          step: 'role_check',
          requiredRole: roleId,
          userId: request.user.id,
          userRole: userRole ? { id: userRole.id, name: userRole.name } : null,
          hasRequiredRole: false
        }, `❌ User does not have required role. Required: ${roleId}, User has: ${userRole ? userRole.id : 'none'}`);
        
        const errorResponse = {
          success: false,
          error: 'Insufficient permissions',
          required_role: roleId,
          user_role: userRole ? userRole.id : null
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      request.log.debug({
        operation: 'role_middleware_check',
        step: 'role_check',
        requiredRole: roleId,
        userId: request.user.id,
        userRole: { id: userRole.id, name: userRole.name },
        hasRequiredRole: true
      }, `✅ User has required role: ${userRole.name} (${userRole.id})`);

    } catch (error) {
      request.log.error({
        operation: 'role_middleware_check',
        step: 'error',
        requiredRole: roleId,
        userId: request.user.id,
        error
      }, `❌ Error checking user role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      const errorResponse = {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Middleware to check if user is global admin
 */
export function requireGlobalAdmin() {
  return requireRole('global_admin');
}

/**
 * Middleware to check if user can access their own resource or is admin
 */
export function requireOwnershipOrAdmin(getUserIdFromRequest: (request: FastifyRequest) => string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.user) {
      const errorResponse = {
        success: false,
        error: 'Authentication required'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(401).type('application/json').send(jsonString);
    }

    const targetUserId = getUserIdFromRequest(request);
    
    // Allow if user is accessing their own resource
    if (request.user.id === targetUserId) {
      return;
    }

    // Check if user is admin
    const roleService = new RoleService();
    
    try {
      const hasAdminPermission = await roleService.userHasPermission(request.user.id, 'system.admin');
      
      if (!hasAdminPermission) {
        const errorResponse = {
          success: false,
          error: 'Can only access your own resources or requires admin permissions'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }
    } catch (error) {
      request.log.error(error, 'Error checking user permissions');
      const errorResponse = {
        success: false,
        error: 'Internal server error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Helper function to get user ID from route params
 */
export function getUserIdFromParams(request: FastifyRequest): string {
  const params = request.params as { id?: string; userId?: string } | undefined;
  return params?.id || params?.userId || '';
}

/**
 * Utility function to check permissions without middleware (for use in route handlers)
 */
export async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  const roleService = new RoleService();
  return roleService.userHasPermission(userId, permission);
}

/**
 * Utility function to get user role information
 */
export async function getUserRole(userId: string) {
  const roleService = new RoleService();
  return roleService.getUserRole(userId);
}

/**
 * Team-aware permission middleware
 * Checks if user has permission within a specific team context
 */
export function requireTeamPermission(
  permission: any, 
  getTeamId?: (request: FastifyRequest) => string
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if user is authenticated
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // Extract team ID from request params or use provided function
      let teamId: string;
      if (getTeamId) {
        teamId = getTeamId(request);
      } else {
        const params = request.params as { teamId?: string } | undefined;
        teamId = params?.teamId || '';
      }

      if (!teamId) {
        const errorResponse = {
          success: false,
          error: 'Team ID is required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      const userId = request.user.id;

      request.log.trace({
        operation: 'team_permission_check',
        userId,
        teamId,
        permission
      }, `🔐 Checking team permission: ${permission} for team ${teamId}`);

      // Check if user is global admin (bypass team checks)
      const roleService = new RoleService();
      const userRole = await roleService.getUserRole(userId);
      
      if (userRole?.id === 'global_admin') {
        // Global admin has access to all teams
        const globalPermissions = ROLE_DEFINITIONS.global_admin;
        if ((globalPermissions as unknown as any[]).includes(permission)) {
          request.log.debug({
            operation: 'team_permission_check',
            userId,
            teamId,
            permission,
            result: 'granted_global_admin'
          }, `✅ Global admin granted permission: ${permission}`);
          return;
        }
      }

      // Check if user is a member of the team
      const isMember = await TeamService.isTeamMember(teamId, userId);
      if (!isMember) {
        request.log.warn({
          operation: 'team_permission_check',
          userId,
          teamId,
          permission,
          result: 'not_team_member'
        }, `❌ User is not a member of team ${teamId}`);
        
        const errorResponse = {
          success: false,
          error: 'You are not a member of this team'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      // Get user's role within the team
      const teamMembership = await TeamService.getTeamMembership(teamId, userId);
      if (!teamMembership) {
        const errorResponse = {
          success: false,
          error: 'Team membership not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const teamRole = teamMembership.role; // 'team_admin' or 'team_user'

      // Check if the team role has the required permission
      const rolePermissions = ROLE_DEFINITIONS[teamRole as keyof typeof ROLE_DEFINITIONS];
      if (!rolePermissions || !(rolePermissions as unknown as any[]).includes(permission)) {
        request.log.warn({
          operation: 'team_permission_check',
          userId,
          teamId,
          permission,
          teamRole,
          result: 'insufficient_team_permissions'
        }, `❌ Team role ${teamRole} does not have permission: ${permission}`);
        
        const errorResponse = {
          success: false,
          error: 'Insufficient permissions for this team operation',
          required_permission: permission,
          user_team_role: teamRole
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      request.log.debug({
        operation: 'team_permission_check',
        userId,
        teamId,
        permission,
        teamRole,
        result: 'granted'
      }, `✅ Team permission granted: ${permission} (role: ${teamRole})`);

    } catch (error) {
      request.log.error({
        operation: 'team_permission_check',
        error,
        permission
      }, `❌ Error checking team permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      const errorResponse = {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  };
}

/**
 * Utility function to check team permissions without middleware (for use in route handlers)
 */
export async function checkUserTeamPermission(
  userId: string,
  teamId: string,
  permission: string
): Promise<boolean> {
  try {
    // Check if user is global admin
    const roleService = new RoleService();
    const userRole = await roleService.getUserRole(userId);

    if (userRole?.id === 'global_admin') {
      const globalPermissions = ROLE_DEFINITIONS.global_admin;
      return (globalPermissions as unknown as any[]).includes(permission);
    }

    // Check team membership and role
    const teamMembership = await TeamService.getTeamMembership(teamId, userId);
    if (!teamMembership) {
      return false;
    }

    const teamRole = teamMembership.role;
    const rolePermissions = ROLE_DEFINITIONS[teamRole as keyof typeof ROLE_DEFINITIONS];

    return rolePermissions ? (rolePermissions as unknown as any[]).includes(permission) : false;
  } catch {
    return false;
  }
}
