import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import verifyEmailRoute from '../../../../src/routes/auth/verifyEmail';
import { EmailVerificationService } from '../../../../src/services/emailVerificationService';

// Mock dependencies
vi.mock('../../../../src/services/emailVerificationService');

// Type the mocked functions
const mockEmailVerificationService = EmailVerificationService as any;

describe('Verify Email Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
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
      query: {
        token: 'valid-verification-token-123',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup default mock implementations
    mockEmailVerificationService.verifyEmailToken = vi.fn().mockResolvedValue({
      success: true,
      userId: 'user-123',
    });
    mockEmailVerificationService.cleanupExpiredTokens = vi.fn().mockResolvedValue(undefined);
  });

  describe('Route Registration', () => {
    it('should register verify email route', async () => {
      await verifyEmailRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/verify', expect.any(Object), expect.any(Function));
    });
  });

  describe('GET /verify', () => {
    beforeEach(async () => {
      await verifyEmailRoute(mockFastify as FastifyInstance);
    });

    it('should verify email successfully', async () => {
      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith('valid-verification-token-123');
      expect(mockEmailVerificationService.cleanupExpiredTokens).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully. You can now log in to your account.',
        userId: 'user-123',
      });
    });

    it('should return 400 for invalid token', async () => {
      mockEmailVerificationService.verifyEmailToken.mockResolvedValue({
        success: false,
        error: 'Invalid verification token',
      });

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith('valid-verification-token-123');
      expect(mockEmailVerificationService.cleanupExpiredTokens).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid verification token',
      });
    });

    it('should return 400 for expired token', async () => {
      mockEmailVerificationService.verifyEmailToken.mockResolvedValue({
        success: false,
        error: 'Verification token has expired',
      });

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith('valid-verification-token-123');
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Verification token has expired',
      });
    });

    it('should return 400 with default error message when no error provided', async () => {
      mockEmailVerificationService.verifyEmailToken.mockResolvedValue({
        success: false,
      });

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired verification token',
      });
    });

    it('should handle cleanup failure gracefully', async () => {
      mockEmailVerificationService.cleanupExpiredTokens.mockRejectedValue(new Error('Cleanup failed'));

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith('valid-verification-token-123');
      expect(mockEmailVerificationService.cleanupExpiredTokens).toHaveBeenCalled();
      expect(mockFastify.log!.warn).toHaveBeenCalledWith('Failed to cleanup expired tokens:', expect.any(Error));
      // Should still return success despite cleanup failure
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully. You can now log in to your account.',
        userId: 'user-123',
      });
    });

    it('should handle unexpected errors during verification', async () => {
      mockEmailVerificationService.verifyEmailToken.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during email verification:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during verification',
      });
    });

    it('should handle different token formats', async () => {
      mockRequest.query = {
        token: 'different-token-format-456',
      };

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith('different-token-format-456');
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing token parameter', async () => {
      mockRequest.query = {};

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith(undefined);
      // The service should handle undefined token and return appropriate error
    });

    it('should handle empty token parameter', async () => {
      mockRequest.query = {
        token: '',
      };

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockEmailVerificationService.verifyEmailToken).toHaveBeenCalledWith('');
    });

    it('should return different user IDs correctly', async () => {
      mockEmailVerificationService.verifyEmailToken.mockResolvedValue({
        success: true,
        userId: 'different-user-456',
      });

      const handler = routeHandlers['GET /verify'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully. You can now log in to your account.',
        userId: 'different-user-456',
      });
    });
  });
});
