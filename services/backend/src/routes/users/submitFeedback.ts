/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { requireAuthentication } from '../../middleware/roleMiddleware';
import { GlobalSettings } from '../../global-settings';
import { sanitizeUserTextForEmail } from '../../utils/emailSanitization';

// Reusable Schema Constants
const FEEDBACK_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      minLength: 1,
      maxLength: 5000,
      description: 'Feedback message (1-5000 characters)'
    }
  },
  required: ['message'],
  additionalProperties: false
} as const;

const FEEDBACK_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

const FEEDBACK_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript Interfaces
interface FeedbackRequest {
  message: string;
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function submitFeedbackRoute(server: FastifyInstance) {
  server.post('/users/me/feedback', {
    preValidation: requireAuthentication(), // ✅ Auth before validation
    schema: {
      tags: ['User Feedback'],
      summary: 'Submit user feedback',
      description: 'Submit feedback to DeployStack support. Requires Content-Type: application/json header. Feedback is sent via email if SMTP is configured.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      body: FEEDBACK_REQUEST_SCHEMA,

      // OpenAPI documentation
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: FEEDBACK_REQUEST_SCHEMA
          }
        }
      },

      response: {
        200: {
          ...FEEDBACK_SUCCESS_RESPONSE_SCHEMA,
          description: 'Feedback submitted successfully'
        },
        401: {
          ...FEEDBACK_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        400: {
          ...FEEDBACK_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid input'
        },
        503: {
          ...FEEDBACK_ERROR_RESPONSE_SCHEMA,
          description: 'Service Unavailable - Email service not configured'
        },
        500: {
          ...FEEDBACK_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Defensive auth check (middleware should handle this)
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const { message } = request.body as FeedbackRequest;
      const userEmail = (request.user as any).email as string;
      const userName = (request.user as any).username as string | undefined;

      // Check if SMTP is enabled
      const smtpEnabled = await GlobalSettings.getBoolean('smtp.enabled', false);

      if (!smtpEnabled) {
        server.log.warn({ userEmail }, 'Feedback submission rejected: SMTP not enabled');
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Email service is currently unavailable. Please try again later or contact support directly.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(503).type('application/json').send(jsonString);
      }

      // Queue feedback email via background job
      const jobQueueService = (server as any).jobQueueService;
      if (jobQueueService) {
        await jobQueueService.createJob('send_email', {
          to: 'info@deploystack.io',
          subject: `Feedback from ${userName || userEmail}`,
          template: 'feedback',
          variables: {
            senderEmail: userEmail,
            senderUsername: userName || null,
            feedbackMessage: sanitizeUserTextForEmail(message),
            submissionTime: new Date().toISOString()
          },
          replyTo: userEmail // Allow direct reply to user
        });

        server.log.info({ userEmail, messageLength: message.length }, 'Feedback email queued successfully');
      } else {
        server.log.error('JobQueueService not available');
      }

      // Return success immediately (email queued in background)
      const successResponse: SuccessResponse = {
        success: true,
        message: 'Thank you for your feedback! We have received your message and will review it shortly.'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);

    } catch (error) {
      server.log.error({ error }, 'Error processing feedback submission');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to submit feedback. Please try again.'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
