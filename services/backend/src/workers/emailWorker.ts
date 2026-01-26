import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import type { SendEmailOptions } from '../email/types';

/**
 * Email job payload type
 * 
 * Uses the SendEmailOptions interface directly from the EmailService.
 * All fields are inherited from SendEmailOptions.
 */
type EmailJobPayload = SendEmailOptions;

/**
 * EmailWorker - Background job worker for sending emails
 * 
 * This worker handles all email sending operations as background jobs.
 * It supports all email templates and provides reliable delivery with
 * automatic retry capabilities.
 * 
 * Usage:
 * ```typescript
 * await jobQueueService.createJob('send_email', {
 *   to: 'user@example.com',
 *   subject: 'Welcome to DeployStack',
 *   template: 'welcome',
 *   variables: {
 *     userName: 'John Doe',
 *     userEmail: 'user@example.com',
 *     loginUrl: 'https://cloud.deploystack.io/login'
 *   }
 * });
 * ```
 */
export class EmailWorker implements Worker {
  constructor(
    private readonly db: AnyDatabase,
    private readonly logger: FastifyBaseLogger
  ) {}

  async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
    if (!this.isValidPayload(payload)) {
      this.logger.warn({ 
        jobId, 
        payload,
        operation: 'send_email'
      }, 'Invalid email job payload');
      
      return {
        success: false,
        message: 'Invalid payload format: missing required fields (to, subject, template)'
      };
    }

    const emailPayload = payload as EmailJobPayload;

    try {
      // Import EmailService dynamically to avoid circular dependencies
      const { EmailService } = await import('../email');
      const { TemplateRenderer } = await import('../email/templateRenderer');

      // Clear template cache to ensure fresh path resolution (prevents stale __dirname)
      TemplateRenderer.clearCache();

      this.logger.trace({
        jobId,
        template: emailPayload.template,
        operation: 'send_email_worker',
      }, 'Template cache cleared before rendering');

      this.logger.info({
        jobId,
        to: emailPayload.to,
        subject: emailPayload.subject,
        template: emailPayload.template,
        operation: 'send_email'
      }, 'Sending email via background job');

      // Send email using EmailService
      const result = await EmailService.sendEmail(emailPayload, this.logger);

      if (!result.success) {
        this.logger.error({ 
          jobId, 
          error: result.error,
          to: emailPayload.to,
          template: emailPayload.template,
          operation: 'send_email'
        }, 'Email sending failed');

        // Throw error to trigger retry logic
        throw new Error(result.error || 'Email sending failed');
      }

      this.logger.info({
        jobId,
        messageId: result.messageId,
        recipients: result.recipients,
        template: emailPayload.template,
        operation: 'send_email'
      }, 'Email sent successfully via background job');

      return {
        success: true,
        message: `Email sent successfully to ${result.recipients.length} recipient(s)`,
        data: {
          messageId: result.messageId,
          recipients: result.recipients
        }
      };

    } catch (error) {
      this.logger.error({ 
        jobId, 
        error,
        to: emailPayload.to,
        template: emailPayload.template,
        operation: 'send_email'
      }, 'Failed to send email');

      // Re-throw error to trigger automatic retry with exponential backoff
      throw error;
    }
  }

  /**
   * Validate email job payload
   * 
   * Ensures all required fields are present and have correct types.
   */
  private isValidPayload(payload: unknown): payload is EmailJobPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any;

    // Required fields validation
    const hasTo = typeof p.to === 'string' || Array.isArray(p.to);
    const hasSubject = typeof p.subject === 'string' && p.subject.length > 0;
    const hasTemplate = typeof p.template === 'string' && p.template.length > 0;

    return hasTo && hasSubject && hasTemplate;
  }
}
