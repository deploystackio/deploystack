import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ResetPasswordSchema, type ResetPasswordInput } from './schemas';
import { PasswordResetService } from '../../services/passwordResetService';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const resetPasswordSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the password reset was successful'),
  message: z.string().describe('Success message')
});

const resetPasswordErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const resetPasswordRouteSchema = {
  tags: ['Authentication'],
  summary: 'Reset password using reset token',
  description: 'Resets the password for email users using a valid reset token. The token must be valid and not expired (10-minute expiration). After successful reset, all user sessions are invalidated for security. Only works for users with email authentication.',
  body: zodToJsonSchema(ResetPasswordSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(resetPasswordSuccessResponseSchema.describe('Password reset successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(resetPasswordErrorResponseSchema.describe('Bad Request - Invalid token, expired token, or invalid password'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    403: zodToJsonSchema(resetPasswordErrorResponseSchema.describe('Forbidden - User not eligible for password reset'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    503: zodToJsonSchema(resetPasswordErrorResponseSchema.describe('Service Unavailable - Email functionality disabled'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(resetPasswordErrorResponseSchema.describe('Internal Server Error - Password reset failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function resetPasswordRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: ResetPasswordInput }>(
    '/email/reset-password',
    { schema: resetPasswordRouteSchema },
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

        const body = request.body as ResetPasswordInput;
        const { token, new_password } = body;

        fastify.log.info('Password reset attempt with token');

        // Validate token and reset password
        const result = await PasswordResetService.validateAndResetPassword(token, new_password);

        if (!result.success) {
          if (result.error === 'Invalid or expired reset token') {
            return reply.status(400).send({ 
              success: false, 
              error: result.error 
            });
          }
          
          if (result.error === 'User not found or not eligible for password reset') {
            return reply.status(403).send({ 
              success: false, 
              error: 'This user is not eligible for password reset.' 
            });
          }

          return reply.status(500).send({ 
            success: false, 
            error: result.error || 'An error occurred during password reset.' 
          });
        }

        fastify.log.info(`Password reset successful for user: ${result.userId}`);

        // Send success response
        return reply.status(200).send({
          success: true,
          message: 'Password has been reset successfully. All sessions have been invalidated for security. Please log in with your new password.'
        });

      } catch (error) {
        fastify.log.error(error, 'Error during password reset:');
        return reply.status(500).send({ 
          success: false, 
          error: 'An unexpected error occurred during password reset.' 
        });
      }
    }
  );
}
