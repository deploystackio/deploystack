import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type AdminResetPasswordInput } from './schemas';
import { PasswordResetService } from '../../services/passwordResetService';
import { requireGlobalAdmin } from '../../middleware/roleMiddleware';

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
const adminResetPasswordRouteSchema = {
  tags: ['Authentication', 'Admin'],
  summary: 'Admin-initiated password reset',
  description: 'Allows global administrators to initiate password reset for users with email authentication. The admin cannot reset their own password. Requires global_send_mail setting to be enabled. The user will receive an email with a reset link that works the same as self-initiated password resets.',
  security: [{ cookieAuth: [] }],
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
      description: 'Password reset email sent successfully'
    },
    400: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - Invalid email, user not found, or user not eligible'
    },
    401: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Unauthorized - Authentication required'
    },
    403: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Forbidden - Insufficient permissions or self-reset attempt'
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

export default async function adminResetPasswordRoute(server: FastifyInstance) {
  server.post<{ Body: AdminResetPasswordInput }>(
    '/admin/reset-password',
    {
      schema: adminResetPasswordRouteSchema,
      preValidation: requireGlobalAdmin()
    },
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

        const body = request.body as AdminResetPasswordInput;
        const { email } = body;
        const adminUserId = request.user?.id;

        if (!adminUserId) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        server.log.info(`Admin-initiated password reset requested by admin ${adminUserId} for email: ${email}`);

        // Queue admin-initiated reset email as background job
        try {
          const result = await PasswordResetService.prepareAdminResetEmail(email, adminUserId, server.log);

          if (!result.success) {
            server.log.error(`Admin password reset preparation failed for ${email} by admin ${adminUserId}: ${result.error}`);

            // Determine appropriate status code based on error
            if (result.error && result.error.includes('not found') || result.error && result.error.includes('not eligible')) {
              return reply.status(400).send({
                success: false,
                error: result.error
              });
            }

            if (result.error && result.error.includes('cannot reset their own password')) {
              return reply.status(403).send({
                success: false,
                error: result.error
              });
            }

            if (result.error && result.error.includes('disabled')) {
              return reply.status(503).send({
                success: false,
                error: result.error
              });
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
              server.log.info(`Admin password reset email queued for ${email} by admin ${adminUserId}`);
            } else {
              server.log.warn('Job queue service not available, admin password reset email not sent');
            }
          }
        } catch (error) {
          server.log.error(error, `Error queueing admin password reset email for ${email}:`);
          return reply.status(500).send({
            success: false,
            error: 'An unexpected error occurred during password reset request.'
          });
        }

        return reply.status(200).send({
          success: true,
          message: 'Password reset email has been sent to the user.'
        });

      } catch (error) {
        server.log.error(error, 'Error during admin-initiated password reset request:');
        return reply.status(500).send({
          success: false,
          error: 'An unexpected error occurred during password reset request.'
        });
      }
    }
  );
}
