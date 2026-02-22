import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type ForgotPasswordInput } from './schemas';
import { PasswordResetService } from '../../services/passwordResetService';

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// Route schema for OpenAPI documentation
const forgotPasswordRouteSchema = {
  tags: ['Authentication'],
  summary: 'Request password reset for email users',
  description: 'Sends a password reset email to users with email authentication. Always returns success for security (does not reveal if email exists). Requires email functionality to be enabled via smtp.enabled setting. Reset tokens expire in 10 minutes. Requires Content-Type: application/json header when sending request body.',
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' }
    },
    required: ['email'],
    additionalProperties: false
  },
  response: {
    200: {
      ...SUCCESS_RESPONSE_SCHEMA,
      description: 'Request processed successfully'
    },
    400: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - Invalid email format or missing Content-Type header'
    },
    503: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Service Unavailable - Email functionality disabled'
    },
    500: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Internal Server Error - Password reset failed'
    }
  }
};

export default async function forgotPasswordRoute(server: FastifyInstance) {
  server.post<{ Body: ForgotPasswordInput }>(
    '/email/forgot-password',
    { schema: forgotPasswordRouteSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if password reset is available (email sending enabled)
        const isResetAvailable = await PasswordResetService.isPasswordResetAvailable();
        if (!isResetAvailable) {
          return reply.status(503).send({
            success: false,
            error: 'Password reset is currently disabled. Email functionality is not enabled.'
          });
        }

        const body = request.body as ForgotPasswordInput;
        const { email } = body;

        server.log.info(`Password reset requested for email: ${email}`);

        // Queue reset email as background job (always returns success for security)
        try {
          const result = await PasswordResetService.prepareResetEmail(email, server.log);

          if (!result.success) {
            // Only log actual errors, not security responses
            if (result.error && result.error !== 'Password reset is currently disabled. Email functionality is not enabled.') {
              server.log.error(`Password reset preparation failed for ${email}: ${result.error}`);
            }
            return reply.status(500).send({
              success: false,
              error: result.error || 'An error occurred during password reset request.'
            });
          }

          // Queue email as background job if token and emailData were prepared
          if (result.emailData) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const jobQueueService = (server as any).jobQueueService;
            if (jobQueueService) {
              await jobQueueService.createJob('send_email', result.emailData);
              server.log.info(`Password reset email queued for ${email}`);
            } else {
              server.log.warn('Job queue service not available, password reset email not sent');
            }
          }
        } catch (error) {
          server.log.error(error, `Error queueing password reset email for ${email}:`);
          // Don't fail the request - continue to return security message
        }

        // Always return success message for security
        return reply.status(200).send({
          success: true,
          message: 'If the email address is associated with an account, a password reset link has been sent.'
        });

      } catch (error) {
        server.log.error(error, 'Error during password reset request:');
        return reply.status(500).send({
          success: false,
          error: 'An unexpected error occurred during password reset request.'
        });
      }
    }
  );
}
