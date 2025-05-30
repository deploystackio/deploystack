import type { FastifyRequest, FastifyReply } from 'fastify';
import { RoleService } from '../services/roleService';
import type { User } from 'lucia';

// FastifyRequest already has user: User | null from authHook
// We'll use the existing type

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const roleService = new RoleService();
    
    try {
      const hasPermission = await roleService.userHasPermission(request.user.id, permission);
      
      if (!hasPermission) {
        return reply.status(403).send({ 
          error: 'Insufficient permissions',
          required_permission: permission 
        });
      }
    } catch (error) {
      request.log.error(error, 'Error checking user permissions');
      return reply.status(500).send({ error: 'Internal server error' });
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
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const roleService = new RoleService();
    
    try {
      for (const permission of permissions) {
        const hasPermission = await roleService.userHasPermission(request.user.id, permission);
        if (hasPermission) {
          return; // User has at least one required permission
        }
      }
      
      return reply.status(403).send({ 
        error: 'Insufficient permissions',
        required_permissions: permissions 
      });
    } catch (error) {
      request.log.error(error, 'Error checking user permissions');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if user has a specific role
 */
export function requireRole(roleId: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    // Get user's role from database since Lucia User might not have role_id
    const roleService = new RoleService();
    try {
      const userRole = await roleService.getUserRole(request.user.id);
      if (!userRole || userRole.id !== roleId) {
        return reply.status(403).send({ 
          error: 'Insufficient permissions',
          required_role: roleId 
        });
      }
    } catch (error) {
      request.log.error(error, 'Error checking user role');
      return reply.status(500).send({ error: 'Internal server error' });
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
      return reply.status(401).send({ error: 'Authentication required' });
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
        return reply.status(403).send({ 
          error: 'Can only access your own resources or requires admin permissions' 
        });
      }
    } catch (error) {
      request.log.error(error, 'Error checking user permissions');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Helper function to get user ID from route params
 */
export function getUserIdFromParams(request: FastifyRequest): string {
  const params = request.params as { id?: string; userId?: string };
  return params.id || params.userId || '';
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
