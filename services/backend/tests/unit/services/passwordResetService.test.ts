import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PasswordResetService } from '../../../src/services/passwordResetService';
import { getDb, getSchema } from '../../../src/db';
import { EmailService } from '../../../src/email';
import { GlobalSettings } from '../../../src/global-settings/helpers';
import { eq, and } from 'drizzle-orm';

// Mock dependencies
vi.mock('../../../src/db');
vi.mock('../../../src/email');
vi.mock('../../../src/global-settings/helpers');
vi.mock('lucia', () => ({
  generateId: vi.fn(() => 'mock-token-id'),
}));
vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn(() => Promise.resolve('hashed-token')),
  verify: vi.fn(() => Promise.resolve(true)),
}));

// Type the mocked functions
const mockGetDb = getDb as any;
const mockGetSchema = getSchema as any;
const mockEmailService = EmailService as any;
const mockGlobalSettings = GlobalSettings as any;

describe('PasswordResetService - Admin Reset Email', () => {
  let mockDb: any;
  let mockSchema: any;
  let mockAuthUserTable: any;
  let mockPasswordResetTokensTable: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    // Setup mock database tables
    mockAuthUserTable = {
      id: 'id',
      email: 'email',
      auth_type: 'auth_type',
      username: 'username',
    };

    mockPasswordResetTokensTable = {
      id: 'id',
      user_id: 'user_id',
      token_hash: 'token_hash',
      expires_at: 'expires_at',
    };

    mockSchema = {
      authUser: mockAuthUserTable,
      passwordResetTokens: mockPasswordResetTokensTable,
    };

    // Setup mock database operations
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    // Setup mock returns
    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);

    // Setup default mock implementations
    mockGlobalSettings.getBoolean = vi.fn().mockResolvedValue(true);
    mockGlobalSettings.get = vi.fn().mockImplementation((key, defaultValue) => {
      if (key === 'global.page_url') {
        return Promise.resolve('http://localhost:5173');
      }
      if (key === 'smtp.from_email') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(defaultValue);
    });
    mockEmailService.sendEmail = vi.fn().mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('prepareAdminResetEmail', () => {
    it('should prepare admin reset email successfully', async () => {
      // Mock user found with email auth
      mockDb.limit.mockResolvedValue([
        {
          id: 'user-123',
          email: 'user@example.com',
          username: 'testuser',
          auth_type: 'email_signup',
        },
      ]);

      // Mock token creation
      const createResetTokenSpy = vi.spyOn(PasswordResetService, 'createResetToken')
        .mockResolvedValue('mock-reset-token');

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(mockGlobalSettings.getBoolean).toHaveBeenCalledWith('smtp.enabled', false);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalledWith(
        and(
          eq(mockAuthUserTable.email, 'user@example.com'),
          eq(mockAuthUserTable.auth_type, 'email_signup')
        )
      );
      expect(createResetTokenSpy).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ 
        success: true,
        emailData: {
          to: 'user@example.com',
          subject: 'Password Reset Initiated by Administrator',
          template: 'admin-password-reset',
          variables: {
            userName: 'testuser',
            userEmail: 'user@example.com',
            resetUrl: 'http://localhost:5173/reset-password?token=mock-reset-token',
            expirationTime: '10 minutes',
            supportEmail: undefined,
          },
        }
      });

      createResetTokenSpy.mockRestore();
    });

    it('should fail when email sending is disabled', async () => {
      mockGlobalSettings.getBoolean.mockResolvedValue(false);

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(mockGlobalSettings.getBoolean).toHaveBeenCalledWith('smtp.enabled', false);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'Password reset is currently disabled. Email functionality is not enabled.',
      });
    });

    it('should fail when database tables are not available', async () => {
      mockSchema.authUser = null;

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(result).toEqual({
        success: false,
        error: 'Database configuration error',
      });
    });

    it('should fail when user is not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(mockDb.where).toHaveBeenCalledWith(
        and(
          eq(mockAuthUserTable.email, 'user@example.com'),
          eq(mockAuthUserTable.auth_type, 'email_signup')
        )
      );
      expect(result).toEqual({
        success: false,
        error: 'User not found or not eligible for password reset (must have email authentication)',
      });
    });

    it('should fail when user does not have email auth type', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await PasswordResetService.prepareAdminResetEmail('github-user@example.com', 'admin-123', mockLogger);

      expect(mockDb.where).toHaveBeenCalledWith(
        and(
          eq(mockAuthUserTable.email, 'github-user@example.com'),
          eq(mockAuthUserTable.auth_type, 'email_signup')
        )
      );
      expect(result).toEqual({
        success: false,
        error: 'User not found or not eligible for password reset (must have email authentication)',
      });
    });

    it('should fail when admin tries to reset their own password', async () => {
      mockDb.limit.mockResolvedValue([
        {
          id: 'admin-123', // Same as admin user ID
          email: 'admin@example.com',
          username: 'admin',
          auth_type: 'email_signup',
        },
      ]);

      const result = await PasswordResetService.prepareAdminResetEmail('admin@example.com', 'admin-123', mockLogger);

      expect(result).toEqual({
        success: false,
        error: 'Administrators cannot reset their own password using this endpoint',
      });
    });

    it('should handle token creation failure', async () => {
      mockDb.limit.mockResolvedValue([
        {
          id: 'user-123',
          email: 'user@example.com',
          username: 'testuser',
          auth_type: 'email_signup',
        },
      ]);

      const createResetTokenSpy = vi.spyOn(PasswordResetService, 'createResetToken')
        .mockRejectedValue(new Error('Token creation failed'));

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(result).toEqual({
        success: false,
        error: 'An error occurred while preparing reset email',
      });

      createResetTokenSpy.mockRestore();
    });

    it('should handle database query failure', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database query failed'));

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          email: 'user@example.com',
          adminUserId: 'admin-123',
          operation: 'prepare_admin_reset_email'
        }),
        'Error preparing admin-initiated password reset email'
      );
      expect(result).toEqual({
        success: false,
        error: 'An error occurred while preparing reset email',
      });
    });

    it('should handle unexpected errors', async () => {
      mockGlobalSettings.getBoolean.mockRejectedValue(new Error('Database connection failed'));

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          email: 'user@example.com',
          adminUserId: 'admin-123',
          operation: 'prepare_admin_reset_email'
        }),
        'Error preparing admin-initiated password reset email'
      );
      expect(result).toEqual({
        success: false,
        error: 'An error occurred while preparing reset email',
      });
    });

    it('should use custom frontend URL from settings', async () => {
      mockDb.limit.mockResolvedValue([
        {
          id: 'user-123',
          email: 'user@example.com',
          username: 'testuser',
          auth_type: 'email_signup',
        },
      ]);

      mockGlobalSettings.get.mockImplementation((key, defaultValue) => {
        if (key === 'global.page_url') {
          return Promise.resolve('https://custom-domain.com');
        }
        return Promise.resolve(defaultValue);
      });

      const createResetTokenSpy = vi.spyOn(PasswordResetService, 'createResetToken')
        .mockResolvedValue('mock-reset-token');

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          emailData: expect.objectContaining({
            variables: expect.objectContaining({
              resetUrl: 'https://custom-domain.com/reset-password?token=mock-reset-token',
            }),
          }),
        })
      );

      createResetTokenSpy.mockRestore();
    });

    it('should include support email when available', async () => {
      mockDb.limit.mockResolvedValue([
        {
          id: 'user-123',
          email: 'user@example.com',
          username: 'testuser',
          auth_type: 'email_signup',
        },
      ]);

      mockGlobalSettings.get.mockImplementation((key) => {
        if (key === 'smtp.from_email') {
          return Promise.resolve('support@example.com');
        }
        if (key === 'global.page_url') {
          return Promise.resolve('http://localhost:5173');
        }
        return Promise.resolve(undefined);
      });

      const createResetTokenSpy = vi.spyOn(PasswordResetService, 'createResetToken')
        .mockResolvedValue('mock-reset-token');

      const result = await PasswordResetService.prepareAdminResetEmail('user@example.com', 'admin-123', mockLogger);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          emailData: expect.objectContaining({
            variables: expect.objectContaining({
              supportEmail: 'support@example.com',
            }),
          }),
        })
      );

      createResetTokenSpy.mockRestore();
    });
  });
});
