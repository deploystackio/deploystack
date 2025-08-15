import type { FastifyInstance } from 'fastify';
import { EmailVerificationService } from '../../services/emailVerificationService';
import { EmailService } from '../../email';
import { GlobalSettings } from '../../global-settings/helpers';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';

// Reusable Schema Constants
const VERIFY_EMAIL_QUERYSTRING_SCHEMA = {
  type: 'object',
  properties: {
    token: {
      type: 'string',
      minLength: 1,
      description: 'Email verification token received via email'
    }
  },
  required: ['token'],
  additionalProperties: false
} as const;

const VERIFY_EMAIL_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the verification was successful'
    },
    message: {
      type: 'string',
      description: 'Success message'
    },
    userId: {
      type: 'string',
      description: 'ID of the verified user'
    }
  },
  required: ['success', 'message', 'userId']
} as const;

const VERIFY_EMAIL_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates if the operation was successful (false for errors)'
    },
    error: {
      type: 'string',
      description: 'Error message describing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces for type safety
interface VerifyEmailQuery {
  token: string;
}

interface VerifyEmailSuccessResponse {
  success: boolean;
  message: string;
  userId: string;
}

interface VerifyEmailErrorResponse {
  success: boolean;
  error: string;
}

export default async function verifyEmailRoute(server: FastifyInstance) {
  server.get('/verify', {
    // No preValidation - this is a public endpoint (token provides security)
    schema: {
      tags: ['Authentication'],
      summary: 'Verify email address',
      description: 'Verifies a user\'s email address using a verification token sent via email. This endpoint is public and does not require authentication. Once verified, the user\'s email_verified status is set to true.',
      
      // Fastify validation schema for query parameters
      querystring: VERIFY_EMAIL_QUERYSTRING_SCHEMA,
      
      response: {
        200: {
          ...VERIFY_EMAIL_SUCCESS_RESPONSE_SCHEMA,
          description: 'Email verified successfully'
        },
        400: {
          ...VERIFY_EMAIL_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid or expired token'
        },
        500: {
          ...VERIFY_EMAIL_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - Verification failed'
        }
      }
    }
  }, async (request, reply) => {
      // TypeScript type assertion (Fastify has already validated)
      const { token } = request.query as VerifyEmailQuery;

      try {
        // Verify the email token
        const result = await EmailVerificationService.verifyEmailToken(token);

        if (!result.success) {
          const errorResponse: VerifyEmailErrorResponse = {
            success: false,
            error: result.error || 'Invalid or expired verification token'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Send welcome email if enabled
        try {
          const shouldSendWelcome = await EmailService.shouldSendWelcomeEmail();
          if (shouldSendWelcome && result.userId) {
            // Get user details to send welcome email
            const db = getDb();
            const schema = getSchema();
            const authUserTable = schema.authUser;
            
            if (authUserTable) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const users = await (db as any)
                .select({
                  email: authUserTable.email,
                  first_name: authUserTable.first_name,
                  last_name: authUserTable.last_name,
                  username: authUserTable.username
                })
                .from(authUserTable)
                .where(eq(authUserTable.id, result.userId))
                .limit(1);
              
              if (users.length > 0) {
                const user = users[0];
                const userName = user.first_name 
                  ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
                  : user.username || 'User';
                
                const loginUrl = await GlobalSettings.get('global.page_url', 'http://localhost:5173') + '/login';
                const supportEmail = await GlobalSettings.get('smtp.from_email') || undefined;
                
                // Send welcome email asynchronously (don't block verification response)
                EmailService.sendWelcomeEmail({
                  to: user.email,
                  userName,
                  userEmail: user.email,
                  loginUrl,
                  supportEmail
                }, request.log).catch(error => {
                  request.log.warn({
                    error,
                    userId: result.userId,
                    operation: 'send_welcome_email_after_verification'
                  }, 'Failed to send welcome email after email verification');
                });
              }
            }
          }
        } catch (error: unknown) {
          // Don't fail verification if welcome email fails
          request.log.warn({
            error,
            userId: result.userId,
            operation: 'send_welcome_email_after_verification'
          }, 'Error occurred while trying to send welcome email after verification');
        }

        // Clean up expired tokens (housekeeping)
        EmailVerificationService.cleanupExpiredTokens().catch(error => {
          server.log.warn('Failed to cleanup expired tokens:', error);
        });

        // Create typed success response
        const successResponse: VerifyEmailSuccessResponse = {
          success: true,
          message: 'Email verified successfully. You can now log in to your account.',
          userId: result.userId!
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error: unknown) {
        server.log.error(error, 'Error during email verification:');
        const errorResponse: VerifyEmailErrorResponse = {
          success: false,
          error: 'An unexpected error occurred during verification'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
