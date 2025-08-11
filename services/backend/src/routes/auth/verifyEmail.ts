import type { FastifyInstance } from 'fastify';
import { EmailVerificationService } from '../../services/emailVerificationService';

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

      } catch (error) {
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
