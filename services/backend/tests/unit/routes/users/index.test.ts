import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import usersRoute from '../../../../src/routes/users/index';
import { UserService } from '../../../../src/services/userService';
import { TeamService } from '../../../../src/services/teamService';
import { requirePermission, requireOwnershipOrAdmin, getUserIdFromParams } from '../../../../src/middleware/roleMiddleware';

// Mock dependencies
vi.mock('../../../../src/services/userService');
vi.mock('../../../../src/services/teamService');
vi.mock('../../../../src/middleware/roleMiddleware');

// Type the mocked classes
const MockedUserService = UserService as any;
const MockedTeamService = TeamService as any;
const mockRequirePermission = requirePermission as MockedFunction<typeof requirePermission>;
const mockRequireOwnershipOrAdmin = requireOwnershipOrAdmin as MockedFunction<typeof requireOwnershipOrAdmin>;
const mockGetUserIdFromParams = getUserIdFromParams as MockedFunction<typeof getUserIdFromParams>;

describe('Users Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockUserService: any;
  let mockTeamService: any;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock services
    mockUserService = {
      getAllUsers: vi.fn(),
      getUserById: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      assignRole: vi.fn(),
      getUserCountByRole: vi.fn(),
      getUsersByRole: vi.fn(),
      userHasPermission: vi.fn(),
    };

    mockTeamService = {
      getUserTeams: vi.fn(),
    };

    MockedUserService.mockImplementation(() => mockUserService);
    MockedTeamService.getUserTeams = mockTeamService.getUserTeams;

    // Setup mock middleware
    mockRequirePermission.mockReturnValue(vi.fn());
    mockRequireOwnershipOrAdmin.mockReturnValue(vi.fn());
    mockGetUserIdFromParams.mockReturnValue('user-123');

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
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
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request
    mockRequest = {
      params: {},
      body: {},
      user: {
        id: 'current-user-123',
        username: 'testuser',
        email: 'test@example.com',
      } as any,
      session: {
        id: 'session-123',
      } as any,
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register all user routes', async () => {
      await usersRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/api/users', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/users/:id', expect.any(Object), expect.any(Function));
      expect(mockFastify.put).toHaveBeenCalledWith('/api/users/:id', expect.any(Object), expect.any(Function));
      expect(mockFastify.delete).toHaveBeenCalledWith('/api/users/:id', expect.any(Object), expect.any(Function));
      expect(mockFastify.put).toHaveBeenCalledWith('/api/users/:id/role', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/users/stats', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/users/role/:roleId', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/users/me', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/users/me/teams', expect.any(Object), expect.any(Function));
    });

    it('should configure middleware correctly', async () => {
      await usersRoute(mockFastify as FastifyInstance);

      expect(mockRequirePermission).toHaveBeenCalledWith('users.list');
      expect(mockRequirePermission).toHaveBeenCalledWith('users.delete');
      expect(mockRequirePermission).toHaveBeenCalledWith('users.edit');
      expect(mockRequireOwnershipOrAdmin).toHaveBeenCalledWith(mockGetUserIdFromParams);
    });
  });

  describe('GET /api/users', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should return all users successfully', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', email: 'user1@example.com' },
        { id: '2', username: 'user2', email: 'user2@example.com' },
      ];
      mockUserService.getAllUsers.mockResolvedValue(mockUsers);

      const handler = routeHandlers['GET /api/users'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.getAllUsers).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockUsers,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockUserService.getAllUsers.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/users'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching users');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch users',
      });
    });
  });

  describe('GET /api/users/:id', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should return user by ID successfully', async () => {
      const mockUser = { id: 'user-123', username: 'testuser', email: 'test@example.com' };
      mockRequest.params = { id: 'user-123' };
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const handler = routeHandlers['GET /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockUser);
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockUserService.getUserById.mockResolvedValue(null);

      const handler = routeHandlers['GET /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockRequest.params = { id: 'user-123' };
      mockUserService.getUserById.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching user');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch user',
      });
    });
  });

  describe('PUT /api/users/:id', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should update user successfully', async () => {
      const updateData = { username: 'newusername', email: 'new@example.com' };
      const updatedUser = { id: 'user-123', ...updateData };
      
      mockRequest.params = { id: 'user-123' };
      mockRequest.body = updateData;
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', updateData);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'User updated successfully',
      });
    });

    it('should prevent users from changing their own role without admin permission', async () => {
      const updateData = { role_id: 'new-role' };
      
      mockRequest.params = { id: 'current-user-123' };
      mockRequest.body = updateData;
      mockRequest.user = { id: 'current-user-123' };
      mockUserService.userHasPermission.mockResolvedValue(false);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.userHasPermission).toHaveBeenCalledWith('current-user-123', 'system.admin');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot change your own role',
      });
    });

    it('should allow admin to change their own role', async () => {
      const updateData = { role_id: 'new-role' };
      const updatedUser = { id: 'current-user-123', role_id: 'new-role' };
      
      mockRequest.params = { id: 'current-user-123' };
      mockRequest.body = updateData;
      mockRequest.user = { id: 'current-user-123' };
      mockUserService.userHasPermission.mockResolvedValue(true);
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.updateUser).toHaveBeenCalledWith('current-user-123', updateData);
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { username: 'newname' };
      mockUserService.updateUser.mockResolvedValue(null);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle validation errors', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['username'],
          message: 'Expected string, received number',
        },
      ]);
      
      mockRequest.params = { id: 'user-123' };
      mockRequest.body = { username: 123 };
      mockUserService.updateUser.mockRejectedValue(zodError);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: zodError.errors,
      });
    });

    it('should handle invalid role ID error', async () => {
      const error = new Error('Invalid role ID');
      mockRequest.params = { id: 'user-123' };
      mockRequest.body = { role_id: 'invalid' };
      mockUserService.updateUser.mockRejectedValue(error);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid role ID',
      });
    });

    it('should handle username/email conflict error', async () => {
      const error = new Error('Username or email already exists');
      mockRequest.params = { id: 'user-123' };
      mockRequest.body = { username: 'existing' };
      mockUserService.updateUser.mockRejectedValue(error);

      const handler = routeHandlers['PUT /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Username or email already exists',
      });
    });
  });

  describe('DELETE /api/users/:id', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should delete user successfully', async () => {
      mockRequest.params = { id: 'user-123' };
      mockRequest.user = { id: 'current-user-456' };
      mockUserService.deleteUser.mockResolvedValue(true);

      const handler = routeHandlers['DELETE /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully',
      });
    });

    it('should prevent users from deleting themselves', async () => {
      mockRequest.params = { id: 'current-user-123' };
      mockRequest.user = { id: 'current-user-123' };

      const handler = routeHandlers['DELETE /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.deleteUser).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete your own account',
      });
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.user = { id: 'current-user-456' };
      mockUserService.deleteUser.mockResolvedValue(false);

      const handler = routeHandlers['DELETE /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle last admin deletion error', async () => {
      const error = new Error('Cannot delete the last global administrator');
      mockRequest.params = { id: 'admin-123' };
      mockRequest.user = { id: 'current-user-456' };
      mockUserService.deleteUser.mockRejectedValue(error);

      const handler = routeHandlers['DELETE /api/users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete the last global administrator',
      });
    });
  });

  describe('GET /api/users/me', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should return current user profile successfully', async () => {
      const mockUser = { id: 'current-user-123', username: 'testuser', email: 'test@example.com' };
      mockRequest.user = { id: 'current-user-123' };
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const handler = routeHandlers['GET /api/users/me'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.getUserById).toHaveBeenCalledWith('current-user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockUser);
    });

    it('should return 401 when user not authenticated', async () => {
      mockRequest.user = null;

      const handler = routeHandlers['GET /api/users/me'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.getUserById).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 when user not found', async () => {
      mockRequest.user = { id: 'current-user-123' };
      mockUserService.getUserById.mockResolvedValue(null);

      const handler = routeHandlers['GET /api/users/me'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });
  });

  describe('GET /api/users/me/teams', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should return current user teams successfully', async () => {
      const mockTeams = [
        { id: 'team-1', name: 'Team 1', slug: 'team-1' },
        { id: 'team-2', name: 'Team 2', slug: 'team-2' },
      ];
      mockRequest.user = { id: 'current-user-123' };
      mockTeamService.getUserTeams.mockResolvedValue(mockTeams);

      const handler = routeHandlers['GET /api/users/me/teams'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getUserTeams).toHaveBeenCalledWith('current-user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        teams: mockTeams,
      });
    });

    it('should return 401 when user not authenticated', async () => {
      mockRequest.user = null;

      const handler = routeHandlers['GET /api/users/me/teams'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getUserTeams).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockRequest.user = { id: 'current-user-123' };
      mockTeamService.getUserTeams.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/users/me/teams'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching user teams');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch user teams',
      });
    });
  });
});
