import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { Transporter } from 'nodemailer';
import { EmailService } from '../../../src/email/emailService';
import type { SendEmailOptions, EmailSendResult, SmtpConfiguration } from '../../../src/email/types';

// Create mock functions using vi.hoisted
const { mockCreateTransporter, mockSendMail, mockVerify, mockGetByGroup, mockRender, mockValidateTemplate, mockGetAvailableTemplates, mockEnsureTemplatesDirectory } = vi.hoisted(() => ({
  mockCreateTransporter: vi.fn(),
  mockSendMail: vi.fn(),
  mockVerify: vi.fn(),
  mockGetByGroup: vi.fn(),
  mockRender: vi.fn(),
  mockValidateTemplate: vi.fn(),
  mockGetAvailableTemplates: vi.fn(),
  mockEnsureTemplatesDirectory: vi.fn(),
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransporter,
  },
  createTransport: mockCreateTransporter,
}));

// Mock GlobalSettingsService
vi.mock('../../../src/services/globalSettingsService', () => ({
  GlobalSettingsService: {
    getByGroup: mockGetByGroup,
  },
}));

// Mock TemplateRenderer
vi.mock('../../../src/email/templateRenderer', () => ({
  TemplateRenderer: {
    render: mockRender,
    validateTemplate: mockValidateTemplate,
    getAvailableTemplates: mockGetAvailableTemplates,
    ensureTemplatesDirectory: mockEnsureTemplatesDirectory,
  },
}));

