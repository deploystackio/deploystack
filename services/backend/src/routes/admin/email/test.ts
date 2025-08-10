import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { EmailService } from '../../../email';
import type { User } from '../../../services/userService';

// Define Zod schemas
const TestEmailRequestSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

const TestEmailSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the test email was sent successfully'),
  message: z.string().describe('Success message'),
  messageId: z.string().optional().describe('Email message ID from SMTP server'),
  recipients: z.array(z.string()).describe('List of email recipients'),
});

const TestEmailErrorResponseSchema = z.object({
  success: z.boolean().default(false).describe('Indicates the operation failed'),
  error: z.string().describe('Error message describing what went wrong'),
});

export default async function adminEmailTestRoute(server: FastifyInstance) {
  server.post('/test', {
    preValidation: requirePermission('email.test'),
    schema: {
      tags: ['Admin Email'],
      summary: 'Send test email',
      description: 'Sends a test email to verify SMTP configuration. Only global administrators can access this endpoint. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email'],
        additionalProperties: false
      },
      
      // createSchema() for OpenAPI documentation
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: createSchema(TestEmailRequestSchema)
          }
        }
      },
      
      response: {
        200: createSchema(TestEmailSuccessResponseSchema.describe('Test email sent successfully')),
        400: createSchema(TestEmailErrorResponseSchema.describe('Bad Request - Invalid email address or validation error')),
        401: createSchema(TestEmailErrorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(TestEmailErrorResponseSchema.describe('Forbidden - Insufficient permissions (requires email.test permission)')),
        500: createSchema(TestEmailErrorResponseSchema.describe('Internal Server Error - SMTP configuration or email sending failed'))
      }
    }
  }, async (request, reply) => {
    try {
      // Validate email using Zod schema for extra safety
      const { email } = TestEmailRequestSchema.parse(request.body);
      
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
        supportEmail: 'support@deploystack.com'
      }, request.log);
      
      if (result.success) {
        request.log.info({
          messageId: result.messageId,
          recipients: result.recipients,
          adminUser: adminUserName,
          operation: 'send_test_email'
        }, 'Test email sent successfully');
        
        const successResponse = {
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
        
        const errorResponse = {
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
      
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
