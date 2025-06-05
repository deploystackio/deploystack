import { describe, it, expect } from 'vitest';
import {
  EmailAddressSchema,
  EmailAttachmentSchema,
  SendEmailOptionsSchema,
  type SendEmailOptions,
  type EmailAttachment,
  type TemplateRenderOptions,
  type SmtpConfiguration,
  type EmailSendResult,
  type TemplateValidationResult,
  type WelcomeEmailVariables,
  type PasswordResetEmailVariables,
  type NotificationEmailVariables,
} from '../../../src/email/types';

describe('Email Types and Schemas', () => {
  describe('EmailAddressSchema', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.org',
        'firstname.lastname@company.com',
      ];

      validEmails.forEach(email => {
        const result = EmailAddressSchema.safeParse(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(email);
        }
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..double.dot@domain.com',
        'user@domain',
        '',
        'user name@domain.com', // space in local part
      ];

      invalidEmails.forEach(email => {
        const result = EmailAddressSchema.safeParse(email);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Invalid email address');
        }
      });
    });
  });

  describe('EmailAttachmentSchema', () => {
    it('should validate correct attachment objects', () => {
      const validAttachments = [
        {
          filename: 'document.pdf',
          content: 'base64-encoded-content',
        },
        {
          filename: 'image.jpg',
          content: Buffer.from('binary-data'),
          contentType: 'image/jpeg',
        },
        {
          filename: 'text.txt',
          content: 'plain text content',
          contentType: 'text/plain',
          encoding: 'utf8',
        },
      ];

      validAttachments.forEach(attachment => {
        const result = EmailAttachmentSchema.safeParse(attachment);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filename).toBe(attachment.filename);
          expect(result.data.content).toEqual(attachment.content);
        }
      });
    });

    it('should reject invalid attachment objects', () => {
      const invalidAttachments = [
        {
          // Missing filename
          content: 'some content',
        },
        {
          filename: '', // Empty filename
          content: 'some content',
        },
        {
          filename: 'test.txt',
          // Missing content
        },
        {
          filename: 'test.txt',
          content: null, // Invalid content type
        },
      ];

      invalidAttachments.forEach(attachment => {
        const result = EmailAttachmentSchema.safeParse(attachment);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('SendEmailOptionsSchema', () => {
    const validBaseOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      template: 'welcome',
    };

    it('should validate minimal valid email options', () => {
      const result = SendEmailOptionsSchema.safeParse(validBaseOptions);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.to).toBe('user@example.com');
        expect(result.data.subject).toBe('Test Subject');
        expect(result.data.template).toBe('welcome');
        expect(result.data.variables).toEqual({}); // Default empty object
      }
    });

    it('should validate complete email options', () => {
      const completeOptions = {
        ...validBaseOptions,
        to: ['user1@example.com', 'user2@example.com'],
        variables: {
          userName: 'John Doe',
          loginUrl: 'https://app.example.com/login',
        },
        from: {
          name: 'Test App',
          email: 'noreply@example.com',
        },
        attachments: [
          {
            filename: 'document.pdf',
            content: 'base64-content',
            contentType: 'application/pdf',
          },
        ],
        replyTo: 'support@example.com',
        cc: 'manager@example.com',
        bcc: ['admin1@example.com', 'admin2@example.com'],
      };

      const result = SendEmailOptionsSchema.safeParse(completeOptions);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.to).toEqual(['user1@example.com', 'user2@example.com']);
        expect(result.data.variables).toEqual(completeOptions.variables);
        expect(result.data.from).toEqual(completeOptions.from);
        expect(result.data.attachments).toEqual(completeOptions.attachments);
        expect(result.data.cc).toBe('manager@example.com');
        expect(result.data.bcc).toEqual(['admin1@example.com', 'admin2@example.com']);
      }
    });

    it('should reject invalid email options', () => {
      const invalidOptions = [
        {
          // Missing required fields
          subject: 'Test',
        },
        {
          to: 'invalid-email',
          subject: 'Test',
          template: 'welcome',
        },
        {
          to: 'user@example.com',
          subject: '', // Empty subject
          template: 'welcome',
        },
        {
          to: 'user@example.com',
          subject: 'Test',
          template: '', // Empty template
        },
        {
          to: 'user@example.com',
          subject: 'Test',
          template: 'welcome',
          from: {
            email: 'invalid-email', // Invalid from email
          },
        },
      ];

      invalidOptions.forEach(options => {
        const result = SendEmailOptionsSchema.safeParse(options);
        expect(result.success).toBe(false);
      });
    });

    it('should handle array and string recipients correctly', () => {
      // Test string recipient
      const stringRecipient = {
        ...validBaseOptions,
        to: 'user@example.com',
      };
      
      const stringResult = SendEmailOptionsSchema.safeParse(stringRecipient);
      expect(stringResult.success).toBe(true);

      // Test array recipients
      const arrayRecipients = {
        ...validBaseOptions,
        to: ['user1@example.com', 'user2@example.com'],
      };
      
      const arrayResult = SendEmailOptionsSchema.safeParse(arrayRecipients);
      expect(arrayResult.success).toBe(true);
    });

    it('should handle CC and BCC as both string and array', () => {
      const options = {
        ...validBaseOptions,
        cc: 'cc@example.com',
        bcc: ['bcc1@example.com', 'bcc2@example.com'],
      };
      
      const result = SendEmailOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cc).toBe('cc@example.com');
        expect(result.data.bcc).toEqual(['bcc1@example.com', 'bcc2@example.com']);
      }
    });
  });

  describe('TypeScript Interfaces', () => {
    it('should properly type EmailAttachment interface', () => {
      const attachment: EmailAttachment = {
        filename: 'test.txt',
        content: 'test content',
        contentType: 'text/plain',
        encoding: 'utf8',
      };

      expect(attachment.filename).toBe('test.txt');
      expect(attachment.content).toBe('test content');
      expect(attachment.contentType).toBe('text/plain');
      expect(attachment.encoding).toBe('utf8');
    });

    it('should properly type SendEmailOptions interface', () => {
      const options: SendEmailOptions = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Subject',
        template: 'welcome',
        variables: {
          userName: 'John Doe',
          loginUrl: 'https://app.example.com',
        },
        from: {
          name: 'Test App',
          email: 'noreply@example.com',
        },
        attachments: [
          {
            filename: 'document.pdf',
            content: Buffer.from('pdf-content'),
          },
        ],
        replyTo: 'support@example.com',
        cc: 'manager@example.com',
        bcc: ['admin@example.com'],
      };

      expect(Array.isArray(options.to)).toBe(true);
      expect(options.variables?.userName).toBe('John Doe');
      expect(options.from?.name).toBe('Test App');
      expect(options.attachments?.[0].filename).toBe('document.pdf');
    });

    it('should properly type TemplateRenderOptions interface', () => {
      const options: TemplateRenderOptions = {
        template: 'welcome',
        variables: {
          userName: 'John Doe',
          userEmail: 'john@example.com',
        },
        layout: 'minimal',
      };

      expect(options.template).toBe('welcome');
      expect(options.variables.userName).toBe('John Doe');
      expect(options.layout).toBe('minimal');
    });

    it('should properly type SmtpConfiguration interface', () => {
      const config: SmtpConfiguration = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'password123',
        },
        from: {
          name: 'Test App',
          address: 'noreply@example.com',
        },
      };

      expect(config.host).toBe('smtp.example.com');
      expect(config.port).toBe(587);
      expect(config.secure).toBe(false);
      expect(config.auth.user).toBe('user@example.com');
      expect(config.from.name).toBe('Test App');
    });

    it('should properly type EmailSendResult interface', () => {
      const successResult: EmailSendResult = {
        success: true,
        messageId: 'test-message-id',
        recipients: ['user@example.com'],
      };

      const errorResult: EmailSendResult = {
        success: false,
        error: 'SMTP connection failed',
        recipients: ['user@example.com'],
      };

      expect(successResult.success).toBe(true);
      expect(successResult.messageId).toBe('test-message-id');
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBe('SMTP connection failed');
    });

    it('should properly type TemplateValidationResult interface', () => {
      const validResult: TemplateValidationResult = {
        valid: true,
        errors: [],
        missingVariables: [],
      };

      const invalidResult: TemplateValidationResult = {
        valid: false,
        errors: ['Template not found', 'Compilation failed'],
        missingVariables: ['userName', 'userEmail'],
      };

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.missingVariables).toContain('userName');
    });
  });

  describe('Template Variable Types', () => {
    it('should properly type WelcomeEmailVariables', () => {
      const variables: WelcomeEmailVariables = {
        userName: 'John Doe',
        userEmail: 'john@example.com',
        loginUrl: 'https://app.example.com/login',
        supportEmail: 'support@example.com',
      };

      expect(variables.userName).toBe('John Doe');
      expect(variables.userEmail).toBe('john@example.com');
      expect(variables.loginUrl).toBe('https://app.example.com/login');
      expect(variables.supportEmail).toBe('support@example.com');
    });

    it('should properly type PasswordResetEmailVariables', () => {
      const variables: PasswordResetEmailVariables = {
        userName: 'John Doe',
        resetUrl: 'https://app.example.com/reset?token=abc123',
        expirationTime: '24 hours',
        supportEmail: 'support@example.com',
      };

      expect(variables.userName).toBe('John Doe');
      expect(variables.resetUrl).toContain('reset?token=');
      expect(variables.expirationTime).toBe('24 hours');
    });

    it('should properly type NotificationEmailVariables', () => {
      const variables: NotificationEmailVariables = {
        title: 'Deployment Complete',
        message: 'Your application has been deployed successfully.',
        actionUrl: 'https://app.example.com/deployments/123',
        actionText: 'View Deployment',
        userName: 'John Doe',
      };

      expect(variables.title).toBe('Deployment Complete');
      expect(variables.message).toContain('deployed successfully');
      expect(variables.actionUrl).toContain('/deployments/');
      expect(variables.actionText).toBe('View Deployment');
      expect(variables.userName).toBe('John Doe');
    });

    it('should allow optional fields in template variables', () => {
      // WelcomeEmailVariables with optional supportEmail
      const welcomeVars: WelcomeEmailVariables = {
        userName: 'John Doe',
        userEmail: 'john@example.com',
        loginUrl: 'https://app.example.com/login',
        // supportEmail is optional
      };

      // NotificationEmailVariables with optional fields
      const notificationVars: NotificationEmailVariables = {
        title: 'Simple Notification',
        message: 'This is a simple message.',
        // actionUrl, actionText, userName are optional
      };

      expect(welcomeVars.supportEmail).toBeUndefined();
      expect(notificationVars.actionUrl).toBeUndefined();
      expect(notificationVars.userName).toBeUndefined();
    });
  });

  describe('Schema Edge Cases', () => {
    it('should handle empty arrays in SendEmailOptions', () => {
      const options = {
        to: [],
        subject: 'Test',
        template: 'welcome',
      };

      const result = SendEmailOptionsSchema.safeParse(options);
      // Zod allows empty arrays by default, so this should actually be valid
      // If we want to enforce non-empty arrays, we'd need to add .min(1) to the schema
      expect(result.success).toBe(true);
    });

    it('should handle very long email addresses', () => {
      const longEmail = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.com';
      const result = EmailAddressSchema.safeParse(longEmail);
      
      // Zod's email validation is quite permissive and doesn't enforce length limits by default
      // The email format is technically valid even if very long
      expect(result.success).toBe(true);
    });

    it('should handle special characters in subject and template names', () => {
      const options = {
        to: 'user@example.com',
        subject: 'Test with émojis 🚀 and spëcial chars',
        template: 'welcome-template_v2',
      };

      const result = SendEmailOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should handle large attachment content', () => {
      const largeContent = 'x'.repeat(10000);
      const attachment = {
        filename: 'large-file.txt',
        content: largeContent,
      };

      const result = EmailAttachmentSchema.safeParse(attachment);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe(largeContent);
      }
    });

    it('should handle Buffer content in attachments', () => {
      const bufferContent = Buffer.from('binary data', 'utf8');
      const attachment = {
        filename: 'binary-file.dat',
        content: bufferContent,
      };

      const result = EmailAttachmentSchema.safeParse(attachment);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Buffer.isBuffer(result.data.content)).toBe(true);
      }
    });
  });
});
