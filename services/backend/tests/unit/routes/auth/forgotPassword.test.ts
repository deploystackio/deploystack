import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import forgotPasswordRoute from '../../../../src/routes/auth/forgotPassword';
import { PasswordResetService } from '../../../../src/services/passwordResetService';

// Mock dependencies
vi.mock('../../../../src/services/passwordResetService');

// Type the mocked functions
const mockPasswordResetService = PasswordResetService as any;

describe('Forgot Password Route', () => {
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
        email: 'test@example.com',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup default mock implementations
    mockPasswordResetService.isPasswordResetAvailable = vi.fn().mockResolvedValue(true);
    mockPasswordResetService.sendResetEmail = vi.fn().mockResolvedValue({ success: true });
  });

  describe('Route Registration', () => {
    it('should register forgot password route', async () => {
      await forgotPasswordRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith('/email/forgot-password', expect.any(Object), expect.any(Function));
    });
  });

  describe('POST /email/forgot-password', () => {
    beforeEach(async () => {
      await forgotPasswordRoute(mockFastify as FastifyInstance);
    });

    it('should send password reset email successfully', async () => {
      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.isPasswordResetAvailable).toHaveBeenCalled();
      expect(mockPasswordResetService.sendResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Password reset requested for email: test@example.com');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'If the email address is associated with an account, a password reset link has been sent.',
      });
    });

    it('should return 503 when password reset is not available', async () => {
      mockPasswordResetService.isPasswordResetAvailable.mockResolvedValue(false);

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.isPasswordResetAvailable).toHaveBeenCalled();
      expect(mockPasswordResetService.sendResetEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });
    });

    it('should return 500 when sendResetEmail fails with error', async () => {
      mockPasswordResetService.sendResetEmail.mockResolvedValue({
        success: false,
        error: 'SMTP configuration error',
      });

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.sendResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockFastify.log!.error).toHaveBeenCalledWith('Password reset email failed for test@example.com: SMTP configuration error');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'SMTP configuration error',
      });
    });

    it('should not log security-related errors', async () => {
      mockPasswordResetService.sendResetEmail.mockResolvedValue({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });
    });

    it('should return success even when sendResetEmail fails without error message', async () => {
      mockPasswordResetService.sendResetEmail.mockResolvedValue({
        success: false,
      });

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'If the email address is associated with an account, a password reset link has been sent.',
      });
    });

    it('should handle unexpected errors during password reset request', async () => {
      mockPasswordResetService.isPasswordResetAvailable.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password reset request:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password reset request.',
      });
    });

    it('should handle sendResetEmail throwing an error', async () => {
      mockPasswordResetService.sendResetEmail.mockRejectedValue(new Error('Email service unavailable'));

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during password reset request:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password reset request.',
      });
    });

    it('should handle different email formats', async () => {
      mockRequest.body = {
        email: 'user+test@example.co.uk',
      };

      const handler = routeHandlers['POST /email/forgot-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.sendResetEmail).toHaveBeenCalledWith('user+test@example.co.uk');
      expect(mockFastify.log!.info).toHaveBeenCalledWith('Password reset requested for email: user+test@example.co.uk');
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });
});
