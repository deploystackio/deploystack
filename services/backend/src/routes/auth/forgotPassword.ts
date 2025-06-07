import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ForgotPasswordSchema, type ForgotPasswordInput } from './schemas';
import { PasswordResetService } from '../../services/passwordResetService';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const forgotPasswordSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the request was processed successfully'),
  message: z.string().describe('Success message (always returned for security)')
});

const forgotPasswordErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const forgotPasswordRouteSchema = {
  tags: ['Authentication'],
  summary: 'Request password reset for email users',
  description: 'Sends a password reset email to users with email authentication. Always returns success for security (does not reveal if email exists). Requires email functionality to be enabled via global.send_mail setting. Reset tokens expire in 10 minutes.',
  body: zodToJsonSchema(ForgotPasswordSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(forgotPasswordSuccessResponseSchema.describe('Request processed successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(forgotPasswordErrorResponseSchema.describe('Bad Request - Invalid email format'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    503: zodToJsonSchema(forgotPasswordErrorResponseSchema.describe('Service Unavailable - Email functionality disabled'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(forgotPasswordErrorResponseSchema.describe('Internal Server Error - Password reset failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function forgotPasswordRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: ForgotPasswordInput }>(
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

        fastify.log.info(`Password reset requested for email: ${email}`);

        // Send reset email (always returns success for security)
        const result = await PasswordResetService.sendResetEmail(email);

        if (!result.success && result.error) {
          // Only log actual errors, not security responses
          if (result.error !== 'Password reset is currently disabled. Email functionality is not enabled.') {
            fastify.log.error(`Password reset email failed for ${email}: ${result.error}`);
          }
          return reply.status(500).send({ 
            success: false, 
            error: result.error 
          });
        }

        // Always return success message for security
        return reply.status(200).send({
          success: true,
          message: 'If the email address is associated with an account, a password reset link has been sent.'
        });

      } catch (error) {
        fastify.log.error(error, 'Error during password reset request:');
        return reply.status(500).send({ 
          success: false, 
          error: 'An unexpected error occurred during password reset request.' 
        });
      }
    }
  );
}
