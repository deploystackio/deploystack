import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import teamsRoute from '../../../src/routes/teams/index';
import { TeamService } from '../../../src/services/teamService';
import { requirePermission } from '../../../src/middleware/roleMiddleware';
// Import auth hook to get the FastifyRequest augmentation
import '../../../src/hooks/authHook';

// Mock dependencies
vi.mock('../../../src/services/teamService');
vi.mock('../../../src/middleware/roleMiddleware');

// Type the mocked modules
const mockTeamService = TeamService as any;
const mockRequirePermission = requirePermission as MockedFunction<typeof requirePermission>;

describe('Teams Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let routeHandlers: Record<string, any>;
  let preHandlers: Record<string, any>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers and preHandlers storage
    routeHandlers = {};
    preHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      post: vi.fn((path, options, handler) => {
        // Extract the actual handler function from the arguments
        const actualHandler = typeof options === 'function' ? options : handler;
        routeHandlers[`POST ${path}`] = actualHandler;
        preHandlers[`POST ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      get: vi.fn((path, options, handler) => {
        // Extract the actual handler function from the arguments
        const actualHandler = typeof options === 'function' ? options : handler;
        routeHandlers[`GET ${path}`] = actualHandler;
        preHandlers[`GET ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      put: vi.fn((path, options, handler) => {
        // Extract the actual handler function from the arguments
        const actualHandler = typeof options === 'function' ? options : handler;
        routeHandlers[`PUT ${path}`] = actualHandler;
        preHandlers[`PUT ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      delete: vi.fn((path, options, handler) => {
        // Extract the actual handler function from the arguments
        const actualHandler = typeof options === 'function' ? options : handler;
        routeHandlers[`DELETE ${path}`] = actualHandler;
        preHandlers[`DELETE ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request and reply
    mockRequest = {
      body: {},
      user: {
        id: 'user-123',
      } as any, // Use any to avoid complex Lucia User type issues in tests
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
    };

    // Mock requirePermission middleware
    mockRequirePermission.mockReturnValue(vi.fn());

    // Mock TeamService methods
    mockTeamService.canUserCreateTeam = vi.fn();
    mockTeamService.createTeam = vi.fn();
    mockTeamService.getUserTeams = vi.fn();
    mockTeamService.getTeamMembership = vi.fn();
    mockTeamService.getUserTeamsWithRoles = vi.fn();
    mockTeamService.getUserDefaultTeam = vi.fn();
    mockTeamService.getTeamById = vi.fn();
    mockTeamService.isTeamMember = vi.fn();
    mockTeamService.isTeamAdmin = vi.fn();
    mockTeamService.updateTeam = vi.fn();
    mockTeamService.deleteTeam = vi.fn();
    mockTeamService.getTeamMemberCount = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Registration', () => {
    it('should register POST /teams route', async () => {
      await teamsRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/teams',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Teams'],
            summary: 'Create new team',
            security: [{ cookieAuth: [] }],
          }),
          preValidation: expect.any(Function),
        }),
        expect.any(Function)
      );
    });

    it('should register GET /teams/me route', async () => {
      await teamsRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/teams/me',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Teams'],
            summary: 'Get current user teams',
            security: [{ cookieAuth: [] }],
          }),
        }),
        expect.any(Function)
      );
    });

    it('should use requirePermission middleware for POST route', async () => {
      await teamsRoute(mockFastify as FastifyInstance);

      expect(mockRequirePermission).toHaveBeenCalledWith('teams.create');
    });
  });

  describe('POST /teams - Create Team', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
    });

    it('should create a team successfully', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
      };

      const createdTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-123',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = teamData;
      mockTeamService.canUserCreateTeam.mockResolvedValue(true);
      mockTeamService.createTeam.mockResolvedValue(createdTeam);

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.canUserCreateTeam).toHaveBeenCalledWith('user-123');
      expect(mockTeamService.createTeam).toHaveBeenCalledWith({
        name: 'Test Team',
        description: 'A test team',
        owner_id: 'user-123',
      });

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: createdTeam,
        message: 'Team created successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 when user has reached team limit', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
      };

      mockRequest.body = teamData;
      mockTeamService.canUserCreateTeam.mockResolvedValue(false);

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.canUserCreateTeam).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'You have reached the maximum limit of 3 teams',
      });
    });

    it('should return 400 for validation errors', async () => {
      const invalidTeamData = {
        name: '', // Invalid: empty name
      };

      mockRequest.body = invalidTeamData;

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: expect.any(Array),
      });
    });

    it('should handle team name conflicts', async () => {
      const teamData = {
        name: 'Existing Team',
        description: 'A test team',
      };

      mockRequest.body = teamData;
      mockTeamService.canUserCreateTeam.mockResolvedValue(true);
      mockTeamService.createTeam.mockRejectedValue(new Error('slug already exists'));

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Team name conflicts with existing team',
      });
    });

    it('should handle internal server errors', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
      };

      mockRequest.body = teamData;
      mockTeamService.canUserCreateTeam.mockResolvedValue(true);
      mockTeamService.createTeam.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create team',
      });
    });

    it('should create team without description', async () => {
      const teamData = {
        name: 'Test Team',
      };

      const createdTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: null,
        owner_id: 'user-123',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = teamData;
      mockTeamService.canUserCreateTeam.mockResolvedValue(true);
      mockTeamService.createTeam.mockResolvedValue(createdTeam);

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.createTeam).toHaveBeenCalledWith({
        name: 'Test Team',
        description: undefined,
        owner_id: 'user-123',
      });

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: createdTeam,
        message: 'Team created successfully',
      });
    });

    it('should validate team name length', async () => {
      const teamData = {
        name: 'a'.repeat(101), // Too long
      };

      mockRequest.body = teamData;

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: expect.any(Array),
      });
    });

    it('should validate description length', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'a'.repeat(501), // Too long
      };

      mockRequest.body = teamData;

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: expect.any(Array),
      });
    });
  });

  describe('GET /teams/me/default - Get User Default Team', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
    });

    it('should return user default team successfully', async () => {
      const defaultTeam = {
        id: 'team-default',
        name: 'Default Team',
        slug: 'default-team',
        description: 'User default team',
        owner_id: 'user-123',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getUserDefaultTeam.mockResolvedValue(defaultTeam);

      const handler = routeHandlers['GET /teams/me/default'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getUserDefaultTeam).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: defaultTeam,
        message: 'Default team retrieved successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['GET /teams/me/default'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 when no default team found', async () => {
      mockTeamService.getUserDefaultTeam.mockResolvedValue(null);

      const handler = routeHandlers['GET /teams/me/default'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getUserDefaultTeam).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'No default team found',
      });
    });

    it('should handle internal server errors', async () => {
      mockTeamService.getUserDefaultTeam.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['GET /teams/me/default'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch default team',
      });
    });
  });

  describe('GET /teams/me - Get User Teams', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
    });

    it('should return user teams successfully', async () => {
      const userTeamsWithRoles = [
        {
          id: 'team-1',
          name: 'Team 1',
          slug: 'team-1',
          description: 'First team',
          owner_id: 'user-123',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
          role: 'team_admin',
          is_admin: true,
          is_owner: true,
          member_count: 2,
        },
        {
          id: 'team-2',
          name: 'Team 2',
          slug: 'team-2',
          description: 'Second team',
          owner_id: 'user-456',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
          role: 'team_user',
          is_admin: false,
          is_owner: false,
          member_count: 3,
        },
      ];

      mockTeamService.getUserTeamsWithRoles.mockResolvedValue(userTeamsWithRoles);

      const handler = routeHandlers['GET /teams/me'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getUserTeamsWithRoles).toHaveBeenCalledWith('user-123');

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: userTeamsWithRoles,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['GET /teams/me'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return empty array when user has no teams', async () => {
      mockTeamService.getUserTeamsWithRoles.mockResolvedValue([]);

      const handler = routeHandlers['GET /teams/me'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getUserTeamsWithRoles).toHaveBeenCalledWith('user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle teams with no membership (default to team_user)', async () => {
      const userTeamsWithRoles = [
        {
          id: 'team-1',
          name: 'Team 1',
          slug: 'team-1',
          description: 'First team',
          owner_id: 'user-123',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
          role: 'team_user',
          is_admin: false,
          is_owner: true,
          member_count: 1,
        },
      ];

      mockTeamService.getUserTeamsWithRoles.mockResolvedValue(userTeamsWithRoles);

      const handler = routeHandlers['GET /teams/me'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: userTeamsWithRoles,
      });
    });

    it('should handle internal server errors', async () => {
      mockTeamService.getUserTeamsWithRoles.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['GET /teams/me'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch user teams',
      });
    });

    it('should handle membership lookup errors gracefully', async () => {
      mockTeamService.getUserTeamsWithRoles.mockRejectedValue(new Error('Membership lookup failed'));

      const handler = routeHandlers['GET /teams/me'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch user teams',
      });
    });
  });

  describe('GET /teams/:id - Get Team by ID', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { id: 'team-123' };
    });

    it('should return team successfully for team member', async () => {
      const team = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-456',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getTeamById.mockResolvedValue(team);
      mockTeamService.isTeamMember.mockResolvedValue(true);
      mockTeamService.getTeamMembership.mockResolvedValue({ role: 'team_user' });
      mockTeamService.getTeamMemberCount.mockResolvedValue(1);

      const handler = routeHandlers['GET /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockTeamService.isTeamMember).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      // The route now sends JSON string, so we need to check for the string format
      const expectedTeamWithRole = {
        ...team,
        role: 'team_user',
        is_admin: false,
        is_owner: false,
        member_count: 1
      };
      const expectedJsonString = JSON.stringify({
        success: true,
        data: expectedTeamWithRole
      });
      expect(mockReply.send).toHaveBeenCalledWith(expectedJsonString);
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['GET /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      const expectedJsonString = JSON.stringify({
        success: false,
        error: 'Authentication required'
      });
      expect(mockReply.send).toHaveBeenCalledWith(expectedJsonString);
    });

    it('should return 404 when team is not found', async () => {
      mockTeamService.getTeamById.mockResolvedValue(null);

      const handler = routeHandlers['GET /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(404);
      const expectedJsonString = JSON.stringify({
        success: false,
        error: 'Team not found'
      });
      expect(mockReply.send).toHaveBeenCalledWith(expectedJsonString);
    });

    it('should return 403 when user is not a team member', async () => {
      const team = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-456',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getTeamById.mockResolvedValue(team);
      mockTeamService.isTeamMember.mockResolvedValue(false);

      const handler = routeHandlers['GET /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockTeamService.isTeamMember).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      const expectedJsonString = JSON.stringify({
        success: false,
        error: 'You do not have access to this team'
      });
      expect(mockReply.send).toHaveBeenCalledWith(expectedJsonString);
    });

    it('should handle internal server errors', async () => {
      mockTeamService.getTeamById.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['GET /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      const expectedJsonString = JSON.stringify({
        success: false,
        error: 'Failed to fetch team'
      });
      expect(mockReply.send).toHaveBeenCalledWith(expectedJsonString);
    });
  });

  describe('PUT /teams/:id - Update Team', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { id: 'team-123' };
    });

    it('should update team successfully as admin', async () => {
      const updateData = {
        name: 'Updated Team',
        description: 'Updated description',
      };

      const existingTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-456',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedTeam = {
        ...existingTeam,
        name: 'Updated Team',
        description: 'Updated description',
        updated_at: new Date(),
      };

      mockRequest.body = updateData;
      mockTeamService.getTeamById.mockResolvedValue(existingTeam);
      mockTeamService.isTeamAdmin.mockResolvedValue(true);
      mockTeamService.updateTeam.mockResolvedValue(updatedTeam);

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockTeamService.isTeamAdmin).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockTeamService.updateTeam).toHaveBeenCalledWith('team-123', updateData);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: updatedTeam,
        message: 'Team updated successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 when team is not found', async () => {
      mockRequest.body = { name: 'Updated Team' };
      mockTeamService.getTeamById.mockResolvedValue(null);

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Team not found',
      });
    });

    it('should return 403 when user is not team admin', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-456',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = { name: 'Updated Team' };
      mockTeamService.getTeamById.mockResolvedValue(existingTeam);
      mockTeamService.isTeamAdmin.mockResolvedValue(false);

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockTeamService.isTeamAdmin).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Only team administrators can update teams',
      });
    });

    it('should return 400 when trying to update default team name', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Default Team',
        slug: 'default-team',
        description: 'Default team',
        owner_id: 'user-123',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.body = { name: 'New Name' };
      mockTeamService.getTeamById.mockResolvedValue(existingTeam);
      mockTeamService.isTeamAdmin.mockResolvedValue(true);

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Default team names cannot be changed',
      });
    });

    it('should allow updating default team description', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Default Team',
        slug: 'default-team',
        description: 'Default team',
        owner_id: 'user-123',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedTeam = {
        ...existingTeam,
        description: 'Updated description',
        updated_at: new Date(),
      };

      mockRequest.body = { description: 'Updated description' };
      mockTeamService.getTeamById.mockResolvedValue(existingTeam);
      mockTeamService.isTeamAdmin.mockResolvedValue(true);
      mockTeamService.updateTeam.mockResolvedValue(updatedTeam);

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.updateTeam).toHaveBeenCalledWith('team-123', { description: 'Updated description' });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: updatedTeam,
        message: 'Team updated successfully',
      });
    });

    it('should return 400 for validation errors', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
      };

      mockRequest.body = invalidData;

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: expect.any(Array),
      });
    });

    it('should handle internal server errors', async () => {
      mockRequest.body = { name: 'Updated Team' };
      mockTeamService.getTeamById.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['PUT /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update team',
      });
    });
  });

  describe('DELETE /teams/:id - Delete Team', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { id: 'team-123' };
    });

    it('should delete team successfully as owner', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-123', // Same as request user
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getTeamById.mockResolvedValue(existingTeam);
      mockTeamService.deleteTeam.mockResolvedValue(undefined);

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockTeamService.deleteTeam).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Team deleted successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 when team is not found', async () => {
      mockTeamService.getTeamById.mockResolvedValue(null);

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Team not found',
      });
    });

    it('should return 403 when user is not team owner', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-456', // Different from request user
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getTeamById.mockResolvedValue(existingTeam);

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockTeamService.getTeamById).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Only team owners can delete teams',
      });
    });

    it('should return 400 when trying to delete default team', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Default Team',
        slug: 'default-team',
        description: 'Default team',
        owner_id: 'user-123',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getTeamById.mockResolvedValue(existingTeam);

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Default teams cannot be deleted',
      });
    });

    it('should return 400 when team has active resources', async () => {
      const existingTeam = {
        id: 'team-123',
        name: 'Test Team',
        slug: 'test-team',
        description: 'A test team',
        owner_id: 'user-123',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTeamService.getTeamById.mockResolvedValue(existingTeam);
      mockTeamService.deleteTeam.mockRejectedValue(new Error('Cannot delete team with active resources'));

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete team with active resources',
      });
    });

    it('should handle internal server errors', async () => {
      mockTeamService.getTeamById.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['DELETE /teams/:id'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete team',
        details: 'Database error',
      });
    });
  });

  describe('Schema Validation', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
    });

    it('should have proper OpenAPI schema for POST route', async () => {
      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any) => call[0] === '/teams'
      );
      
      expect(postCall).toBeDefined();
      const [, options] = postCall;
      
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Teams']);
      expect(options.schema.summary).toBe('Create new team');
      expect(options.schema.security).toEqual([{ cookieAuth: [] }]);
      expect(options.schema.body).toBeDefined();
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[201]).toBeDefined();
      expect(options.schema.response[400]).toBeDefined();
      expect(options.schema.response[401]).toBeDefined();
      expect(options.schema.response[403]).toBeDefined();
      expect(options.schema.response[500]).toBeDefined();
    });

    it('should have proper OpenAPI schema for GET route', async () => {
      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any) => call[0] === '/teams/me'
      );
      
      expect(getCall).toBeDefined();
      const [, options] = getCall;
      
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Teams']);
      expect(options.schema.summary).toBe('Get current user teams');
      expect(options.schema.security).toEqual([{ cookieAuth: [] }]);
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[200]).toBeDefined();
      expect(options.schema.response[401]).toBeDefined();
      expect(options.schema.response[500]).toBeDefined();
    });
  });

  describe('Error Handling Edge Cases', () => {
    beforeEach(async () => {
      await teamsRoute(mockFastify as FastifyInstance);
    });

    it('should handle ZodError with proper error response', async () => {
      const teamData = {
        name: '', // This will trigger ZodError
      };

      mockRequest.body = teamData;

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: expect.any(Array),
      });
    });

    it('should handle non-Error objects thrown', async () => {
      const teamData = {
        name: 'Test Team',
      };

      mockRequest.body = teamData;
      mockTeamService.canUserCreateTeam.mockResolvedValue(true);
      mockTeamService.createTeam.mockRejectedValue('String error');

      const handler = routeHandlers['POST /teams'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create team',
      });
    });
  });
});
