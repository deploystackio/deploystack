import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import resetPasswordRoute from '../../../../src/routes/auth/resetPassword';
import { PasswordResetService } from '../../../../src/services/passwordResetService';

// Mock dependencies
vi.mock('../../../../src/services/passwordResetService');

// Type the mocked functions
const mockPasswordResetService = PasswordResetService as any;

describe('Reset Password Route', () => {
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
        token: 'valid-reset-token-123',
        new_password: 'newPassword123!',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup default mock implementations
    mockPasswordResetService.isPasswordResetAvailable = vi.fn().mockResolvedValue(true);
    mockPasswordResetService.validateAndResetPassword = vi.fn().mockResolvedValue({
      success: true,
      userId: 'user-123',
    });
  });

  describe('Route Registration', () => {
    it('should register reset password route', async () => {
      await resetPasswordRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/email/reset-password', expect.any(Object), expect.any(Function));
    });
  });

  describe('POST /email/reset-password', () => {
    beforeEach(async () => {
      await resetPasswordRoute(mockFastify as FastifyInstance);
    });

    it('should reset password successfully', async () => {
      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.isPasswordResetAvailable).toHaveBeenCalled();
      expect(mockPasswordResetService.validateAndResetPassword).toHaveBeenCalledWith('valid-reset-token-123', 'newPassword123!');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Password reset attempt with token');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Password reset successful for user: user-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Password has been reset successfully. All sessions have been invalidated for security. Please log in with your new password.',
      });
    });

    it('should return 503 when password reset is not available', async () => {
      mockPasswordResetService.isPasswordResetAvailable.mockResolvedValue(false);

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.isPasswordResetAvailable).toHaveBeenCalled();
      expect(mockPasswordResetService.validateAndResetPassword).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });
    });

    it('should return 400 for invalid or expired token', async () => {
      mockPasswordResetService.validateAndResetPassword.mockResolvedValue({
        success: false,
        error: 'Invalid or expired reset token',
      });

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.validateAndResetPassword).toHaveBeenCalledWith('valid-reset-token-123', 'newPassword123!');
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired reset token',
      });
    });

    it('should return 403 for user not eligible for password reset', async () => {
      mockPasswordResetService.validateAndResetPassword.mockResolvedValue({
        success: false,
        error: 'User not found or not eligible for password reset',
      });

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.validateAndResetPassword).toHaveBeenCalledWith('valid-reset-token-123', 'newPassword123!');
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'This user is not eligible for password reset.',
      });
    });

    it('should return 500 for other service errors', async () => {
      mockPasswordResetService.validateAndResetPassword.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.validateAndResetPassword).toHaveBeenCalledWith('valid-reset-token-123', 'newPassword123!');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Database connection failed',
      });
    });

    it('should return 500 for service errors without error message', async () => {
      mockPasswordResetService.validateAndResetPassword.mockResolvedValue({
        success: false,
      });

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An error occurred during password reset.',
      });
    });

    it('should handle unexpected errors during password reset', async () => {
      mockPasswordResetService.isPasswordResetAvailable.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password reset:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password reset.',
      });
    });

    it('should handle validateAndResetPassword throwing an error', async () => {
      mockPasswordResetService.validateAndResetPassword.mockRejectedValue(new Error('Service unavailable'));

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password reset:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password reset.',
      });
    });

    it('should handle different token formats', async () => {
      mockRequest.body = {
        token: 'different-token-format-456',
        new_password: 'anotherPassword456!',
      };

      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.validateAndResetPassword).toHaveBeenCalledWith('different-token-format-456', 'anotherPassword456!');
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should log password reset attempt without exposing token', async () => {
      const handler = routeHandlers['POST /email/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.info).toHaveBeenCalledWith('Password reset attempt with token');
      // Ensure token is not logged for security
      expect(mockFastify.log!.info).not.toHaveBeenCalledWith(expect.stringContaining('valid-reset-token-123'));
    });
  });
});
