import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { GlobalSettingsService } from '../services/globalSettingsService';
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
  static async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    try {
      // Validate input using Zod
      const validatedOptions = SendEmailOptionsSchema.parse(options);

      // Ensure SMTP is configured and transporter is ready
      await this.ensureTransporter();

      if (!this.transporter || !this.smtpConfig) {
        throw new Error('SMTP configuration is not available or invalid');
      }

      // Render the email template
      const html = await TemplateRenderer.render({
        template: validatedOptions.template,
        variables: validatedOptions.variables || {},
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
      const info = await this.transporter.sendMail(mailOptions);

      // Prepare recipients list
      const recipients = Array.isArray(validatedOptions.to) ? validatedOptions.to : [validatedOptions.to];

      return {
        success: true,
        messageId: info.messageId,
        recipients,
      };

    } catch (error) {
      console.error('Failed to send email:', error);
      
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
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
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTransporter();

      if (!this.transporter) {
        return { success: false, error: 'SMTP configuration is not available' };
      }

      // Verify the connection
      await this.transporter.verify();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get current SMTP configuration status
   */
  static async getSmtpStatus(): Promise<{ configured: boolean; error?: string }> {
    try {
      const config = await this.loadSmtpConfiguration();
      return { configured: config !== null };
    } catch (error) {
      return {
        configured: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Refresh SMTP configuration (useful when settings are updated)
   */
  static async refreshConfiguration(): Promise<void> {
    this.transporter = null;
    this.smtpConfig = null;
    await this.ensureTransporter();
  }

  /**
   * Get list of available email templates
   */
  static getAvailableTemplates(): string[] {
    return TemplateRenderer.getAvailableTemplates();
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
  private static async ensureTransporter(): Promise<void> {
    if (this.transporter && this.smtpConfig) {
      return;
    }

    // Load SMTP configuration from global settings
    this.smtpConfig = await this.loadSmtpConfiguration();

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
  private static async loadSmtpConfiguration(): Promise<SmtpConfiguration | null> {
    try {
      // Get SMTP settings from global settings
      const smtpSettings = await GlobalSettingsService.getByGroup('smtp');

      if (!smtpSettings || smtpSettings.length === 0) {
        console.warn('No SMTP settings found in global settings');
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
        console.warn('Incomplete SMTP configuration. Missing required settings:', {
          host: !!host,
          port: !!port,
          username: !!username,
          password: !!password,
        });
        return null;
      }

      // Parse and validate port
      const portNumber = parseInt(port, 10);
      if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
        console.warn('Invalid SMTP port:', port);
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
      console.error('Failed to load SMTP configuration:', error);
      return null;
    }
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
  }): Promise<EmailSendResult> {
    return this.sendEmail({
      to: options.to,
      subject: `Welcome to DeployStack, ${options.userName}!`,
      template: 'welcome',
      variables: {
        userName: options.userName,
        userEmail: options.userEmail,
        loginUrl: options.loginUrl,
        supportEmail: options.supportEmail || 'support@deploystack.com',
      },
    });
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
  }): Promise<EmailSendResult> {
    return this.sendEmail({
      to: options.to,
      subject: 'Reset Your DeployStack Password',
      template: 'password-reset',
      variables: {
        userName: options.userName,
        resetUrl: options.resetUrl,
        expirationTime: options.expirationTime,
        supportEmail: options.supportEmail || 'support@deploystack.com',
      },
    });
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
  }): Promise<EmailSendResult> {
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
    });
  }
}
