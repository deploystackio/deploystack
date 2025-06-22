import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AdminResetPasswordSchema, type AdminResetPasswordInput } from './schemas';
import { PasswordResetService } from '../../services/passwordResetService';
import { requireGlobalAdmin } from '../../middleware/roleMiddleware';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const adminResetPasswordSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the request was processed successfully'),
  message: z.string().describe('Success message')
});

const adminResetPasswordErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const adminResetPasswordRouteSchema = {
  tags: ['Authentication', 'Admin'],
  summary: 'Admin-initiated password reset',
  description: 'Allows global administrators to initiate password reset for users with email authentication. The admin cannot reset their own password. Requires global_send_mail setting to be enabled. The user will receive an email with a reset link that works the same as self-initiated password resets.',
  security: [{ cookieAuth: [] }],
  body: zodToJsonSchema(AdminResetPasswordSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(adminResetPasswordSuccessResponseSchema.describe('Password reset email sent successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(adminResetPasswordErrorResponseSchema.describe('Bad Request - Invalid email, user not found, or user not eligible'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    401: zodToJsonSchema(adminResetPasswordErrorResponseSchema.describe('Unauthorized - Authentication required'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    403: zodToJsonSchema(adminResetPasswordErrorResponseSchema.describe('Forbidden - Insufficient permissions or self-reset attempt'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    503: zodToJsonSchema(adminResetPasswordErrorResponseSchema.describe('Service Unavailable - Email functionality disabled'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(adminResetPasswordErrorResponseSchema.describe('Internal Server Error - Password reset failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function adminResetPasswordRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: AdminResetPasswordInput }>(
    '/admin/reset-password',
    { 
      schema: adminResetPasswordRouteSchema,
      preHandler: requireGlobalAdmin()
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

        fastify.log.info(`Admin-initiated password reset requested by admin ${adminUserId} for email: ${email}`);

        // Send admin-initiated reset email
        const result = await PasswordResetService.sendAdminResetEmail(email, adminUserId);

        if (!result.success && result.error) {
          fastify.log.error(`Admin password reset failed for ${email} by admin ${adminUserId}: ${result.error}`);
          
          // Determine appropriate status code based on error
          if (result.error.includes('not found') || result.error.includes('not eligible')) {
            return reply.status(400).send({ 
              success: false, 
              error: result.error 
            });
          }
          
          if (result.error.includes('cannot reset their own password')) {
            return reply.status(403).send({ 
              success: false, 
              error: result.error 
            });
          }
          
          if (result.error.includes('disabled')) {
            return reply.status(503).send({ 
              success: false, 
              error: result.error 
            });
          }
          
          return reply.status(500).send({ 
            success: false, 
            error: result.error 
          });
        }

        fastify.log.info(`Admin password reset email sent successfully for ${email} by admin ${adminUserId}`);

        return reply.status(200).send({
          success: true,
          message: 'Password reset email has been sent to the user.'
        });

      } catch (error) {
        fastify.log.error(error, 'Error during admin-initiated password reset request:');
        return reply.status(500).send({ 
          success: false, 
          error: 'An unexpected error occurred during password reset request.' 
        });
      }
    }
  );
}
