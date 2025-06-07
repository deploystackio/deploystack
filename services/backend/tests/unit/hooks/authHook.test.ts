import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { authHook, requireAuthHook } from '../../../src/hooks/authHook';
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { User, Session } from 'lucia';

// Mock dependencies
vi.mock('../../../src/lib/lucia');
vi.mock('../../../src/db');

// Import mocked modules
import { getLucia } from '../../../src/lib/lucia';
import { getDbStatus, getSchema, getDb } from '../../../src/db';

// Type the mocked functions
const mockGetLucia = getLucia as MockedFunction<typeof getLucia>;
const mockGetDbStatus = getDbStatus as MockedFunction<typeof getDbStatus>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockGetDb = getDb as MockedFunction<typeof getDb>;

describe('authHook', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockLucia: any;
  let mockDb: any;
  let mockSchema: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock request
    mockRequest = {
      headers: {},
      log: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(),
        level: 'info',
        silent: vi.fn(),
      } as any,
      user: null,
      session: null,
    };

    // Setup mock reply
    mockReply = {
      setCookie: vi.fn(),
    };

    // Setup mock Lucia
    mockLucia = {
      readSessionCookie: vi.fn(),
      createBlankSessionCookie: vi.fn().mockReturnValue({
        name: 'session',
        value: '',
        attributes: {},
      }),
    };

    // Setup mock database
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    
    mockDb = {
      select: vi.fn().mockReturnValue(mockQuery),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    };

    // Setup mock schema
    mockSchema = {
      authSession: {
        id: 'session_id',
        user_id: 'user_id',
        expires_at: 'expires_at',
      },
      authUser: {
        id: 'user_id',
        username: 'username',
        email: 'email',
        first_name: 'first_name',
        last_name: 'last_name',
        auth_type: 'auth_type',
        github_id: 'github_id',
      },
    };

    // Setup default mocks
    mockGetLucia.mockReturnValue(mockLucia);
    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);
  });

  describe('when database is not configured', () => {
    it('should skip authentication and set user/session to null', async () => {
      mockGetDbStatus.mockReturnValue({
        configured: false,
        initialized: false,
        dialect: null,
      });

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockGetLucia).not.toHaveBeenCalled();
    });
  });

  describe('when database is not initialized', () => {
    it('should skip authentication and set user/session to null', async () => {
      mockGetDbStatus.mockReturnValue({
        configured: true,
        initialized: false,
        dialect: null,
      });

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockGetLucia).not.toHaveBeenCalled();
    });
  });

  describe('when database is ready', () => {
    beforeEach(() => {
      mockGetDbStatus.mockReturnValue({
        configured: true,
        initialized: true,
        dialect: 'sqlite',
      });
    });

    it('should handle missing session cookie', async () => {
      mockLucia.readSessionCookie.mockReturnValue(null);

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockRequest.log!.debug).toHaveBeenCalledWith('Auth hook: No session cookie found');
    });

    it('should handle empty cookie header', async () => {
      mockRequest.headers = { cookie: '' };
      mockLucia.readSessionCookie.mockReturnValue(null);

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
    });

    it('should handle session not found in database', async () => {
      const sessionId = 'test-session-id';
      mockRequest.headers = { cookie: 'session=test-session-id' };
      mockLucia.readSessionCookie.mockReturnValue(sessionId);
      
      // Mock the query chain to return empty result
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // Empty result
      };
      mockDb.select.mockReturnValue(mockQuery);

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', '', {});
      expect(mockRequest.log!.debug).toHaveBeenCalledWith(`Auth hook: Session ${sessionId} not found`);
    });

    it('should handle expired session', async () => {
      const sessionId = 'test-session-id';
      const expiredTime = Date.now() - 1000; // 1 second ago
      
      mockRequest.headers = { cookie: 'session=test-session-id' };
      mockLucia.readSessionCookie.mockReturnValue(sessionId);
      
      const sessionData = {
        sessionId,
        userId: 'user-123',
        expiresAt: expiredTime,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        authType: 'email',
        githubId: null,
      };
      
      // Mock the query chain to return session data
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([sessionData]),
      };
      mockDb.select.mockReturnValue(mockQuery);

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', '', {});
      expect(mockRequest.log!.debug).toHaveBeenCalledWith(`Auth hook: Session ${sessionId} is expired`);
    });

    it('should handle valid session successfully', async () => {
      const sessionId = 'test-session-id';
      const futureTime = Date.now() + 3600000; // 1 hour from now
      
      mockRequest.headers = { cookie: 'session=test-session-id' };
      mockLucia.readSessionCookie.mockReturnValue(sessionId);
      
      const sessionData = {
        sessionId,
        userId: 'user-123',
        expiresAt: futureTime,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        authType: 'email',
        githubId: null,
      };
      
      // Mock the query chain to return session data
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([sessionData]),
      };
      mockDb.select.mockReturnValue(mockQuery);

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        authType: 'email',
        githubId: null,
      });

      expect(mockRequest.session).toEqual({
        id: sessionId,
        userId: 'user-123',
        expiresAt: new Date(futureTime),
        fresh: false,
      });

      expect(mockRequest.log!.debug).toHaveBeenCalledWith(`Auth hook: Session ${sessionId} is valid for user user-123`);
    });

    it('should handle missing auth tables in schema', async () => {
      const sessionId = 'test-session-id';
      mockRequest.headers = { cookie: 'session=test-session-id' };
      mockLucia.readSessionCookie.mockReturnValue(sessionId);
      
      // Mock schema with missing tables
      mockGetSchema.mockReturnValue({
        authSession: null,
        authUser: null,
      });

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockRequest.log!.error).toHaveBeenCalledWith('Auth tables not found in schema');
    });

    it('should handle database errors gracefully', async () => {
      const sessionId = 'test-session-id';
      mockRequest.headers = { cookie: 'session=test-session-id' };
      mockLucia.readSessionCookie.mockReturnValue(sessionId);
      
      const dbError = new Error('Database connection failed');
      
      // Mock the query chain to throw an error
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(dbError),
      };
      mockDb.select.mockReturnValue(mockQuery);

      await authHook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.user).toBeNull();
      expect(mockRequest.session).toBeNull();
      expect(mockRequest.log!.error).toHaveBeenCalledWith(dbError, 'Auth hook: Error validating session');
    });
  });
});

describe('requireAuthHook', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      user: null,
      session: null,
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  it('should return 401 when user is not authenticated', async () => {
    mockRequest.user = null;
    mockRequest.session = null;

    const result = await requireAuthHook(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Unauthorized: Authentication required.',
    });
  });

  it('should return 401 when user exists but session is null', async () => {
    mockRequest.user = { id: 'user-123' } as User;
    mockRequest.session = null;

    const result = await requireAuthHook(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Unauthorized: Authentication required.',
    });
  });

  it('should return 401 when session exists but user is null', async () => {
    mockRequest.user = null;
    mockRequest.session = { id: 'session-123' } as Session;

    const result = await requireAuthHook(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Unauthorized: Authentication required.',
    });
  });

  it('should complete successfully when user and session are both present', async () => {
    mockRequest.user = { id: 'user-123' } as User;
    mockRequest.session = { id: 'session-123' } as Session;

    const result = await requireAuthHook(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.status).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
    // In modern Fastify async hooks, no done() callback is needed
    expect(result).toBeUndefined();
  });
});
