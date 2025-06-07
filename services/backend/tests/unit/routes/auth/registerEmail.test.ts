import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import registerEmailRoute from '../../../../src/routes/auth/registerEmail';
import { getDb, getSchema } from '../../../../src/db';
import { hash } from '@node-rs/argon2';
import { generateId } from 'lucia';
import { TeamService } from '../../../../src/services/teamService';
import { GlobalSettingsInitService } from '../../../../src/global-settings';
import { EmailVerificationService } from '../../../../src/services/emailVerificationService';

// Mock dependencies
vi.mock('../../../../src/db');
vi.mock('@node-rs/argon2');
vi.mock('lucia');
vi.mock('../../../../src/services/teamService');
vi.mock('../../../../src/global-settings');
vi.mock('../../../../src/services/emailVerificationService');
vi.mock('../../../../src/lib/lucia', () => ({
  getLucia: vi.fn(() => ({
    createSessionCookie: vi.fn(() => ({
      name: 'session',
      value: 'session-cookie-value',
      attributes: { httpOnly: true, secure: true },
    })),
  })),
}));

// Type the mocked functions
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockHash = hash as MockedFunction<typeof hash>;
const mockGenerateId = generateId as MockedFunction<typeof generateId>;
const mockTeamService = TeamService as any;
const mockGlobalSettingsInitService = GlobalSettingsInitService as any;
const mockEmailVerificationService = EmailVerificationService as any;

