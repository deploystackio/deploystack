import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import loginEmailRoute from '../../../../src/routes/auth/loginEmail';
import { getLucia } from '../../../../src/lib/lucia';
import { verify } from '@node-rs/argon2';
import { getDb, getSchema } from '../../../../src/db';
import { GlobalSettingsInitService } from '../../../../src/global-settings';

// Mock dependencies
vi.mock('../../../../src/lib/lucia');
vi.mock('@node-rs/argon2');
vi.mock('../../../../src/db');
vi.mock('../../../../src/global-settings');
vi.mock('lucia', () => ({
  generateId: vi.fn(() => 'mock-session-id-123'),
}));

// Type the mocked functions
const mockGetLucia = getLucia as MockedFunction<typeof getLucia>;
const mockVerify = verify as MockedFunction<typeof verify>;
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockGlobalSettingsInitService = GlobalSettingsInitService as any;

describe('Login Email Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockDb: any;
  let mockSchema: any;
  let mockLucia: any;
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
        email: 'email',
        username: 'username',
        id: 'id',
        hashed_password: 'hashed_password',
        first_name: 'first_name',
        last_name: 'last_name',
        role_id: 'role_id',
      },
      authSession: {
        id: 'id',
        user_id: 'user_id',
        expires_at: 'expires_at',
      },
    };

    // Setup mock Lucia
    mockLucia = {
      createSessionCookie: vi.fn().mockReturnValue({
        name: 'session',
        value: 'session-cookie-value',
        attributes: { httpOnly: true, secure: true },
      }),
    };

    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);
    mockGetLucia.mockReturnValue(mockLucia);

    // Setup mock GlobalSettingsInitService
    mockGlobalSettingsInitService.isLoginEnabled = vi.fn().mockResolvedValue(true);

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
        login: 'test@example.com',
        password: 'password123',
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
    it('should register login route', async () => {
      await loginEmailRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/login', expect.any(Object), expect.any(Function));
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      await loginEmailRoute(mockFastify as FastifyInstance);
    });

    it('should login successfully with email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'John',
        last_name: 'Doe',
        role_id: 'user-role',
        hashed_password: 'hashed-password',
      };

      // Mock database query to return user
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select.mockReturnValue(mockQuery);
      mockDb.insert.mockReturnValue(mockQuery);

      // Mock password verification
      mockVerify.mockResolvedValue(true);

      mockRequest.body = {
        login: 'test@example.com',
        password: 'password123',
      };

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockVerify).toHaveBeenCalledWith('hashed-password', 'password123', expect.any(Object));
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockLucia.createSessionCookie).toHaveBeenCalledWith('mock-session-id-123');
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', 'session-cookie-value', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Logged in successfully.',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          first_name: 'John',
          last_name: 'Doe',
          role_id: 'user-role',
        },
      });
    });

    it('should login successfully with username', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'John',
        last_name: 'Doe',
        role_id: 'user-role',
        hashed_password: 'hashed-password',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select.mockReturnValue(mockQuery);
      mockDb.insert.mockReturnValue(mockQuery);

      mockVerify.mockResolvedValue(true);

      mockRequest.body = {
        login: 'testuser',
        password: 'password123',
      };

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Logged in successfully.',
        user: expect.objectContaining({
          id: 'user-123',
          username: 'testuser',
        }),
      });
    });

    it('should return 403 when login is disabled', async () => {
      mockGlobalSettingsInitService.isLoginEnabled.mockResolvedValue(false);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Login is currently disabled by administrator.',
      });
    });

    it('should return 500 when auth user table is missing', async () => {
      mockGetSchema.mockReturnValue({
        authUser: null,
        authSession: mockSchema.authSession,
      });

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith('AuthUser table not found in schema');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error: User table configuration missing.',
      });
    });

    it('should return 400 when user is not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // Empty array - user not found
      };
      mockDb.select.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email/username or password.',
      });
    });

    it('should return 400 when user has no hashed password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        hashed_password: null, // No password
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email/username or password.',
      });
    });

    it('should return 400 when password verification fails', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        hashed_password: 'hashed-password',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(mockQuery);

      // Mock password verification to fail
      mockVerify.mockResolvedValue(false);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockVerify).toHaveBeenCalledWith('hashed-password', 'password123', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email/username or password.',
      });
    });

    it('should return 500 when user ID is missing', async () => {
      const mockUser = {
        id: null, // Missing user ID
        email: 'test@example.com',
        username: 'testuser',
        hashed_password: 'hashed-password',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(mockQuery);

      mockVerify.mockResolvedValue(true);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith('User ID is null or undefined:', null);
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User ID not found.',
      });
    });

    it('should handle database errors during user lookup', async () => {
      const error = new Error('Database connection failed');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(error),
      };
      mockDb.select.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error during email login:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during login.',
      });
    });

    it('should handle database errors during session creation', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        hashed_password: 'hashed-password',
      };

      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockRejectedValue(new Error('Session insert failed')),
      };

      mockDb.select.mockReturnValue(selectQuery);
      mockDb.insert.mockReturnValue(insertQuery);
      mockVerify.mockResolvedValue(true);

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during email login:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during login.',
      });
    });

    it('should handle password verification errors', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        hashed_password: 'hashed-password',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(mockQuery);

      // Mock password verification to throw error
      mockVerify.mockRejectedValue(new Error('Argon2 verification failed'));

      const handler = routeHandlers['POST /login'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during email login:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during login.',
      });
    });
  });
});
