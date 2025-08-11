import type { FastifyInstance } from 'fastify';
import { PasswordResetService } from '../../services/passwordResetService';

// Reusable Schema Constants
const RESET_PASSWORD_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    token: {
      type: 'string',
      minLength: 1,
      description: 'Valid password reset token received via email'
    },
    new_password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      description: 'New password (minimum 8 characters)'
    }
  },
  required: ['token', 'new_password'],
  additionalProperties: false
} as const;

const RESET_PASSWORD_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the password reset was successful'
    },
    message: {
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'message']
} as const;

const RESET_PASSWORD_ERROR_RESPONSE_SCHEMA = {
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
interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

interface ResetPasswordSuccessResponse {
  success: boolean;
  message: string;
}

interface ResetPasswordErrorResponse {
  success: boolean;
  error: string;
}

export default async function resetPasswordRoute(server: FastifyInstance) {
  server.post('/email/reset-password', {
    // No preValidation - this is a public endpoint (token provides security)
    schema: {
      tags: ['Authentication'],
      summary: 'Reset password using reset token',
      description: 'Resets the password for email users using a valid reset token. The token must be valid and not expired (10-minute expiration). After successful reset, all user sessions are invalidated for security. Only works for users with email authentication. Requires Content-Type: application/json header when sending request body.',
      
      // Fastify validation schema
      body: RESET_PASSWORD_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: RESET_PASSWORD_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...RESET_PASSWORD_SUCCESS_RESPONSE_SCHEMA,
          description: 'Password reset successfully'
        },
        400: {
          ...RESET_PASSWORD_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid token, expired token, invalid password, or missing Content-Type header'
        },
        403: {
          ...RESET_PASSWORD_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - User not eligible for password reset'
        },
        503: {
          ...RESET_PASSWORD_ERROR_RESPONSE_SCHEMA,
          description: 'Service Unavailable - Email functionality disabled'
        },
        500: {
          ...RESET_PASSWORD_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - Password reset failed'
        }
      }
    }
  }, async (request, reply) => {
      try {
        // Check if password reset is available (email sending enabled)
        const isResetAvailable = await PasswordResetService.isPasswordResetAvailable();
        if (!isResetAvailable) {
          const errorResponse: ResetPasswordErrorResponse = {
            success: false,
            error: 'Password reset is currently disabled. Email functionality is not enabled.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(503).type('application/json').send(jsonString);
        }

        // TypeScript type assertion (Fastify has already validated)
        const { token, new_password } = request.body as ResetPasswordRequest;

        server.log.info('Password reset attempt with token');

        // Validate token and reset password
        const result = await PasswordResetService.validateAndResetPassword(token, new_password);

        if (!result.success) {
          if (result.error === 'Invalid or expired reset token') {
            const errorResponse: ResetPasswordErrorResponse = {
              success: false,
              error: result.error
            };
            const jsonString = JSON.stringify(errorResponse);
            return reply.status(400).type('application/json').send(jsonString);
          }
          
          if (result.error === 'User not found or not eligible for password reset') {
            const errorResponse: ResetPasswordErrorResponse = {
              success: false,
              error: 'This user is not eligible for password reset.'
            };
            const jsonString = JSON.stringify(errorResponse);
            return reply.status(403).type('application/json').send(jsonString);
          }

          const errorResponse: ResetPasswordErrorResponse = {
            success: false,
            error: result.error || 'An error occurred during password reset.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

        server.log.info(`Password reset successful for user: ${result.userId}`);

        // Create typed success response
        const successResponse: ResetPasswordSuccessResponse = {
          success: true,
          message: 'Password has been reset successfully. All sessions have been invalidated for security. Please log in with your new password.'
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        server.log.error(error, 'Error during password reset:');
        const errorResponse: ResetPasswordErrorResponse = {
          success: false,
          error: 'An unexpected error occurred during password reset.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
