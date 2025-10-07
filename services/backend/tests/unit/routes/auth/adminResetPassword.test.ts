import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import adminResetPasswordRoute from '../../../../src/routes/auth/adminResetPassword';
import { PasswordResetService } from '../../../../src/services/passwordResetService';
import { requireGlobalAdmin } from '../../../../src/middleware/roleMiddleware';
// Import auth hook to get the FastifyRequest augmentation
import '../../../../src/hooks/authHook';

// Mock dependencies
vi.mock('../../../../src/services/passwordResetService');
vi.mock('../../../../src/middleware/roleMiddleware');

// Type the mocked functions
const mockPasswordResetService = PasswordResetService as any;
const mockRequireGlobalAdmin = requireGlobalAdmin as MockedFunction<typeof requireGlobalAdmin>;

describe('Admin Reset Password Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;
  let mockPreHandler: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock preHandler
    mockPreHandler = vi.fn();
    mockRequireGlobalAdmin.mockReturnValue(mockPreHandler);

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
        email: 'user@example.com',
      },
      user: {
        id: 'admin-user-id',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup default mock implementations
    mockPasswordResetService.isPasswordResetAvailable = vi.fn().mockResolvedValue(true);
    mockPasswordResetService.prepareAdminResetEmail = vi.fn().mockResolvedValue({ 
      success: true,
      emailData: {
        to: 'user@example.com',
        subject: 'Password Reset Initiated by Administrator',
        template: 'admin-password-reset',
        variables: {
          userName: 'testuser',
          userEmail: 'user@example.com',
          resetUrl: 'http://localhost:5173/reset-password?token=mock-token',
          expirationTime: '10 minutes'
        }
      }
    });

    // Setup mock jobQueueService
    mockFastify.jobQueueService = {
      createJob: vi.fn().mockResolvedValue(undefined)
    } as any;
  });

  describe('Route Registration', () => {
    it('should register admin reset password route with global admin middleware', async () => {
      await adminResetPasswordRoute(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/admin/reset-password',
        expect.objectContaining({
          schema: expect.any(Object),
          preValidation: mockPreHandler,
        }),
        expect.any(Function)
      );
      expect(mockRequireGlobalAdmin).toHaveBeenCalled();
    });
  });

  describe('POST /admin/reset-password', () => {
    beforeEach(async () => {
      await adminResetPasswordRoute(mockFastify as FastifyInstance);
    });

    it('should send admin-initiated password reset email successfully', async () => {
      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.isPasswordResetAvailable).toHaveBeenCalled();
      expect(mockPasswordResetService.prepareAdminResetEmail).toHaveBeenCalledWith('user@example.com', 'admin-user-id', mockFastify.log);
      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        'Admin-initiated password reset requested by admin admin-user-id for email: user@example.com'
      );
      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        'Admin password reset email queued for user@example.com by admin admin-user-id'
      );
      expect((mockFastify as any).jobQueueService.createJob).toHaveBeenCalledWith('send_email', expect.objectContaining({
        to: 'user@example.com',
        subject: 'Password Reset Initiated by Administrator'
      }));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset email has been sent to the user.',
      });
    });

    it('should return 503 when password reset is not available', async () => {
      mockPasswordResetService.isPasswordResetAvailable.mockResolvedValue(false);

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.isPasswordResetAvailable).toHaveBeenCalled();
      expect(mockPasswordResetService.prepareAdminResetEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.prepareAdminResetEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 when user is not found or not eligible', async () => {
      mockPasswordResetService.prepareAdminResetEmail.mockResolvedValue({
        success: false,
        error: 'User not found or not eligible for password reset (must have email authentication)',
      });

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.prepareAdminResetEmail).toHaveBeenCalledWith('user@example.com', 'admin-user-id', mockFastify.log);
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        'Admin password reset preparation failed for user@example.com by admin admin-user-id: User not found or not eligible for password reset (must have email authentication)'
      );
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found or not eligible for password reset (must have email authentication)',
      });
    });

    it('should return 403 when admin tries to reset their own password', async () => {
      mockPasswordResetService.prepareAdminResetEmail.mockResolvedValue({
        success: false,
        error: 'Administrators cannot reset their own password using this endpoint',
      });

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.prepareAdminResetEmail).toHaveBeenCalledWith('user@example.com', 'admin-user-id', mockFastify.log);
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        'Admin password reset preparation failed for user@example.com by admin admin-user-id: Administrators cannot reset their own password using this endpoint'
      );
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Administrators cannot reset their own password using this endpoint',
      });
    });

    it('should return 503 when email functionality is disabled', async () => {
      mockPasswordResetService.prepareAdminResetEmail.mockResolvedValue({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });
    });

    it('should return 500 for other service errors', async () => {
      mockPasswordResetService.prepareAdminResetEmail.mockResolvedValue({
        success: false,
        error: 'SMTP configuration error',
      });

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        'Admin password reset preparation failed for user@example.com by admin admin-user-id: SMTP configuration error'
      );
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'SMTP configuration error',
      });
    });

    it('should handle unexpected errors during admin password reset request', async () => {
      mockPasswordResetService.isPasswordResetAvailable.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Error during admin-initiated password reset request:'
      );
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred during password reset request.',
      });
    });

    it('should handle prepareAdminResetEmail throwing an error', async () => {
      mockPasswordResetService.prepareAdminResetEmail.mockRejectedValue(new Error('Email service unavailable'));

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Error queueing admin password reset email for user@example.com:'
      );
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

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.prepareAdminResetEmail).toHaveBeenCalledWith('user+test@example.co.uk', 'admin-user-id', mockFastify.log);
      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        'Admin-initiated password reset requested by admin admin-user-id for email: user+test@example.co.uk'
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing user ID in request', async () => {
      mockRequest.user = { id: undefined } as any;

      const handler = routeHandlers['POST /admin/reset-password'];
      await handler(mockRequest, mockReply);

      expect(mockPasswordResetService.prepareAdminResetEmail).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });
  });
});
