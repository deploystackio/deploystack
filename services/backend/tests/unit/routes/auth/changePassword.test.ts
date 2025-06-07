import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import changePasswordRoute from '../../../../src/routes/auth/changePassword';
import { verify, hash } from '@node-rs/argon2';
import { getDb, getSchema } from '../../../../src/db';
import { requireAuthHook } from '../../../../src/hooks/authHook';

// Mock dependencies
vi.mock('@node-rs/argon2');
vi.mock('../../../../src/db');
vi.mock('../../../../src/hooks/authHook');

// Type the mocked functions
const mockVerify = verify as MockedFunction<typeof verify>;
const mockHash = hash as MockedFunction<typeof hash>;
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockRequireAuthHook = requireAuthHook as MockedFunction<typeof requireAuthHook>;

describe('Change Password Route', () => {
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
        hashed_password: 'hashed_password',
        auth_type: 'auth_type',
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
        current_password: 'currentPassword123',
        new_password: 'newPassword123',
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
    it('should register change password route with authentication', async () => {
      await changePasswordRoute(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/change-password',
        expect.objectContaining({
          schema: expect.any(Object),
          preHandler: requireAuthHook,
        }),
        expect.any(Function)
      );
    });
  });

  describe('PUT /change-password', () => {
    beforeEach(async () => {
      await changePasswordRoute(mockFastify as FastifyInstance);
    });

    it('should change password successfully', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      // Mock database query to return user
      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select.mockReturnValue(selectQuery);
      mockDb.update.mockReturnValue(updateQuery);

      // Mock password verification - current password is correct, new password is different
      mockVerify
        .mockResolvedValueOnce(true)  // Current password verification
        .mockResolvedValueOnce(false); // New password is different from current

      // Mock password hashing
      mockHash.mockResolvedValue('new-hashed-password');

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockVerify).toHaveBeenCalledTimes(2);
      expect(mockVerify).toHaveBeenNthCalledWith(1, 'current-hashed-password', 'currentPassword123', expect.any(Object));
      expect(mockVerify).toHaveBeenNthCalledWith(2, 'current-hashed-password', 'newPassword123', expect.any(Object));
      expect(mockHash).toHaveBeenCalledWith('newPassword123', expect.any(Object));
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully.',
      });
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Password changed successfully for user: user-123');
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = null;

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized: Authentication required.',
      });
    });

    it('should return 401 when user ID is missing', async () => {
      mockRequest.user = {} as any;

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized: Authentication required.',
      });
    });

    it('should return 500 when auth user table is missing', async () => {
      mockGetSchema.mockReturnValue({
        authUser: null,
      });

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith('AuthUser table not found in schema');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error: User table configuration missing.',
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

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found.',
      });
    });

    it('should return 403 when user has no hashed password', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: null,
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectQuery);

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password change is only available for email-authenticated users.',
      });
    });

    it('should return 403 when user is not email authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'hashed-password',
        auth_type: 'github_oauth',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectQuery);

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password change is only available for email-authenticated users.',
      });
    });

    it('should return 400 when current password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectQuery);

      // Mock password verification to fail for current password
      mockVerify.mockResolvedValue(false);

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockVerify).toHaveBeenCalledWith('current-hashed-password', 'currentPassword123', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Current password is incorrect.',
      });
    });

    it('should return 400 when new password is same as current password', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectQuery);

      // Mock password verification - both current and new password verification return true
      mockVerify
        .mockResolvedValueOnce(true)  // Current password verification
        .mockResolvedValueOnce(true); // New password is same as current

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockVerify).toHaveBeenCalledTimes(2);
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'New password must be different from current password.',
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

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error during password change:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password change.',
      });
    });

    it('should handle password verification errors', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectQuery);

      // Mock password verification to throw error
      mockVerify.mockRejectedValue(new Error('Argon2 verification failed'));

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password change:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password change.',
      });
    });

    it('should handle password hashing errors', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectQuery);

      // Mock password verification to succeed
      mockVerify
        .mockResolvedValueOnce(true)  // Current password verification
        .mockResolvedValueOnce(false); // New password is different

      // Mock password hashing to fail
      mockHash.mockRejectedValue(new Error('Argon2 hashing failed'));

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password change:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password change.',
      });
    });

    it('should handle database errors during password update', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

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

      // Mock password verification and hashing to succeed
      mockVerify
        .mockResolvedValueOnce(true)  // Current password verification
        .mockResolvedValueOnce(false); // New password is different
      mockHash.mockResolvedValue('new-hashed-password');

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password change:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password change.',
      });
    });

    it('should use correct argon2 configuration for password operations', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select.mockReturnValue(selectQuery);
      mockDb.update.mockReturnValue(updateQuery);

      mockVerify
        .mockResolvedValueOnce(true)  // Current password verification
        .mockResolvedValueOnce(false); // New password is different
      mockHash.mockResolvedValue('new-hashed-password');

      const expectedArgon2Config = {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      };

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(mockVerify).toHaveBeenNthCalledWith(1, 'current-hashed-password', 'currentPassword123', expectedArgon2Config);
      expect(mockVerify).toHaveBeenNthCalledWith(2, 'current-hashed-password', 'newPassword123', expectedArgon2Config);
      expect(mockHash).toHaveBeenCalledWith('newPassword123', expectedArgon2Config);
    });

    it('should update user record with new password and timestamp', async () => {
      const mockUser = {
        id: 'user-123',
        hashed_password: 'current-hashed-password',
        auth_type: 'email_signup',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select.mockReturnValue(selectQuery);
      mockDb.update.mockReturnValue(updateQuery);

      mockVerify
        .mockResolvedValueOnce(true)  // Current password verification
        .mockResolvedValueOnce(false); // New password is different
      mockHash.mockResolvedValue('new-hashed-password');

      const handler = routeHandlers['PUT /change-password'];
      await handler(mockRequest, mockReply);

      expect(updateQuery.set).toHaveBeenCalledWith({
        hashed_password: 'new-hashed-password',
        updated_at: expect.any(Date),
      });
    });
  });
});
