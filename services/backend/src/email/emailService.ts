import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import { GlobalSettingsService } from '../services/globalSettingsService';
import { GlobalSettings } from '../global-settings/helpers';
import { TemplateRenderer } from './templateRenderer';
import { 
  SendEmailOptionsSchema, 
  type SendEmailOptions, 
  type EmailSendResult, 
  type SmtpConfiguration 
} from './types';

export class EmailService {
  private static transporter: Transporter | null = null;
  private static smtpConfig: SmtpConfiguration | null = null;

  /**
   * Send an email using a template
   */
  static async sendEmail(options: SendEmailOptions, logger: FastifyBaseLogger): Promise<EmailSendResult> {
    try {
      // Validate input using Zod
      const validatedOptions = SendEmailOptionsSchema.parse(options);

      // Ensure SMTP is configured and transporter is ready
      await this.ensureTransporter(logger);

      if (!this.transporter || !this.smtpConfig) {
        throw new Error('SMTP configuration is not available or invalid');
      }

      // Structured trace logging
      logger.trace({
        operation: 'rendering_template',
        template: validatedOptions.template,
        recipient: validatedOptions.to,
        hasVariables: !!validatedOptions.variables,
        variableCount: validatedOptions.variables ? Object.keys(validatedOptions.variables).length : 0
      }, `Rendering email template: ${validatedOptions.template}`);

      // Render the email template (pass logger for debug visibility)
      const html = await TemplateRenderer.render({
        template: validatedOptions.template,
        variables: validatedOptions.variables || {},
        logger
      });

      // Prepare email options
      const fromEmail = validatedOptions.from?.email || this.smtpConfig.from.address;
      const fromName = validatedOptions.from?.name || this.smtpConfig.from.name;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(validatedOptions.to) ? validatedOptions.to.join(', ') : validatedOptions.to,
        subject: validatedOptions.subject,
        html,
        attachments: validatedOptions.attachments,
        replyTo: validatedOptions.replyTo,
        cc: validatedOptions.cc ? (Array.isArray(validatedOptions.cc) ? validatedOptions.cc.join(', ') : validatedOptions.cc) : undefined,
        bcc: validatedOptions.bcc ? (Array.isArray(validatedOptions.bcc) ? validatedOptions.bcc.join(', ') : validatedOptions.bcc) : undefined,
      };

      // Send the email
      logger.debug({
        recipient: validatedOptions.to,
        template: validatedOptions.template,
        subject: validatedOptions.subject,
        operation: 'send_email'
      }, 'Sending email');

      const info = await this.transporter.sendMail(mailOptions);

      // Prepare recipients list
      const recipients = Array.isArray(validatedOptions.to) ? validatedOptions.to : [validatedOptions.to];

      logger.debug({
        messageId: info.messageId,
        recipients,
        template: validatedOptions.template,
        operation: 'send_email'
      }, 'Email sent successfully');

      return {
        success: true,
        messageId: info.messageId,
        recipients,
      };

    } catch (error) {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      logger.error({
        error,
        recipient: options.to,
        template: options.template,
        subject: options.subject,
        operation: 'send_email'
      }, 'Failed to send email');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        recipients,
      };
    }
  }

  /**
   * Test SMTP connection
   */
  static async testConnection(logger: FastifyBaseLogger): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTransporter(logger);

      if (!this.transporter) {
        logger.warn({
          operation: 'test_smtp_connection'
        }, 'SMTP configuration is not available');
        return { success: false, error: 'SMTP configuration is not available' };
      }

      // Verify the connection
      await this.transporter.verify();

      logger.debug({
        operation: 'test_smtp_connection',
        smtpHost: this.smtpConfig?.host
      }, 'SMTP connection test successful');

      return { success: true };
    } catch (error) {
      logger.error({
        error,
        operation: 'test_smtp_connection',
        smtpHost: this.smtpConfig?.host
      }, 'SMTP connection test failed');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get current SMTP configuration status
   */
  static async getSmtpStatus(logger: FastifyBaseLogger): Promise<{ configured: boolean; error?: string }> {
    try {
      const config = await this.loadSmtpConfiguration(logger);
      const isConfigured = config !== null;
      
      logger.debug({
        configured: isConfigured,
        operation: 'get_smtp_status'
      }, 'SMTP configuration status checked');
      
      return { configured: isConfigured };
    } catch (error) {
      logger.error({
        error,
        operation: 'get_smtp_status'
      }, 'Failed to get SMTP status');
      
      return {
        configured: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Refresh SMTP configuration (useful when settings are updated)
   */
  static async refreshConfiguration(logger: FastifyBaseLogger): Promise<void> {
    logger.debug({
      operation: 'refresh_smtp_config'
    }, 'Refreshing SMTP configuration');
    
    this.transporter = null;
    this.smtpConfig = null;
    await this.ensureTransporter(logger);
  }

  /**
   * Get list of available email templates
   */
  static getAvailableTemplates(logger: FastifyBaseLogger): string[] {
    return TemplateRenderer.getAvailableTemplates(logger);
  }

  /**
   * Validate a template with given variables
   */
  static async validateTemplate(template: string, variables: Record<string, unknown>) {
    return TemplateRenderer.validateTemplate(template, variables);
  }

  /**
   * Ensure transporter is configured and ready
   */
  private static async ensureTransporter(logger: FastifyBaseLogger): Promise<void> {
    if (this.transporter && this.smtpConfig) {
      return;
    }

    // Load SMTP configuration from global settings
    this.smtpConfig = await this.loadSmtpConfiguration(logger);

    if (!this.smtpConfig) {
      throw new Error('SMTP configuration is not complete. Please configure SMTP settings in global settings.');
    }

    // Create nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      auth: this.smtpConfig.auth,
      // Additional options for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 20000,
      rateLimit: 5,
    });

    // Ensure templates directory exists
    TemplateRenderer.ensureTemplatesDirectory();
  }

  /**
   * Load SMTP configuration from global settings
   */
  private static async loadSmtpConfiguration(logger: FastifyBaseLogger): Promise<SmtpConfiguration | null> {
    try {
      // Get SMTP settings from global settings
      const smtpSettings = await GlobalSettingsService.getByGroup('smtp');

      if (!smtpSettings || smtpSettings.length === 0) {
        logger.warn({
          operation: 'load_smtp_config'
        }, 'No SMTP settings found in global settings');
        return null;
      }

      // Extract individual settings
      const host = smtpSettings.find(s => s.key === 'smtp.host')?.value;
      const port = smtpSettings.find(s => s.key === 'smtp.port')?.value;
      const username = smtpSettings.find(s => s.key === 'smtp.username')?.value;
      const password = smtpSettings.find(s => s.key === 'smtp.password')?.value;
      const secure = smtpSettings.find(s => s.key === 'smtp.secure')?.value;
      const fromName = smtpSettings.find(s => s.key === 'smtp.from_name')?.value;
      const fromEmail = smtpSettings.find(s => s.key === 'smtp.from_email')?.value;

      // Validate required settings
      if (!host || !port || !username || !password) {
        logger.warn({
          missingSettings: {
            host: !host,
            port: !port,
            username: !username,
            password: !password,
          },
          operation: 'load_smtp_config'
        }, 'Incomplete SMTP configuration. Missing required settings');
        return null;
      }

      // Parse and validate port
      const portNumber = parseInt(port, 10);
      if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
        logger.warn({
          port,
          operation: 'load_smtp_config'
        }, 'Invalid SMTP port');
        return null;
      }

      // Parse secure setting
      const isSecure = secure === 'true';

      return {
        host,
        port: portNumber,
        secure: isSecure,
        auth: {
          user: username,
          pass: password,
        },
        from: {
          name: fromName || 'DeployStack',
          address: fromEmail || username,
        },
      };

    } catch (error) {
      logger.error({
        error,
        operation: 'load_smtp_config'
      }, 'Failed to load SMTP configuration');
      return null;
    }
  }

  /**
   * Check if welcome emails should be sent
   */
  static async shouldSendWelcomeEmail(): Promise<boolean> {
    const smtpEnabled = await GlobalSettings.getBoolean('smtp.enabled', false);
    const welcomeEmailEnabled = await GlobalSettings.getBoolean('global.send_welcome_email', false);
    return smtpEnabled && welcomeEmailEnabled;
  }

  /**
   * Send a welcome email (type-safe helper)
   */
  static async sendWelcomeEmail(options: {
    to: string;
    userName: string;
    userEmail: string;
    loginUrl: string;
    supportEmail?: string;
  }, logger: FastifyBaseLogger): Promise<EmailSendResult> {
    return this.sendEmail({
      to: options.to,
      subject: `Welcome to DeployStack, ${options.userName}!`,
      template: 'welcome',
      variables: {
        userName: options.userName,
        userEmail: options.userEmail,
        loginUrl: options.loginUrl,
        supportEmail: options.supportEmail || 'hello@deploystack.io',
      },
    }, logger);
  }

  /**
   * Send a password reset email (type-safe helper)
   */
  static async sendPasswordResetEmail(options: {
    to: string;
    userName: string;
    resetUrl: string;
    expirationTime: string;
    supportEmail?: string;
  }, logger: FastifyBaseLogger): Promise<EmailSendResult> {
    return this.sendEmail({
      to: options.to,
      subject: 'Reset Your DeployStack Password',
      template: 'password-reset',
      variables: {
        userName: options.userName,
        resetUrl: options.resetUrl,
        expirationTime: options.expirationTime,
        supportEmail: options.supportEmail || 'support@deploystack.io',
      },
    }, logger);
  }

  /**
   * Send a notification email (type-safe helper)
   */
  static async sendNotificationEmail(options: {
    to: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
    userName?: string;
  }, logger: FastifyBaseLogger): Promise<EmailSendResult> {
    return this.sendEmail({
      to: options.to,
      subject: options.title,
      template: 'notification',
      variables: {
        title: options.title,
        message: options.message,
        actionUrl: options.actionUrl,
        actionText: options.actionText,
        userName: options.userName,
      },
    }, logger);
  }

  /**
   * Send a password changed notification email (type-safe helper)
   */
  static async sendPasswordChangedEmail(options: {
    to: string;
    userName?: string;
    userEmail: string;
    changeTime: string;
    ipAddress?: string;
    userAgent?: string;
    loginUrl?: string;
    supportEmail?: string;
  }, logger: FastifyBaseLogger): Promise<EmailSendResult> {
    return this.sendEmail({
      to: options.to,
      subject: 'Password Changed - DeployStack Security Alert',
      template: 'password-changed',
      variables: {
        userName: options.userName,
        userEmail: options.userEmail,
        changeTime: options.changeTime,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        loginUrl: options.loginUrl || 'https://cloud.deploystack.io/login',
        supportEmail: options.supportEmail || 'support@deploystack.io',
      },
    }, logger);
  }

  /**
   * Send a test email to verify SMTP configuration (type-safe helper)
   */
  static async sendTestEmail(options: {
    to: string;
    adminUser: string;
    appUrl?: string;
    supportEmail?: string;
  }, logger: FastifyBaseLogger): Promise<EmailSendResult> {
    const currentDateTime = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    return this.sendEmail({
      to: options.to,
      subject: '✅ DeployStack Email Test - Configuration Successful',
      template: 'test',
      variables: {
        testDateTime: currentDateTime,
        adminUser: options.adminUser,
        appUrl: options.appUrl || 'https://cloud.deploystack.io',
        supportEmail: options.supportEmail || 'support@deploystack.io',
      },
    }, logger);
  }
}