describe('Register Email Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockDb: any;
  let mockSchema: any;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock database
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockQuery),
      insert: vi.fn().mockReturnValue(mockQuery),
    };

    // Setup mock schema
    mockSchema = {
      authUser: {
        id: 'id',
        username: 'username',
        email: 'email',
        auth_type: 'auth_type',
        first_name: 'first_name',
        last_name: 'last_name',
        github_id: 'github_id',
        hashed_password: 'hashed_password',
        role_id: 'role_id',
      },
      authSession: {
        id: 'id',
        user_id: 'user_id',
        expires_at: 'expires_at',
      },
    };

    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);

    // Setup mock functions
    mockHash.mockResolvedValue('hashed-password-123');
    mockGenerateId.mockReturnValueOnce('user-id-123').mockReturnValueOnce('session-id-123');
    mockGlobalSettingsInitService.isEmailRegistrationEnabled = vi.fn().mockResolvedValue(true);
    mockTeamService.createDefaultTeamForUser = vi.fn().mockResolvedValue({ id: 'team-123', name: 'Default Team' });
    mockEmailVerificationService.isVerificationRequired = vi.fn().mockResolvedValue(false);

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      post: vi.fn((path, options, handler) => {
        routeHandlers[`POST ${path}`] = handler;
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
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register registration route', async () => {
      await registerEmailRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/register', expect.any(Object), expect.any(Function));
    });
  });

  describe('POST /register', () => {
    beforeEach(async () => {
      await registerEmailRoute(mockFastify as FastifyInstance);
    });

    it('should register first user as global admin successfully', async () => {
      // Mock empty database (first user)
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing users
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      const createdUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-id-123',
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role_id: 'global_admin',
        }]),
      };

      mockDb.select
        .mockReturnValueOnce(emptyQuery) // Check for existing users by username/email
        .mockReturnValueOnce(emptyQuery) // Check if first user
        .mockReturnValueOnce(createdUserQuery); // Get created user

      mockDb.insert.mockReturnValue(emptyQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockHash).toHaveBeenCalledWith('password123', expect.any(Object));
      expect(mockGenerateId).toHaveBeenCalledWith(15); // User ID
      expect(mockGenerateId).toHaveBeenCalledWith(40); // Session ID
      expect(mockTeamService.createDefaultTeamForUser).toHaveBeenCalledWith('user-id-123', 'testuser');
      expect(mockReply.setCookie).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully. You are now logged in as the global administrator.',
        user: {
          id: 'user-id-123',
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role_id: 'global_admin',
        },
      });
    });

    it('should register subsequent user as global_user', async () => {
      // Mock existing users in database
      const existingUsersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No conflicts
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      const hasUsersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-user' }]), // Has existing users
      };

      const createdUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-id-123',
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role_id: 'global_user',
        }]),
      };

      mockDb.select
        .mockReturnValueOnce(existingUsersQuery) // Check for existing users by username/email
        .mockReturnValueOnce(hasUsersQuery) // Check if first user
        .mockReturnValueOnce(createdUserQuery); // Get created user

      mockDb.insert.mockReturnValue(existingUsersQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully. You can now log in to your account.',
        user: expect.objectContaining({
          role_id: 'global_user',
        }),
      });
    });

    it('should register user without optional fields', async () => {
      mockRequest.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      const createdUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-id-123',
          username: 'testuser',
          email: 'test@example.com',
          first_name: null,
          last_name: null,
          role_id: 'global_admin',
        }]),
      };

      mockDb.select
        .mockReturnValueOnce(emptyQuery)
        .mockReturnValueOnce(emptyQuery)
        .mockReturnValueOnce(createdUserQuery);

      mockDb.insert.mockReturnValue(emptyQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully. You are now logged in as the global administrator.',
        user: expect.objectContaining({
          first_name: null,
          last_name: null,
        }),
      });
    });

    it('should return 403 when email registration is disabled', async () => {
      mockGlobalSettingsInitService.isEmailRegistrationEnabled.mockResolvedValue(false);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Email registration is currently disabled by administrator.',
      });
    });

    it('should return 500 when auth user table is missing', async () => {
      mockGetSchema.mockReturnValue({
        authUser: null,
        authSession: mockSchema.authSession,
      });

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith('AuthUser table not found in schema');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Internal server error: User table configuration missing.',
      });
    });

    it('should return 400 when username already exists', async () => {
      const conflictQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ username: 'testuser' }]), // Username conflict
      };

      const usernameCheckQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ username: 'testuser' }]), // Username exists
      };

      mockDb.select
        .mockReturnValueOnce(conflictQuery) // Initial conflict check
        .mockReturnValueOnce(usernameCheckQuery); // Username specific check

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Username already taken.',
      });
    });

    it('should return 400 when email already exists', async () => {
      const conflictQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ email: 'test@example.com' }]), // Email conflict
      };

      const usernameCheckQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // Username doesn't exist
      };

      const emailCheckQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ email: 'test@example.com' }]), // Email exists
      };

      mockDb.select
        .mockReturnValueOnce(conflictQuery) // Initial conflict check
        .mockReturnValueOnce(usernameCheckQuery) // Username specific check
        .mockReturnValueOnce(emailCheckQuery); // Email specific check

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Email address already in use.',
      });
    });

    it('should return 500 when user creation fails', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      const failedUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // User not found after creation
      };

      mockDb.select
        .mockReturnValueOnce(emptyQuery) // No conflicts
        .mockReturnValueOnce(emptyQuery) // First user check
        .mockReturnValueOnce(failedUserQuery); // User not found after creation

      mockDb.insert.mockReturnValue(emptyQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith('User creation failed - user not found after insert');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'User creation failed.',
      });
    });

    it('should handle team creation failure gracefully', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      const createdUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-id-123',
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role_id: 'global_admin',
        }]),
      };

      mockDb.select
        .mockReturnValueOnce(emptyQuery)
        .mockReturnValueOnce(emptyQuery)
        .mockReturnValueOnce(createdUserQuery);

      mockDb.insert.mockReturnValue(emptyQuery);

      // Mock team creation failure
      mockTeamService.createDefaultTeamForUser.mockRejectedValue(new Error('Team creation failed'));

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Failed to create default team for user session-id-123:');
      // Should still succeed despite team creation failure
      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should handle database errors during registration', async () => {
      const errorQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      mockDb.select.mockReturnValue(errorQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during email registration:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during registration.',
      });
    });

    it('should handle unique constraint error for username', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: authUser.username')),
      };

      mockDb.select.mockReturnValue(emptyQuery);
      mockDb.insert.mockReturnValue(emptyQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Username already taken.',
      });
    });

    it('should handle unique constraint error for email', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: authUser.email')),
      };

      mockDb.select.mockReturnValue(emptyQuery);
      mockDb.insert.mockReturnValue(emptyQuery);

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Email address already in use.',
      });
    });

    it('should handle password hashing errors', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(emptyQuery);
      mockHash.mockRejectedValue(new Error('Hashing failed'));

      const handler = routeHandlers['POST /register'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during email registration:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during registration.',
      });
    });
  });
});
