import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logoutRoute from '../../../../src/routes/auth/logout';
import { getLucia } from '../../../../src/lib/lucia';
import { getDb, getSchema, getDbStatus } from '../../../../src/db';

// Mock dependencies
vi.mock('../../../../src/lib/lucia');
vi.mock('../../../../src/db');

// Type the mocked functions
const mockGetLucia = getLucia as MockedFunction<typeof getLucia>;
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockGetDbStatus = getDbStatus as MockedFunction<typeof getDbStatus>;

describe('Logout Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockLucia: any;
  let mockDb: any;
  let mockSchema: any;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock Lucia
    mockLucia = {
      readSessionCookie: vi.fn(),
      invalidateSession: vi.fn(),
      createBlankSessionCookie: vi.fn().mockReturnValue({
        name: 'session',
        value: '',
        attributes: { httpOnly: true, secure: true, maxAge: 0 },
      }),
    };

    // Setup mock database
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      delete: vi.fn().mockReturnValue(mockQuery),
    };

    // Setup mock schema
    mockSchema = {
      authSession: {
        id: 'id',
        user_id: 'user_id',
        expires_at: 'expires_at',
      },
    };

    mockGetLucia.mockReturnValue(mockLucia);
    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);
    mockGetDbStatus.mockReturnValue({ configured: true, initialized: true, dialect: 'sqlite' });

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
      session: {
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
        fresh: false,
      },
      headers: {
        cookie: 'session=session-cookie-value',
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
    it('should register logout route', async () => {
      await logoutRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/logout', expect.any(Object), expect.any(Function));
    });
  });

  describe('POST /logout', () => {
    beforeEach(async () => {
      await logoutRoute(mockFastify as FastifyInstance);
    });

    it('should logout successfully with valid session', async () => {
      mockLucia.invalidateSession.mockResolvedValue(undefined);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.info).toHaveBeenCalledWith('Logout attempt - Session exists: true, Session ID: session-123');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Attempting to invalidate session: session-123');
      expect(mockLucia.invalidateSession).toHaveBeenCalledWith('session-123');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Session session-123 invalidated successfully');
      expect(mockLucia.createBlankSessionCookie).toHaveBeenCalled();
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully.',
      });
    });

    it('should handle logout when no session exists', async () => {
      mockRequest.session = null;
      mockLucia.readSessionCookie.mockReturnValue(null);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.info).toHaveBeenCalledWith('Logout attempt - Session exists: false, Session ID: none');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('No active session to logout - sending blank cookie');
      expect(mockLucia.createBlankSessionCookie).toHaveBeenCalled();
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'No active session to logout or already logged out.',
      });
    });

    it('should handle logout when no session exists but cookie is present', async () => {
      mockRequest.session = null;
      mockLucia.readSessionCookie.mockReturnValue('invalid-session-123');

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.delete.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.info).toHaveBeenCalledWith('Found session cookie invalid-session-123 but authHook couldn\'t validate it - attempting manual cleanup');
      expect(mockDb.delete).toHaveBeenCalledWith(mockSchema.authSession);
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Manually deleted session invalid-session-123 from database');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'No active session to logout or already logged out.',
      });
    });

    it('should handle manual cleanup when authSession table is missing', async () => {
      mockRequest.session = null;
      mockLucia.readSessionCookie.mockReturnValue('invalid-session-123');
      mockGetSchema.mockReturnValue({
        authSession: null, // Missing table
      });

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.warn).toHaveBeenCalledWith('authSession table or id column not found in schema');
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle database errors during manual cleanup', async () => {
      mockRequest.session = null;
      mockLucia.readSessionCookie.mockReturnValue('invalid-session-123');

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDb.delete.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Failed to manually delete session from database');
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle Lucia invalidation errors with fallback cleanup', async () => {
      const luciaError = new Error('Lucia invalidation failed');
      mockLucia.invalidateSession.mockRejectedValue(luciaError);

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.delete.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(luciaError, 'Error during logout (invalidating session from authHook):');
      expect(mockDb.delete).toHaveBeenCalledWith(mockSchema.authSession);
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Manually deleted session session-123 after Lucia invalidation failed');
      expect(mockLucia.createBlankSessionCookie).toHaveBeenCalled();
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully (with fallback cleanup).',
      });
    });

    it('should handle both Lucia and database errors gracefully', async () => {
      const luciaError = new Error('Lucia invalidation failed');
      const dbError = new Error('Database deletion failed');
      
      mockLucia.invalidateSession.mockRejectedValue(luciaError);

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(dbError),
      };
      mockDb.delete.mockReturnValue(mockQuery);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(luciaError, 'Error during logout (invalidating session from authHook):');
      expect(mockFastify.log!.error).toHaveBeenCalledWith(dbError, 'Failed to manually delete session after Lucia error');
      expect(mockLucia.createBlankSessionCookie).toHaveBeenCalled();
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully (with fallback cleanup).',
      });
    });

    it('should handle fallback cleanup when authSession table is missing', async () => {
      const luciaError = new Error('Lucia invalidation failed');
      mockLucia.invalidateSession.mockRejectedValue(luciaError);
      mockGetSchema.mockReturnValue({
        authSession: null, // Missing table
      });

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(luciaError, 'Error during logout (invalidating session from authHook):');
      expect(mockFastify.log!.warn).toHaveBeenCalledWith('authSession table or id column not found in schema');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully (with fallback cleanup).',
      });
    });

    it('should handle non-sqlite database dialect', async () => {
      mockRequest.session = null;
      mockLucia.readSessionCookie.mockReturnValue('invalid-session-123');
      mockGetDbStatus.mockReturnValue({ configured: true, initialized: true, dialect: null });

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      // Should not attempt database deletion for non-sqlite
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing cookie headers', async () => {
      mockRequest.session = null;
      mockRequest.headers = {}; // No cookie header
      mockLucia.readSessionCookie.mockReturnValue(null);

      const handler = routeHandlers['POST /logout'];
      await handler(mockRequest, mockReply);

      expect(mockLucia.readSessionCookie).toHaveBeenCalledWith('');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'No active session to logout or already logged out.',
      });
    });
  });
});
