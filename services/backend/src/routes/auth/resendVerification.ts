import type { FastifyInstance, FastifyReply } from 'fastify';
import { ResendVerificationSchema, type ResendVerificationInput } from './schemas';
import { EmailVerificationService } from '../../services/emailVerificationService';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const resendSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the resend was successful'),
  message: z.string().describe('Success message')
});

const resendErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const resendVerificationRouteSchema = {
  tags: ['Authentication'],
  summary: 'Resend email verification',
  description: 'Resends a verification email to the specified email address. This endpoint is public and does not require authentication. Only works if the email address exists and is not already verified.',
  body: zodToJsonSchema(ResendVerificationSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(resendSuccessResponseSchema.describe('Verification email sent successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(resendErrorResponseSchema.describe('Bad Request - Email not found or already verified'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    403: zodToJsonSchema(resendErrorResponseSchema.describe('Forbidden - Email sending is disabled'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(resendErrorResponseSchema.describe('Internal Server Error - Failed to send email'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function resendVerificationRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: ResendVerificationInput }>(
    '/resend-verification',
    { schema: resendVerificationRouteSchema },
    async (request, reply: FastifyReply) => {
      const { email } = request.body;

      try {
        // Check if email verification is required
        const isVerificationRequired = await EmailVerificationService.isVerificationRequired();
        if (!isVerificationRequired) {
          return reply.status(403).send({
            success: false,
            error: 'Email verification is currently disabled'
          });
        }

        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          return reply.status(500).send({
            success: false,
            error: 'Database configuration error'
          });
        }

        // Find user by email
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = await (db as any)
          .select({
            id: authUserTable.id,
            username: authUserTable.username,
            email: authUserTable.email,
            email_verified: authUserTable.email_verified,
            auth_type: authUserTable.auth_type
          })
          .from(authUserTable)
          .where(eq(authUserTable.email, email.toLowerCase()))
          .limit(1);

        if (users.length === 0) {
          // Don't reveal whether email exists or not for security
          return reply.status(200).send({
            success: true,
            message: 'If the email address exists and is not verified, a verification email has been sent.'
          });
        }

        const user = users[0];

        // Check if user is email type (GitHub users don't need email verification)
        if (user.auth_type !== 'email_signup') {
          return reply.status(200).send({
            success: true,
            message: 'If the email address exists and is not verified, a verification email has been sent.'
          });
        }

        // Check if email is already verified
        if (user.email_verified) {
          return reply.status(400).send({
            success: false,
            error: 'Email address is already verified'
          });
        }

        // Send verification email
        const emailResult = await EmailVerificationService.sendVerificationEmail(
          user.id,
          user.email,
          user.username
        );

        if (!emailResult.success) {
          return reply.status(500).send({
            success: false,
            error: emailResult.error || 'Failed to send verification email'
          });
        }

        return reply.status(200).send({
          success: true,
          message: 'Verification email sent successfully. Please check your inbox and follow the instructions to verify your email address.'
        });

      } catch (error) {
        fastify.log.error(error, 'Error during resend verification:');
        return reply.status(500).send({
          success: false,
          error: 'An unexpected error occurred while sending verification email'
        });
      }
    }
  );
}
