import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verify, hash } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { type ChangePasswordInput } from './schemas';
import { requireAuthHook } from '../../hooks/authHook';
import { EmailService } from '../../email';
import { GlobalSettingsService } from '../../services/globalSettingsService';

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// Route schema for OpenAPI documentation
const changePasswordRouteSchema = {
  tags: ['Authentication'],
  summary: 'Change user password',
  description: 'Allows authenticated users to change their password by providing their current password and a new password. Requires an active session. Requires Content-Type: application/json header when sending request body.',
  body: {
    type: 'object',
    properties: {
      current_password: { type: 'string', minLength: 1 },
      new_password: { type: 'string', minLength: 8, maxLength: 100 }
    },
    required: ['current_password', 'new_password'],
    additionalProperties: false
  },
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      ...SUCCESS_RESPONSE_SCHEMA,
      description: 'Password changed successfully'
    },
    400: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - Invalid input, incorrect current password, or missing Content-Type header'
    },
    401: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Unauthorized - Authentication required'
    },
    403: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Forbidden - Cannot change password for non-email users'
    },
    500: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Internal Server Error - Password change failed'
    }
  }
};

export default async function changePasswordRoute(server: FastifyInstance) {
  server.put<{ Body: ChangePasswordInput }>(
    '/change-password',
    {
      schema: changePasswordRouteSchema,
      preValidation: requireAuthHook // Require authentication
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if user is authenticated (requireAuthHook ensures this)
        if (!request.user || !request.user.id) {
          const errorResponse = {
            success: false,
            error: 'Unauthorized: Authentication required.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(401).type('application/json').send(jsonString);
        }

        const body = request.body as ChangePasswordInput;
        const { current_password, new_password } = body;
        const userId = request.user.id;

        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          server.log.error('AuthUser table not found in schema');
          const errorResponse = {
            success: false,
            error: 'Internal server error: User table configuration missing.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(500).type('application/json').send(jsonString);
        }

        // Get user from database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.id, userId))
          .limit(1);

        if (users.length === 0) {
          const errorResponse = {
            success: false,
            error: 'User not found.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(401).type('application/json').send(jsonString);
        }

        const user = users[0];

        // Check if user has email authentication (has a password)
        if (!user.hashed_password || user.auth_type !== 'email_signup') {
          const errorResponse = {
            success: false,
            error: 'Password change is only available for email-authenticated users.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(403).type('application/json').send(jsonString);
        }

        // Verify current password
        const validCurrentPassword = await verify(user.hashed_password, current_password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        if (!validCurrentPassword) {
          const errorResponse = {
            success: false,
            error: 'Current password is incorrect.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Check if new password is different from current password
        const samePassword = await verify(user.hashed_password, new_password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        if (samePassword) {
          const errorResponse = {
            success: false,
            error: 'New password must be different from current password.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

        // Hash new password
        const hashedNewPassword = await hash(new_password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        // Update password in database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .update(authUserTable)
          .set({
            hashed_password: hashedNewPassword,
            updated_at: new Date()
          })
          .where(eq(authUserTable.id, userId));

        server.log.info(`Password changed successfully for user: ${userId}`);

        // Send password change notification email if email sending is enabled
        try {
          // Check if email sending is enabled in global settings
          const emailSettings = await GlobalSettingsService.getByGroup('global');
          const sendMailSetting = emailSettings?.find(s => s.key === 'smtp.enabled');
          const isEmailEnabled = sendMailSetting?.value === 'true';

          if (isEmailEnabled) {
            // Get user's IP address and user agent for security info
            const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || 'Unknown';
            const userAgent = request.headers['user-agent'] || 'Unknown';
            const changeTime = new Date().toLocaleString('en-US', {
              timeZone: 'UTC',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            });

            // Get frontend URL for login link
            const frontendUrlSetting = emailSettings?.find(s => s.key === 'global.frontend_url');
            const frontendUrl = frontendUrlSetting?.value || process.env.DEPLOYSTACK_FRONTEND_URL || 'https://app.deploystack.com';
            const loginUrl = `${frontendUrl}/login`;

            // Send password change notification email
            const emailResult = await EmailService.sendPasswordChangedEmail({
              to: user.email,
              userName: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username,
              userEmail: user.email,
              changeTime,
              ipAddress,
              userAgent,
              loginUrl,
            }, request.log);

            if (emailResult.success) {
              server.log.info(`Password change notification email sent to: ${user.email}`);
            } else {
              server.log.warn(`Failed to send password change notification email: ${emailResult.error}`);
            }
          } else {
            server.log.debug('Email sending is disabled, skipping password change notification');
          }
        } catch (emailError) {
          // Don't fail the password change if email fails
          server.log.warn({ error: emailError }, 'Failed to send password change notification email:');
        }

        // Optional: Invalidate all other sessions for security
        server.log.info(`Consider invalidating other sessions for user: ${userId} after password change`);

        // Send success response
        const successResponse = {
          success: true,
          message: 'Password changed successfully.'
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        server.log.error(error, 'Error during password change:');
        const errorResponse = {
          success: false,
          error: 'An unexpected error occurred during password change.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
