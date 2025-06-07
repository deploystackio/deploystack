import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rolesRoute from '../../../../src/routes/roles/index';
import { RoleService } from '../../../../src/services/roleService';
import { requirePermission } from '../../../../src/middleware/roleMiddleware';
import { AVAILABLE_PERMISSIONS } from '../../../../src/routes/roles/schemas';
import { ZodError } from 'zod';

// Mock dependencies
vi.mock('../../../../src/services/roleService');
vi.mock('../../../../src/middleware/roleMiddleware');

// Type the mocked functions
const mockRoleService = RoleService as any;
const mockRequirePermission = requirePermission as MockedFunction<typeof requirePermission>;

describe('Roles Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockRoleServiceInstance: any;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock RoleService instance
    mockRoleServiceInstance = {
      getAllRoles: vi.fn(),
      getRoleById: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    };

    // Mock RoleService constructor
    mockRoleService.mockImplementation(() => mockRoleServiceInstance);

    // Mock static method
    RoleService.getDefaultPermissions = vi.fn().mockReturnValue({
      global_admin: ['system.admin', 'roles.manage'],
      global_user: ['profile.view', 'profile.edit'],
    });

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      post: vi.fn((path, options, handler) => {
        routeHandlers[`POST ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      put: vi.fn((path, options, handler) => {
        routeHandlers[`PUT ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      delete: vi.fn((path, options, handler) => {
        routeHandlers[`DELETE ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request
    mockRequest = {
      params: {},
      body: {},
      user: {
        id: 'user-123',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Mock requirePermission middleware to do nothing (successful auth)
    mockRequirePermission.mockImplementation(() => async () => Promise.resolve(undefined));
  });

  describe('Route Registration', () => {
    it('should register all role routes with correct permissions', async () => {
      await rolesRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/api/roles', expect.objectContaining({
        schema: expect.any(Object),
        preHandler: expect.any(Function),
      }), expect.any(Function));

      expect(mockFastify.get).toHaveBeenCalledWith('/api/roles/:id', expect.objectContaining({
        schema: expect.any(Object),
        preHandler: expect.any(Function),
      }), expect.any(Function));

      expect(mockFastify.post).toHaveBeenCalledWith('/api/roles', expect.objectContaining({
        schema: expect.any(Object),
        preHandler: expect.any(Function),
      }), expect.any(Function));

      expect(mockFastify.put).toHaveBeenCalledWith('/api/roles/:id', expect.objectContaining({
        schema: expect.any(Object),
        preHandler: expect.any(Function),
      }), expect.any(Function));

      expect(mockFastify.delete).toHaveBeenCalledWith('/api/roles/:id', expect.objectContaining({
        schema: expect.any(Object),
        preHandler: expect.any(Function),
      }), expect.any(Function));

      expect(mockFastify.get).toHaveBeenCalledWith('/api/roles/permissions', expect.objectContaining({
        schema: expect.any(Object),
        preHandler: expect.any(Function),
      }), expect.any(Function));

      // Verify requirePermission is called with correct permission
      expect(mockRequirePermission).toHaveBeenCalledWith('roles.manage');
    });
  });

  describe('GET /api/roles', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should return all roles successfully', async () => {
      const mockRoles = [
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Full system access',
          permissions: ['system.admin', 'roles.manage'],
          is_system_role: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'user',
          name: 'User',
          description: 'Basic user access',
          permissions: ['profile.view', 'profile.edit'],
          is_system_role: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRoleServiceInstance.getAllRoles.mockResolvedValue(mockRoles);

      const handler = routeHandlers['GET /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.getAllRoles).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockRoles,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      mockRoleServiceInstance.getAllRoles.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching roles');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch roles',
      });
    });
  });

  describe('GET /api/roles/:id', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should return role by ID successfully', async () => {
      const mockRole = {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: ['system.admin', 'roles.manage'],
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.params = { id: 'admin' };
      mockRoleServiceInstance.getRoleById.mockResolvedValue(mockRole);

      const handler = routeHandlers['GET /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.getRoleById).toHaveBeenCalledWith('admin');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockRole,
      });
    });

    it('should return 404 when role not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRoleServiceInstance.getRoleById.mockResolvedValue(null);

      const handler = routeHandlers['GET /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.getRoleById).toHaveBeenCalledWith('nonexistent');
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Role not found',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockRequest.params = { id: 'admin' };
      mockRoleServiceInstance.getRoleById.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching role');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch role',
      });
    });
  });

  describe('POST /api/roles', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should create role successfully', async () => {
      const createRoleInput = {
        id: 'custom-role',
        name: 'Custom Role',
        description: 'A custom role',
        permissions: ['profile.view', 'profile.edit'],
      };

      const createdRole = {
        ...createRoleInput,
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = createRoleInput;
      mockRoleServiceInstance.createRole.mockResolvedValue(createdRole);

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.createRole).toHaveBeenCalledWith(createRoleInput);
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: createdRole,
        message: 'Role created successfully',
      });
    });

    it('should return 400 for invalid permissions', async () => {
      const createRoleInput = {
        id: 'custom-role',
        name: 'Custom Role',
        description: 'A custom role',
        permissions: ['invalid.permission', 'profile.view'],
      };

      mockRequest.body = createRoleInput;

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid permissions',
        details: { invalid_permissions: ['invalid.permission'] },
      });
    });

    it('should handle validation errors', async () => {
      const zodError = new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Role name is required',
          path: ['name'],
        },
      ]);

      mockRequest.body = { id: 'test', permissions: ['profile.view'] };
      mockRoleServiceInstance.createRole.mockRejectedValue(zodError);

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: zodError.errors,
      });
    });

    it('should handle unique constraint errors', async () => {
      const createRoleInput = {
        id: 'existing-role',
        name: 'Existing Role',
        permissions: ['profile.view'],
      };

      const uniqueError = new Error('UNIQUE constraint failed: roles.id');
      mockRequest.body = createRoleInput;
      mockRoleServiceInstance.createRole.mockRejectedValue(uniqueError);

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Role ID or name already exists',
      });
    });

    it('should handle general service errors', async () => {
      const createRoleInput = {
        id: 'custom-role',
        name: 'Custom Role',
        permissions: ['profile.view'],
      };

      const error = new Error('Database error');
      mockRequest.body = createRoleInput;
      mockRoleServiceInstance.createRole.mockRejectedValue(error);

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error creating role');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create role',
      });
    });
  });

  describe('PUT /api/roles/:id', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should update role successfully', async () => {
      const updateRoleInput = {
        name: 'Updated Role Name',
        description: 'Updated description',
        permissions: ['profile.view', 'profile.edit', 'teams.view'],
      };

      const updatedRole = {
        id: 'custom-role',
        ...updateRoleInput,
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.params = { id: 'custom-role' };
      mockRequest.body = updateRoleInput;
      mockRoleServiceInstance.updateRole.mockResolvedValue(updatedRole);

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.updateRole).toHaveBeenCalledWith('custom-role', updateRoleInput);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: updatedRole,
        message: 'Role updated successfully',
      });
    });

    it('should return 404 when role not found', async () => {
      const updateRoleInput = {
        name: 'Updated Role Name',
      };

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = updateRoleInput;
      mockRoleServiceInstance.updateRole.mockResolvedValue(null);

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Role not found',
      });
    });

    it('should return 400 for invalid permissions', async () => {
      const updateRoleInput = {
        permissions: ['invalid.permission', 'profile.view'],
      };

      mockRequest.params = { id: 'custom-role' };
      mockRequest.body = updateRoleInput;

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid permissions',
        details: { invalid_permissions: ['invalid.permission'] },
      });
    });

    it('should return 403 when trying to update system role', async () => {
      const updateRoleInput = {
        name: 'Updated System Role',
      };

      const systemRoleError = new Error('Cannot update system roles');
      mockRequest.params = { id: 'admin' };
      mockRequest.body = updateRoleInput;
      mockRoleServiceInstance.updateRole.mockRejectedValue(systemRoleError);

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot update system roles',
      });
    });

    it('should handle validation errors', async () => {
      const zodError = new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Role name cannot be empty',
          path: ['name'],
        },
      ]);

      mockRequest.params = { id: 'custom-role' };
      mockRequest.body = { name: '' };
      mockRoleServiceInstance.updateRole.mockRejectedValue(zodError);

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: zodError.errors,
      });
    });

    it('should handle general service errors', async () => {
      const updateRoleInput = {
        name: 'Updated Role Name',
      };

      const error = new Error('Database error');
      mockRequest.params = { id: 'custom-role' };
      mockRequest.body = updateRoleInput;
      mockRoleServiceInstance.updateRole.mockRejectedValue(error);

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error updating role');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update role',
      });
    });
  });

  describe('DELETE /api/roles/:id', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should delete role successfully', async () => {
      mockRequest.params = { id: 'custom-role' };
      mockRoleServiceInstance.deleteRole.mockResolvedValue(true);

      const handler = routeHandlers['DELETE /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.deleteRole).toHaveBeenCalledWith('custom-role');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Role deleted successfully',
      });
    });

    it('should return 404 when role not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRoleServiceInstance.deleteRole.mockResolvedValue(false);

      const handler = routeHandlers['DELETE /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Role not found',
      });
    });

    it('should return 403 when trying to delete system role', async () => {
      const systemRoleError = new Error('Cannot delete system roles');
      mockRequest.params = { id: 'admin' };
      mockRoleServiceInstance.deleteRole.mockRejectedValue(systemRoleError);

      const handler = routeHandlers['DELETE /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete system roles',
      });
    });

    it('should return 409 when role is assigned to users', async () => {
      const assignedRoleError = new Error('Cannot delete role that is assigned to users');
      mockRequest.params = { id: 'user-role' };
      mockRoleServiceInstance.deleteRole.mockRejectedValue(assignedRoleError);

      const handler = routeHandlers['DELETE /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete role that is assigned to users',
      });
    });

    it('should handle general service errors', async () => {
      const error = new Error('Database error');
      mockRequest.params = { id: 'custom-role' };
      mockRoleServiceInstance.deleteRole.mockRejectedValue(error);

      const handler = routeHandlers['DELETE /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error deleting role');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete role',
      });
    });
  });

  describe('GET /api/roles/permissions', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should return available permissions and default roles', async () => {
      const handler = routeHandlers['GET /api/roles/permissions'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          permissions: AVAILABLE_PERMISSIONS,
          default_roles: {
            global_admin: ['system.admin', 'roles.manage'],
            global_user: ['profile.view', 'profile.edit'],
          },
        },
      });
    });
  });

  describe('Permission Validation', () => {
    beforeEach(async () => {
      await rolesRoute(mockFastify as FastifyInstance);
    });

    it('should validate permissions correctly for create role', async () => {
      const createRoleInput = {
        id: 'test-role',
        name: 'Test Role',
        permissions: ['profile.view', 'invalid.permission', 'teams.view'],
      };

      mockRequest.body = createRoleInput;

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid permissions',
        details: { invalid_permissions: ['invalid.permission'] },
      });
    });

    it('should validate permissions correctly for update role', async () => {
      const updateRoleInput = {
        permissions: ['profile.view', 'invalid.permission1', 'teams.view', 'invalid.permission2'],
      };

      mockRequest.params = { id: 'test-role' };
      mockRequest.body = updateRoleInput;

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid permissions',
        details: { invalid_permissions: ['invalid.permission1', 'invalid.permission2'] },
      });
    });

    it('should allow valid permissions for create role', async () => {
      const createRoleInput = {
        id: 'test-role',
        name: 'Test Role',
        permissions: ['profile.view', 'profile.edit', 'teams.view'],
      };

      const createdRole = {
        ...createRoleInput,
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = createRoleInput;
      mockRoleServiceInstance.createRole.mockResolvedValue(createdRole);

      const handler = routeHandlers['POST /api/roles'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.createRole).toHaveBeenCalledWith(createRoleInput);
      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should allow valid permissions for update role', async () => {
      const updateRoleInput = {
        permissions: ['profile.view', 'profile.edit', 'teams.view'],
      };

      const updatedRole = {
        id: 'test-role',
        name: 'Test Role',
        description: null,
        ...updateRoleInput,
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.params = { id: 'test-role' };
      mockRequest.body = updateRoleInput;
      mockRoleServiceInstance.updateRole.mockResolvedValue(updatedRole);

      const handler = routeHandlers['PUT /api/roles/:id'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.updateRole).toHaveBeenCalledWith('test-role', updateRoleInput);
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });
});
