import { type FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { EmailService } from '../../../email';
import type { User } from '../../../services/userService';

// Reusable Schema Constants
const TEST_EMAIL_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    email: { 
      type: 'string', 
      format: 'email',
      description: 'Valid email address to send test email to'
    }
  },
  required: ['email'],
  additionalProperties: false
} as const;

const TEST_EMAIL_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the test email was sent successfully'
    },
    message: { 
      type: 'string',
      description: 'Success message'
    },
    messageId: { 
      type: 'string',
      description: 'Email message ID from SMTP server'
    },
    recipients: { 
      type: 'array',
      items: { type: 'string' },
      description: 'List of email recipients'
    }
  },
  required: ['success', 'message', 'recipients']
} as const;

const TEST_EMAIL_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      default: false,
      description: 'Indicates the operation failed'
    },
    error: { 
      type: 'string',
      description: 'Error message describing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces for type safety
interface TestEmailRequest {
  email: string;
}

interface TestEmailSuccessResponse {
  success: boolean;
  message: string;
  messageId?: string;
  recipients: string[];
}

interface TestEmailErrorResponse {
  success: boolean;
  error: string;
}

export default async function adminEmailTestRoute(server: FastifyInstance) {
  server.post('/test', {
    preValidation: requirePermission('email.test'),
    schema: {
      tags: ['Admin Email'],
      summary: 'Send test email',
      description: 'Sends a test email to verify SMTP configuration. Only global administrators can access this endpoint. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: TEST_EMAIL_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: TEST_EMAIL_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...TEST_EMAIL_SUCCESS_RESPONSE_SCHEMA,
          description: 'Test email sent successfully'
        },
        400: {
          ...TEST_EMAIL_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid email address or validation error'
        },
        401: {
          ...TEST_EMAIL_ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...TEST_EMAIL_ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions (requires email.test permission)'
        },
        500: {
          ...TEST_EMAIL_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error - SMTP configuration or email sending failed'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // TypeScript type assertion (Fastify has already validated)
      const { email } = request.body as TestEmailRequest;
      
      // Get current user info for the test email
      const currentUser = request.user! as User;
      const adminUserName = currentUser.username || currentUser.email || 'Admin User';
      
      // Get app URL from environment or default
      const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'https://cloud.deploystack.io';
      
      // Send test email
      const result = await EmailService.sendTestEmail({
        to: email,
        adminUser: adminUserName,
        appUrl,
        supportEmail: 'support@deploystack.io'
      }, request.log);
      
      if (result.success) {
        request.log.info({
          messageId: result.messageId,
          recipients: result.recipients,
          adminUser: adminUserName,
          operation: 'send_test_email'
        }, 'Test email sent successfully');
        
        const successResponse: TestEmailSuccessResponse = {
          success: true,
          message: `Test email sent successfully to ${email}`,
          messageId: result.messageId,
          recipients: result.recipients
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);
      } else {
        request.log.error({
          error: result.error,
          recipients: result.recipients,
          adminUser: adminUserName,
          operation: 'send_test_email'
        }, 'Failed to send test email');
        
        const errorResponse: TestEmailErrorResponse = {
          success: false,
          error: result.error || 'Failed to send test email'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    } catch (error) {
      request.log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'send_test_email'
      }, 'Error in test email endpoint');
      
      const errorResponse: TestEmailErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
