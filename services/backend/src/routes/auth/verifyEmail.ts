import type { FastifyInstance, FastifyReply } from 'fastify';
import { EmailVerificationSchema, type EmailVerificationInput } from './schemas';
import { EmailVerificationService } from '../../services/emailVerificationService';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const verifySuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the verification was successful'),
  message: z.string().describe('Success message'),
  userId: z.string().describe('ID of the verified user')
});

const verifyErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const verifyEmailRouteSchema = {
  tags: ['Authentication'],
  summary: 'Verify email address',
  description: 'Verifies a user\'s email address using a verification token sent via email. This endpoint is public and does not require authentication. Once verified, the user\'s email_verified status is set to true.',
  querystring: zodToJsonSchema(EmailVerificationSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(verifySuccessResponseSchema.describe('Email verified successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(verifyErrorResponseSchema.describe('Bad Request - Invalid or expired token'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(verifyErrorResponseSchema.describe('Internal Server Error - Verification failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function verifyEmailRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: EmailVerificationInput }>(
    '/verify',
    { schema: verifyEmailRouteSchema },
    async (request, reply: FastifyReply) => {
      const { token } = request.query;

      try {
        // Verify the email token
        const result = await EmailVerificationService.verifyEmailToken(token);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.error || 'Invalid or expired verification token'
          });
        }

        // Clean up expired tokens (housekeeping)
        EmailVerificationService.cleanupExpiredTokens().catch(error => {
          fastify.log.warn('Failed to cleanup expired tokens:', error);
        });

        return reply.status(200).send({
          success: true,
          message: 'Email verified successfully. You can now log in to your account.',
          userId: result.userId
        });

      } catch (error) {
        fastify.log.error(error, 'Error during email verification:');
        return reply.status(500).send({
          success: false,
          error: 'An unexpected error occurred during verification'
        });
      }
    }
  );
}
