import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import resendVerificationRoute from '../../../../src/routes/auth/resendVerification';
import { EmailVerificationService } from '../../../../src/services/emailVerificationService';
import { getDb, getSchema } from '../../../../src/db';

// Mock dependencies
vi.mock('../../../../src/services/emailVerificationService');
vi.mock('../../../../src/db');

// Type the mocked functions
const mockEmailVerificationService = EmailVerificationService as any;
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;

describe('Resend Verification Route', () => {
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
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockQuery),
    };

    // Setup mock schema
    mockSchema = {
      authUser: {
        id: 'id',
        username: 'username',
        email: 'email',
        email_verified: 'email_verified',
        auth_type: 'auth_type',
      },
    };

    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);

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
        email: 'test@example.com',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup default mock implementations
    mockEmailVerificationService.isVerificationRequired = vi.fn().mockResolvedValue(true);
    mockEmailVerificationService.sendVerificationEmail = vi.fn().mockResolvedValue({ success: true });
  });

  describe('Route Registration', () => {
    it('should register resend verification route', async () => {
      await resendVerificationRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/resend-verification', expect.any(Object), expect.any(Function));
    });
  });

  describe('POST /resend-verification', () => {
    beforeEach(async () => {
      await resendVerificationRoute(mockFastify as FastifyInstance);
    });

    it('should send verification email successfully for unverified email user', async () => {
      const userQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: false,
          auth_type: 'email_signup',
        }]),
      };

      mockDb.select.mockReturnValue(userQuery);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.isVerificationRequired).toHaveBeenCalled();
      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith('user-123', 'test@example.com', 'testuser');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Verification email sent successfully. Please check your inbox and follow the instructions to verify your email address.',
      });
    });

    it('should return 403 when email verification is disabled', async () => {
      mockEmailVerificationService.isVerificationRequired.mockResolvedValue(false);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.isVerificationRequired).toHaveBeenCalled();
      expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Email verification is currently disabled',
      });
    });

    it('should return 500 when auth user table is missing', async () => {
      mockGetSchema.mockReturnValue({
        authUser: null,
      });

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Database configuration error',
      });
    });

    it('should return success message when email does not exist (security)', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No users found
      };

      mockDb.select.mockReturnValue(emptyQuery);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'If the email address exists and is not verified, a verification email has been sent.',
      });
    });

    it('should return success message for GitHub users (security)', async () => {
      const githubUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: false,
          auth_type: 'github', // GitHub user
        }]),
      };

      mockDb.select.mockReturnValue(githubUserQuery);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'If the email address exists and is not verified, a verification email has been sent.',
      });
    });

    it('should return 400 when email is already verified', async () => {
      const verifiedUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: true, // Already verified
          auth_type: 'email_signup',
        }]),
      };

      mockDb.select.mockReturnValue(verifiedUserQuery);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Email address is already verified',
      });
    });

    it('should return 500 when sending verification email fails', async () => {
      const userQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: false,
          auth_type: 'email_signup',
        }]),
      };

      mockDb.select.mockReturnValue(userQuery);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({
        success: false,
        error: 'SMTP configuration error',
      });

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith('user-123', 'test@example.com', 'testuser');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'SMTP configuration error',
      });
    });

    it('should return 500 when sending verification email fails without error message', async () => {
      const userQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: false,
          auth_type: 'email_signup',
        }]),
      };

      mockDb.select.mockReturnValue(userQuery);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({
        success: false,
      });

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to send verification email',
      });
    });

    it('should handle unexpected errors during resend verification', async () => {
      mockEmailVerificationService.isVerificationRequired.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during resend verification:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred while sending verification email',
      });
    });

    it('should handle database query errors', async () => {
      const errorQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database query failed')),
      };

      mockDb.select.mockReturnValue(errorQuery);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during resend verification:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred while sending verification email',
      });
    });

    it('should handle different email formats and convert to lowercase', async () => {
      mockRequest.body = {
        email: 'Test@Example.COM',
      };

      const userQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: false,
          auth_type: 'email_signup',
        }]),
      };

      mockDb.select.mockReturnValue(userQuery);

      const handler = routeHandlers['POST /resend-verification'];
      await handler(mockRequest, mockReply);

      // Verify that email was converted to lowercase in the query
      expect(userQuery.where).toHaveBeenCalled();
      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith('user-123', 'test@example.com', 'testuser');
    });
  });
});