describe('EmailService', () => {
  let mockTransporter: Partial<Transporter>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  const mockSmtpSettings = [
    { key: 'smtp.host', value: 'smtp.example.com' },
    { key: 'smtp.port', value: '587' },
    { key: 'smtp.username', value: 'test@example.com' },
    { key: 'smtp.password', value: 'password123' },
    { key: 'smtp.secure', value: 'false' },
    { key: 'smtp.from_name', value: 'Test App' },
    { key: 'smtp.from_email', value: 'noreply@example.com' },
  ];

  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Setup console spies
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup mock transporter
    mockTransporter = {
      sendMail: mockSendMail,
      verify: mockVerify,
    };
    
    mockCreateTransporter.mockReturnValue(mockTransporter);
    mockGetByGroup.mockResolvedValue(mockSmtpSettings);
    mockRender.mockResolvedValue('<html><body>Test email</body></html>');
    mockEnsureTemplatesDirectory.mockImplementation(() => {});
    
    // Reset EmailService internal state by calling refreshConfiguration
    await EmailService.refreshConfiguration();
    
    // Clear all mocks after the initial refresh to get clean call counts
    mockCreateTransporter.mockClear();
    mockGetByGroup.mockClear();
    mockSendMail.mockClear();
    mockVerify.mockClear();
    mockRender.mockClear();
    mockEnsureTemplatesDirectory.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('sendEmail', () => {
    const validEmailOptions: SendEmailOptions = {
      to: 'recipient@example.com',
      subject: 'Test Subject',
      template: 'welcome',
      variables: { userName: 'John Doe' },
    };

    it('should send email successfully with valid options', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockSendMail.mockResolvedValue(mockInfo);

      const result = await EmailService.sendEmail(validEmailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.recipients).toEqual(['recipient@example.com']);
      expect(mockRender).toHaveBeenCalledWith({
        template: 'welcome',
        variables: { userName: 'John Doe' },
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Test App" <noreply@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<html><body>Test email</body></html>',
        attachments: undefined,
        replyTo: undefined,
        cc: undefined,
        bcc: undefined,
      });
    });

    it('should handle multiple recipients', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockSendMail.mockResolvedValue(mockInfo);
      
      const options = {
        ...validEmailOptions,
        to: ['user1@example.com', 'user2@example.com'],
      };

      const result = await EmailService.sendEmail(options);

      expect(result.success).toBe(true);
      expect(result.recipients).toEqual(['user1@example.com', 'user2@example.com']);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user1@example.com, user2@example.com',
      }));
    });

    it('should handle CC and BCC recipients', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockSendMail.mockResolvedValue(mockInfo);
      
      const options = {
        ...validEmailOptions,
        cc: ['cc@example.com'],
        bcc: 'bcc@example.com',
      };

      const result = await EmailService.sendEmail(options);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
      }));
    });

    it('should handle attachments', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockSendMail.mockResolvedValue(mockInfo);
      
      const options = {
        ...validEmailOptions,
        attachments: [{
          filename: 'test.txt',
          content: 'Test content',
          contentType: 'text/plain',
        }],
      };

      const result = await EmailService.sendEmail(options);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: options.attachments,
      }));
    });

    it('should use custom from address when provided', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockSendMail.mockResolvedValue(mockInfo);
      
      const options = {
        ...validEmailOptions,
        from: {
          name: 'Custom Sender',
          email: 'custom@example.com',
        },
      };

      const result = await EmailService.sendEmail(options);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        from: '"Custom Sender" <custom@example.com>',
      }));
    });

    it('should return error when SMTP is not configured', async () => {
      mockGetByGroup.mockResolvedValue([]);
      // Force refresh to pick up the empty configuration
      try {
        await EmailService.refreshConfiguration();
      } catch (error) {
        // Expected to throw when no configuration is available
      }
      
      const result = await EmailService.sendEmail(validEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP configuration is not complete');
      expect(result.recipients).toEqual(['recipient@example.com']);
    });

    it('should return error when email sending fails', async () => {
      const sendError = new Error('SMTP connection failed');
      mockSendMail.mockRejectedValue(sendError);

      const result = await EmailService.sendEmail(validEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
      expect(result.recipients).toEqual(['recipient@example.com']);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send email:', sendError);
    });

    it('should return error when template rendering fails', async () => {
      const renderError = new Error('Template not found');
      mockRender.mockRejectedValue(renderError);

      const result = await EmailService.sendEmail(validEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
      expect(result.recipients).toEqual(['recipient@example.com']);
    });

    it('should validate email options with Zod schema', async () => {
      const invalidOptions = {
        to: 'invalid-email',
        subject: '',
        template: '',
      };

      const result = await EmailService.sendEmail(invalidOptions as SendEmailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });
  });

  describe('testConnection', () => {
    it('should return success when connection test passes', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await EmailService.testConnection();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should return error when connection test fails', async () => {
      const connectionError = new Error('Connection timeout');
      mockVerify.mockRejectedValue(connectionError);

      const result = await EmailService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('should return error when SMTP is not configured', async () => {
      mockGetByGroup.mockResolvedValue([]);
      // Force refresh to pick up the empty configuration
      try {
        await EmailService.refreshConfiguration();
      } catch (error) {
        // Expected to throw when no configuration is available
      }

      const result = await EmailService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP configuration is not complete. Please configure SMTP settings in global settings.');
    });
  });

  describe('getSmtpStatus', () => {
    it('should return configured true when SMTP is properly configured', async () => {
      const result = await EmailService.getSmtpStatus();

      expect(result.configured).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return configured false when SMTP is not configured', async () => {
      mockGetByGroup.mockResolvedValue([]);

      const result = await EmailService.getSmtpStatus();

      expect(result.configured).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return error when configuration loading fails', async () => {
      const configError = new Error('Database connection failed');
      mockGetByGroup.mockRejectedValue(configError);

      const result = await EmailService.getSmtpStatus();

      expect(result.configured).toBe(false);
      expect(result.error).toBeUndefined(); // The error is caught and logged, but not returned
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load SMTP configuration:', configError);
    });
  });

  describe('refreshConfiguration', () => {
    it('should reset internal state and reload configuration', async () => {
      // First call to establish state
      await EmailService.getSmtpStatus();
      expect(mockGetByGroup).toHaveBeenCalledTimes(1);

      // Refresh configuration - this will call getByGroup once more
      await EmailService.refreshConfiguration();
      expect(mockGetByGroup).toHaveBeenCalledTimes(2);

      // Next call should reload configuration again
      await EmailService.getSmtpStatus();
      expect(mockGetByGroup).toHaveBeenCalledTimes(3);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available templates', () => {
      const mockTemplates = ['welcome', 'password-reset', 'notification'];
      mockGetAvailableTemplates.mockReturnValue(mockTemplates);

      const result = EmailService.getAvailableTemplates();

      expect(result).toEqual(mockTemplates);
      expect(mockGetAvailableTemplates).toHaveBeenCalled();
    });
  });

  describe('validateTemplate', () => {
    it('should validate template with given variables', async () => {
      const mockValidation = {
        valid: true,
        errors: [],
        missingVariables: [],
      };
      mockValidateTemplate.mockResolvedValue(mockValidation);

      const result = await EmailService.validateTemplate('welcome', { userName: 'John' });

      expect(result).toEqual(mockValidation);
      expect(mockValidateTemplate).toHaveBeenCalledWith('welcome', { userName: 'John' });
    });
  });

  describe('Type-safe email helpers', () => {
    beforeEach(() => {
      const mockInfo = { messageId: 'test-message-id' };
      mockSendMail.mockResolvedValue(mockInfo);
    });

    describe('sendWelcomeEmail', () => {
      it('should send welcome email with correct template and variables', async () => {
        const options = {
          to: 'user@example.com',
          userName: 'John Doe',
          userEmail: 'user@example.com',
          loginUrl: 'https://app.example.com/login',
          supportEmail: 'support@example.com',
        };

        const result = await EmailService.sendWelcomeEmail(options);

        expect(result.success).toBe(true);
        expect(mockRender).toHaveBeenCalledWith({
          template: 'welcome',
          variables: {
            userName: 'John Doe',
            userEmail: 'user@example.com',
            loginUrl: 'https://app.example.com/login',
            supportEmail: 'support@example.com',
          },
        });
        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome to DeployStack, John Doe!',
        }));
      });

      it('should use default support email when not provided', async () => {
        const options = {
          to: 'user@example.com',
          userName: 'John Doe',
          userEmail: 'user@example.com',
          loginUrl: 'https://app.example.com/login',
        };

        await EmailService.sendWelcomeEmail(options);

        expect(mockRender).toHaveBeenCalledWith({
          template: 'welcome',
          variables: expect.objectContaining({
            supportEmail: 'support@deploystack.com',
          }),
        });
      });
    });

    describe('sendPasswordResetEmail', () => {
      it('should send password reset email with correct template and variables', async () => {
        const options = {
          to: 'user@example.com',
          userName: 'John Doe',
          resetUrl: 'https://app.example.com/reset?token=abc123',
          expirationTime: '24 hours',
        };

        const result = await EmailService.sendPasswordResetEmail(options);

        expect(result.success).toBe(true);
        expect(mockRender).toHaveBeenCalledWith({
          template: 'password-reset',
          variables: {
            userName: 'John Doe',
            resetUrl: 'https://app.example.com/reset?token=abc123',
            expirationTime: '24 hours',
            supportEmail: 'support@deploystack.com',
          },
        });
        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset Your DeployStack Password',
        }));
      });
    });

    describe('sendNotificationEmail', () => {
      it('should send notification email with correct template and variables', async () => {
        const options = {
          to: 'user@example.com',
          title: 'Deployment Complete',
          message: 'Your app has been deployed successfully.',
          actionUrl: 'https://app.example.com/deployments/123',
          actionText: 'View Deployment',
          userName: 'John Doe',
        };

        const result = await EmailService.sendNotificationEmail(options);

        expect(result.success).toBe(true);
        expect(mockRender).toHaveBeenCalledWith({
          template: 'notification',
          variables: {
            title: 'Deployment Complete',
            message: 'Your app has been deployed successfully.',
            actionUrl: 'https://app.example.com/deployments/123',
            actionText: 'View Deployment',
            userName: 'John Doe',
          },
        });
        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
          to: 'user@example.com',
          subject: 'Deployment Complete',
        }));
      });
    });
  });

  describe('SMTP Configuration Loading', () => {
    it('should handle missing required SMTP settings', async () => {
      const incompleteSettings = [
        { key: 'smtp.host', value: 'smtp.example.com' },
        { key: 'smtp.port', value: '587' },
        // Missing username and password
      ];
      mockGetByGroup.mockResolvedValue(incompleteSettings);

      const result = await EmailService.getSmtpStatus();

      expect(result.configured).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Incomplete SMTP configuration. Missing required settings:',
        expect.objectContaining({
          host: true,
          port: true,
          username: false,
          password: false,
        })
      );
    });

    it('should handle invalid port number', async () => {
      const invalidPortSettings = [
        ...mockSmtpSettings.filter(s => s.key !== 'smtp.port'),
        { key: 'smtp.port', value: 'invalid-port' },
      ];
      mockGetByGroup.mockResolvedValue(invalidPortSettings);

      const result = await EmailService.getSmtpStatus();

      expect(result.configured).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid SMTP port:', 'invalid-port');
    });

    it('should handle port number out of range', async () => {
      const outOfRangePortSettings = [
        ...mockSmtpSettings.filter(s => s.key !== 'smtp.port'),
        { key: 'smtp.port', value: '99999' },
      ];
      mockGetByGroup.mockResolvedValue(outOfRangePortSettings);

      const result = await EmailService.getSmtpStatus();

      expect(result.configured).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid SMTP port:', '99999');
    });

    it('should parse secure setting correctly', async () => {
      const secureSettings = [
        ...mockSmtpSettings.filter(s => s.key !== 'smtp.secure'),
        { key: 'smtp.secure', value: 'true' },
      ];
      mockGetByGroup.mockResolvedValue(secureSettings);
      // Force refresh to pick up the new configuration
      await EmailService.refreshConfiguration();

      // Trigger configuration loading
      await EmailService.testConnection();

      expect(mockCreateTransporter).toHaveBeenCalledWith(expect.objectContaining({
        secure: true,
      }));
    });

    it('should use default values for optional settings', async () => {
      const minimalSettings = [
        { key: 'smtp.host', value: 'smtp.example.com' },
        { key: 'smtp.port', value: '587' },
        { key: 'smtp.username', value: 'test@example.com' },
        { key: 'smtp.password', value: 'password123' },
      ];
      mockGetByGroup.mockResolvedValue(minimalSettings);
      // Force refresh to pick up the new configuration
      await EmailService.refreshConfiguration();

      // Trigger configuration loading
      await EmailService.testConnection();

      expect(mockCreateTransporter).toHaveBeenCalledWith(expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false, // Default value
        auth: {
          user: 'test@example.com',
          pass: 'password123',
        },
      }));
    });
  });
});
