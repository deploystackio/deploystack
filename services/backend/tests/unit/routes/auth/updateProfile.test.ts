import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import updateProfileRoute from '../../../../src/routes/auth/updateProfile';
import { getDb, getSchema } from '../../../../src/db';
import { requireAuthHook } from '../../../../src/hooks/authHook';

// Mock dependencies
vi.mock('../../../../src/db');
vi.mock('../../../../src/hooks/authHook');

// Type the mocked functions
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockRequireAuthHook = requireAuthHook as MockedFunction<typeof requireAuthHook>;

describe('Update Profile Route', () => {
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
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockQuery),
      update: vi.fn().mockReturnValue(mockQuery),
    };

    // Setup mock schema
    mockSchema = {
      authUser: {
        id: 'id',
        username: 'username',
        email: 'email',
        first_name: 'first_name',
        last_name: 'last_name',
        auth_type: 'auth_type',
        role_id: 'role_id',
        updated_at: 'updated_at',
      },
    };

    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      put: vi.fn((path, options, handler) => {
        routeHandlers[`PUT ${path}`] = handler;
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
        username: 'newusername',
        first_name: 'John',
        last_name: 'Doe',
      },
      user: {
        id: 'user-123',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Mock requireAuthHook to do nothing (successful auth)
    mockRequireAuthHook.mockImplementation(() => Promise.resolve(undefined));
  });

  describe('Route Registration', () => {
    it('should register update profile route with authentication', async () => {
      await updateProfileRoute(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/profile/update',
        expect.objectContaining({
          schema: expect.any(Object),
          preHandler: requireAuthHook,
        }),
        expect.any(Function)
      );
    });
  });

  describe('PUT /profile/update', () => {
    beforeEach(async () => {
      await updateProfileRoute(mockFastify as FastifyInstance);
    });

    describe('Success Scenarios', () => {
      it('should update username only', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'oldusername',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const updatedUser = {
          ...mockUser,
          username: 'newusername',
        };

        mockRequest.body = { username: 'newusername' };

        // Mock database queries
        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([]) // Username uniqueness check
            .mockResolvedValueOnce([updatedUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: true,
          message: 'Profile updated successfully.',
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            auth_type: updatedUser.auth_type,
            role_id: updatedUser.role_id,
          },
        });
        expect(mockFastify.log!.info).toHaveBeenCalledWith('Profile updated successfully for user: user-123');
      });

      it('should update first_name only', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'OldName',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const updatedUser = {
          ...mockUser,
          first_name: 'NewName',
        };

        mockRequest.body = { first_name: 'NewName' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([updatedUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(updateQuery.set).toHaveBeenCalledWith({
          first_name: 'NewName',
          updated_at: expect.any(Date),
        });
        expect(mockReply.status).toHaveBeenCalledWith(200);
      });

      it('should update last_name only', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'OldLastName',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const updatedUser = {
          ...mockUser,
          last_name: 'NewLastName',
        };

        mockRequest.body = { last_name: 'NewLastName' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([updatedUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(updateQuery.set).toHaveBeenCalledWith({
          last_name: 'NewLastName',
          updated_at: expect.any(Date),
        });
        expect(mockReply.status).toHaveBeenCalledWith(200);
      });

      it('should update multiple fields together', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'oldusername',
          email: 'user@example.com',
          first_name: 'OldFirst',
          last_name: 'OldLast',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const updatedUser = {
          ...mockUser,
          username: 'newusername',
          first_name: 'NewFirst',
          last_name: 'NewLast',
        };

        mockRequest.body = {
          username: 'newusername',
          first_name: 'NewFirst',
          last_name: 'NewLast',
        };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([]) // Username uniqueness check
            .mockResolvedValueOnce([updatedUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(updateQuery.set).toHaveBeenCalledWith({
          username: 'newusername',
          first_name: 'NewFirst',
          last_name: 'NewLast',
          updated_at: expect.any(Date),
        });
        expect(mockReply.status).toHaveBeenCalledWith(200);
      });

      it('should update with null values for names', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const updatedUser = {
          ...mockUser,
          first_name: null,
          last_name: null,
        };

        mockRequest.body = {
          first_name: null,
          last_name: null,
        };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([updatedUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(updateQuery.set).toHaveBeenCalledWith({
          first_name: null,
          last_name: null,
          updated_at: expect.any(Date),
        });
        expect(mockReply.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Authentication & Authorization Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockRequest.user = null;

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(401);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Unauthorized: Authentication required.',
        });
      });

      it('should return 401 when user ID is missing', async () => {
        mockRequest.user = {} as any;

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(401);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Unauthorized: Authentication required.',
        });
      });

      it('should return 401 when user is not found in database', async () => {
        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // Empty array - user not found
        };
        mockDb.select.mockReturnValue(selectQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(401);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'User not found.',
        });
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 when no fields are provided', async () => {
        mockRequest.body = {};

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'At least one field (username, first_name, or last_name) must be provided.',
        });
      });

      it('should return 400 when all fields are undefined', async () => {
        mockRequest.body = {
          username: undefined,
          first_name: undefined,
          last_name: undefined,
        };

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'At least one field (username, first_name, or last_name) must be provided.',
        });
      });
    });

    describe('Business Logic Tests', () => {
      it('should return 400 when username is already taken by another user', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'oldusername',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const existingUser = {
          id: 'user-456',
          username: 'newusername',
          email: 'other@example.com',
        };

        mockRequest.body = { username: 'newusername' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([existingUser]), // Username uniqueness check - found existing user
        };

        mockDb.select.mockReturnValue(selectQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Username is already taken.',
        });
      });

      it('should allow updating to the same username (no conflict)', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'sameusername',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        mockRequest.body = { username: 'sameusername' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([mockUser]), // Updated user lookup (no uniqueness check needed)
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(updateQuery.set).toHaveBeenCalledWith({
          username: 'sameusername',
          updated_at: expect.any(Date),
        });
      });
    });

    describe('Error Handling Tests', () => {
      it('should return 500 when auth user table is missing', async () => {
        mockGetSchema.mockReturnValue({
          authUser: null,
        });

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith('AuthUser table not found in schema');
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error: User table configuration missing.',
        });
      });

      it('should handle database errors during user lookup', async () => {
        const error = new Error('Database connection failed');
        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockRejectedValue(error),
        };
        mockDb.select.mockReturnValue(selectQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error during profile update:');
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'An unexpected error occurred during profile update.',
        });
      });

      it('should handle database errors during profile update', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        mockRequest.body = { first_name: 'NewName' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockUser]),
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockRejectedValue(new Error('Database update failed')),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during profile update:');
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'An unexpected error occurred during profile update.',
        });
      });

      it('should handle general exceptions', async () => {
        // Force an error by making getDb throw
        mockGetDb.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during profile update:');
        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: false,
          error: 'An unexpected error occurred during profile update.',
        });
      });
    });

    describe('Database Operations Tests', () => {
      it('should successfully update profile when database operations complete', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        const updatedUser = {
          ...mockUser,
          first_name: 'NewName',
        };

        mockRequest.body = { first_name: 'NewName' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([updatedUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        // Verify successful response
        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          success: true,
          message: 'Profile updated successfully.',
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            auth_type: updatedUser.auth_type,
            role_id: updatedUser.role_id,
          },
        });
      });

      it('should only include provided fields in update data', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        mockRequest.body = { first_name: 'NewName' }; // Only first_name provided

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([mockUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);

        // Should only include first_name and updated_at, not username or last_name
        expect(updateQuery.set).toHaveBeenCalledWith({
          first_name: 'NewName',
          updated_at: expect.any(Date),
        });
      });

      it('should verify updated_at timestamp is set correctly', async () => {
        const mockUser = {
          id: 'user-123',
          username: 'testuser',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          auth_type: 'email_signup',
          role_id: 'role-1',
        };

        mockRequest.body = { username: 'newusername' };

        const selectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn()
            .mockResolvedValueOnce([mockUser]) // Current user lookup
            .mockResolvedValueOnce([]) // Username uniqueness check
            .mockResolvedValueOnce([mockUser]), // Updated user lookup
        };

        const updateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        };

        mockDb.select.mockReturnValue(selectQuery);
        mockDb.update.mockReturnValue(updateQuery);

        const beforeTime = new Date();
        const handler = routeHandlers['PUT /profile/update'];
        await handler(mockRequest, mockReply);
        const afterTime = new Date();

        const setCall = updateQuery.set.mock.calls[0][0];
        expect(setCall.updated_at).toBeInstanceOf(Date);
        expect(setCall.updated_at.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(setCall.updated_at.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      });
    });
  });
});
