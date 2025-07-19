import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireGlobalAdmin,
  requireOwnershipOrAdmin,
  getUserIdFromParams,
  checkUserPermission,
  getUserRole,
} from '../../../src/middleware/roleMiddleware';
import { RoleService } from '../../../src/services/roleService';

// Mock dependencies
vi.mock('../../../src/services/roleService');

// Type the mocked module
const mockRoleService = RoleService as any;

describe('Role Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockRoleServiceInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock request and reply
    mockRequest = {
      user: {
        id: 'user-123',
      } as any,
      params: {},
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn().mockReturnValue({
          error: vi.fn(),
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          fatal: vi.fn(),
          trace: vi.fn(),
        }),
        level: 'info',
        silent: vi.fn(),
      } as any,
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup mock RoleService instance
    mockRoleServiceInstance = {
      userHasPermission: vi.fn(),
      getUserRole: vi.fn(),
    };

    // Mock RoleService constructor to return our mock instance
    mockRoleService.mockImplementation(() => mockRoleServiceInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requirePermission', () => {
    it('should allow user with required permission', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);

      const middleware = requirePermission('users.view');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.view');
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = null;

      const middleware = requirePermission('users.view');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }));
      expect(mockRoleServiceInstance.userHasPermission).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks required permission', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(false);

      const middleware = requirePermission('users.delete');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.delete');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Insufficient permissions',
        required_permission: 'users.delete'
      }));
    });

    it('should return 500 when permission check fails', async () => {
      const error = new Error('Database connection failed');
      mockRoleServiceInstance.userHasPermission.mockRejectedValue(error);

      const middleware = requirePermission('users.view');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.log?.error).toHaveBeenCalledWith(
        error,
        'Error checking user permissions for permission: users.view'
      );
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: 'Database connection failed'
      }));
    });

    it('should handle non-Error objects in catch block', async () => {
      mockRoleServiceInstance.userHasPermission.mockRejectedValue('String error');

      const middleware = requirePermission('users.view');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: 'Unknown error'
      }));
    });
  });

  describe('requireAnyPermission', () => {
    it('should allow user with any of the required permissions', async () => {
      mockRoleServiceInstance.userHasPermission
        .mockResolvedValueOnce(false) // First permission check fails
        .mockResolvedValueOnce(true); // Second permission check succeeds

      const middleware = requireAnyPermission(['users.delete', 'users.edit']);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.delete');
      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.edit');
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should allow user with first required permission', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValueOnce(true);

      const middleware = requireAnyPermission(['users.view', 'users.edit']);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.view');
      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledTimes(1); // Should stop after first success
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = null;

      const middleware = requireAnyPermission(['users.view', 'users.edit']);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }));
      expect(mockRoleServiceInstance.userHasPermission).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks all required permissions', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(false);

      const middleware = requireAnyPermission(['users.delete', 'users.create']);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.delete');
      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.create');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Insufficient permissions',
        required_permissions: ['users.delete', 'users.create']
      }));
    });

    it('should return 500 when permission check fails', async () => {
      const error = new Error('Database error');
      mockRoleServiceInstance.userHasPermission.mockRejectedValue(error);

      const middleware = requireAnyPermission(['users.view']);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.log?.error).toHaveBeenCalledWith(error, 'Error checking user permissions');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Internal server error'
      }));
    });

    it('should handle empty permissions array', async () => {
      const middleware = requireAnyPermission([]);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Insufficient permissions',
        required_permissions: []
      }));
      expect(mockRoleServiceInstance.userHasPermission).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow user with required role', async () => {
      const userRole = {
        id: 'admin',
        name: 'Administrator',
        permissions: ['users.view', 'users.edit'],
      };
      mockRoleServiceInstance.getUserRole.mockResolvedValue(userRole);

      const middleware = requireRole('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = null;

      const middleware = requireRole('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }));
      expect(mockRoleServiceInstance.getUserRole).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no role', async () => {
      mockRoleServiceInstance.getUserRole.mockResolvedValue(null);

      const middleware = requireRole('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Insufficient permissions',
        required_role: 'admin',
        user_role: null
      }));
    });

    it('should return 403 when user has different role', async () => {
      const userRole = {
        id: 'user',
        name: 'Regular User',
        permissions: ['profile.view'],
      };
      mockRoleServiceInstance.getUserRole.mockResolvedValue(userRole);

      const middleware = requireRole('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Insufficient permissions',
        required_role: 'admin',
        user_role: 'user'
      }));
    });

    it('should return 500 when role check fails', async () => {
      const error = new Error('Database error');
      mockRoleServiceInstance.getUserRole.mockRejectedValue(error);

      const middleware = requireRole('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.log?.error).toHaveBeenCalledWith({
        operation: 'role_middleware_check',
        step: 'error',
        requiredRole: 'admin',
        userId: 'user-123',
        error
      }, '❌ Error checking user role: Database error');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: 'Database error'
      }));
    });
  });

  describe('requireGlobalAdmin', () => {
    it('should call requireRole with global_admin', async () => {
      const userRole = {
        id: 'global_admin',
        name: 'Global Administrator',
        permissions: ['system.admin'],
      };
      mockRoleServiceInstance.getUserRole.mockResolvedValue(userRole);

      const middleware = requireGlobalAdmin();
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not global admin', async () => {
      const userRole = {
        id: 'user',
        name: 'Regular User',
        permissions: ['profile.view'],
      };
      mockRoleServiceInstance.getUserRole.mockResolvedValue(userRole);

      const middleware = requireGlobalAdmin();
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Insufficient permissions',
        required_role: 'global_admin',
        user_role: 'user'
      }));
    });
  });

  describe('requireOwnershipOrAdmin', () => {
    const getUserIdFromRequest = (request: FastifyRequest) => {
      const params = request.params as { userId?: string };
      return params.userId || '';
    };

    it('should allow user accessing their own resource', async () => {
      mockRequest.params = { userId: 'user-123' }; // Same as authenticated user

      const middleware = requireOwnershipOrAdmin(getUserIdFromRequest);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
      expect(mockRoleServiceInstance.userHasPermission).not.toHaveBeenCalled(); // Should not check admin permission
    });

    it('should allow admin user accessing other user resource', async () => {
      mockRequest.params = { userId: 'user-456' }; // Different from authenticated user
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);

      const middleware = requireOwnershipOrAdmin(getUserIdFromRequest);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'system.admin');
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = null;

      const middleware = requireOwnershipOrAdmin(getUserIdFromRequest);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }));
    });

    it('should return 403 when user is not owner and not admin', async () => {
      mockRequest.params = { userId: 'user-456' }; // Different from authenticated user
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(false);

      const middleware = requireOwnershipOrAdmin(getUserIdFromRequest);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'system.admin');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Can only access your own resources or requires admin permissions'
      }));
    });

    it('should return 500 when admin permission check fails', async () => {
      mockRequest.params = { userId: 'user-456' };
      const error = new Error('Database error');
      mockRoleServiceInstance.userHasPermission.mockRejectedValue(error);

      const middleware = requireOwnershipOrAdmin(getUserIdFromRequest);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.log?.error).toHaveBeenCalledWith(error, 'Error checking user permissions');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(JSON.stringify({
        success: false,
        error: 'Internal server error'
      }));
    });
  });

  describe('getUserIdFromParams', () => {
    it('should return id from params', () => {
      const request = {
        params: { id: 'user-123' },
      } as FastifyRequest;

      const result = getUserIdFromParams(request);

      expect(result).toBe('user-123');
    });

    it('should return userId from params', () => {
      const request = {
        params: { userId: 'user-456' },
      } as FastifyRequest;

      const result = getUserIdFromParams(request);

      expect(result).toBe('user-456');
    });

    it('should prefer id over userId', () => {
      const request = {
        params: { id: 'user-123', userId: 'user-456' },
      } as FastifyRequest;

      const result = getUserIdFromParams(request);

      expect(result).toBe('user-123');
    });

    it('should return empty string when no params', () => {
      const request = {
        params: {},
      } as FastifyRequest;

      const result = getUserIdFromParams(request);

      expect(result).toBe('');
    });

    it('should handle undefined params', () => {
      const request = {} as FastifyRequest;

      const result = getUserIdFromParams(request);

      expect(result).toBe('');
    });
  });

  describe('checkUserPermission', () => {
    it('should return true when user has permission', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);

      const result = await checkUserPermission('user-123', 'users.view');

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.view');
      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(false);

      const result = await checkUserPermission('user-123', 'users.delete');

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.delete');
      expect(result).toBe(false);
    });

    it('should propagate errors from RoleService', async () => {
      const error = new Error('Database error');
      mockRoleServiceInstance.userHasPermission.mockRejectedValue(error);

      await expect(checkUserPermission('user-123', 'users.view')).rejects.toThrow('Database error');
    });
  });

  describe('getUserRole', () => {
    it('should return user role', async () => {
      const userRole = {
        id: 'admin',
        name: 'Administrator',
        permissions: ['users.view', 'users.edit'],
      };
      mockRoleServiceInstance.getUserRole.mockResolvedValue(userRole);

      const result = await getUserRole('user-123');

      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(userRole);
    });

    it('should return null when user has no role', async () => {
      mockRoleServiceInstance.getUserRole.mockResolvedValue(null);

      const result = await getUserRole('user-123');

      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(result).toBeNull();
    });

    it('should propagate errors from RoleService', async () => {
      const error = new Error('Database error');
      mockRoleServiceInstance.getUserRole.mockRejectedValue(error);

      await expect(getUserRole('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('Integration Tests', () => {
    it('should work with multiple middleware in sequence', async () => {
      // Test that multiple middleware can be chained
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);

      const middleware1 = requirePermission('users.view');
      const middleware2 = requirePermission('users.edit');

      await middleware1(mockRequest as FastifyRequest, mockReply as FastifyReply);
      await middleware2(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.view');
      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'users.edit');
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should handle complex permission scenarios', async () => {
      // Test complex scenario: user has some permissions but not others
      mockRoleServiceInstance.userHasPermission
        .mockImplementation((userId: string, permission: string) => {
          if (permission === 'users.view') return Promise.resolve(true);
          if (permission === 'users.edit') return Promise.resolve(true);
          if (permission === 'users.delete') return Promise.resolve(false);
          return Promise.resolve(false);
        });

      // Should succeed
      const viewMiddleware = requirePermission('users.view');
      await viewMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).not.toHaveBeenCalled();

      // Should succeed with any permission
      const anyMiddleware = requireAnyPermission(['users.delete', 'users.edit']);
      await anyMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).not.toHaveBeenCalled();

      // Should fail
      const deleteMiddleware = requirePermission('users.delete');
      await deleteMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).toHaveBeenCalledWith(403);
    });
  });
});
