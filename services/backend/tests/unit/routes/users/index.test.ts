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
  let mockRequest: any;
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
      getTeamMembership: vi.fn(),
    };

    MockedUserService.mockImplementation(() => mockUserService);
    MockedTeamService.getUserTeams = mockTeamService.getUserTeams;
    MockedTeamService.getTeamMembership = mockTeamService.getTeamMembership;

    // Setup mock middleware
    mockRequirePermission.mockReturnValue(vi.fn());
    mockRequireOwnershipOrAdmin.mockReturnValue(vi.fn());
    mockGetUserIdFromParams.mockReturnValue('user-123');

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`GET ${path}`] = handler;
        } else {
          routeHandlers[`GET ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
      put: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`PUT ${path}`] = handler;
        } else {
          routeHandlers[`PUT ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
      delete: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`DELETE ${path}`] = handler;
        } else {
          routeHandlers[`DELETE ${path}`] = options;
        }
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
      },
      session: {
        id: 'session-123',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register all user routes', async () => {
      await usersRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/users', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/users/:id', expect.any(Object), expect.any(Function));
      expect(mockFastify.put).toHaveBeenCalledWith('/users/:id', expect.any(Object), expect.any(Function));
      expect(mockFastify.delete).toHaveBeenCalledWith('/users/:id', expect.any(Object), expect.any(Function));
      expect(mockFastify.put).toHaveBeenCalledWith('/users/:id/role', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/users/stats', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/users/role/:roleId', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/users/me', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/users/me/teams', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/users/:id/teams', expect.any(Object), expect.any(Function));
    });

    it('should configure middleware correctly', async () => {
      await usersRoute(mockFastify as FastifyInstance);

      expect(mockRequirePermission).toHaveBeenCalledWith('users.list');
      expect(mockRequirePermission).toHaveBeenCalledWith('users.delete');
      expect(mockRequirePermission).toHaveBeenCalledWith('users.edit');
      expect(mockRequireOwnershipOrAdmin).toHaveBeenCalledWith(mockGetUserIdFromParams);
    });
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should return all users successfully', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', email: 'user1@example.com' },
        { id: '2', username: 'user2', email: 'user2@example.com' },
      ];
      mockUserService.getAllUsers.mockResolvedValue(mockUsers);

      const handler = routeHandlers['GET /users'];
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

      const handler = routeHandlers['GET /users'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching users');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch users',
      });
    });
  });

  describe('GET /users/:id', () => {
    beforeEach(async () => {
      await usersRoute(mockFastify as FastifyInstance);
    });

    it('should return user by ID successfully', async () => {
      const mockUser = { id: 'user-123', username: 'testuser', email: 'test@example.com' };
      mockRequest.params = { id: 'user-123' };
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const handler = routeHandlers['GET /users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          first_name: null,
          last_name: null,
          role_id: null,
          auth_type: null,
          github_id: null,
        })
      );
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockUserService.getUserById.mockResolvedValue(null);

      const handler = routeHandlers['GET /users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'User not found',
        })
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockRequest.params = { id: 'user-123' };
      mockUserService.getUserById.mockRejectedValue(error);

      const handler = routeHandlers['GET /users/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching user');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch user',
        })
      );
    });
  });
});
