import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verify, hash } from '@node-rs/argon2';
import { getDb, getSchema } from '../../db';
import { eq } from 'drizzle-orm';
import { ChangePasswordSchema, type ChangePasswordInput } from './schemas';
import { requireAuthHook } from '../../hooks/authHook';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const changePasswordSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the password change was successful'),
  message: z.string().describe('Success message')
});

const changePasswordErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const changePasswordRouteSchema = {
  tags: ['Authentication'],
  summary: 'Change user password',
  description: 'Allows authenticated users to change their password by providing their current password and a new password. Requires an active session.',
  body: zodToJsonSchema(ChangePasswordSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  security: [{ cookieAuth: [] }],
  response: {
    200: zodToJsonSchema(changePasswordSuccessResponseSchema.describe('Password changed successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(changePasswordErrorResponseSchema.describe('Bad Request - Invalid input or incorrect current password'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    401: zodToJsonSchema(changePasswordErrorResponseSchema.describe('Unauthorized - Authentication required'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    403: zodToJsonSchema(changePasswordErrorResponseSchema.describe('Forbidden - Cannot change password for non-email users'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(changePasswordErrorResponseSchema.describe('Internal Server Error - Password change failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function changePasswordRoute(fastify: FastifyInstance) {
  fastify.put<{ Body: ChangePasswordInput }>(
    '/change-password',
    { 
      schema: changePasswordRouteSchema,
      preHandler: requireAuthHook // Require authentication
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if user is authenticated (requireAuthHook ensures this)
        if (!request.user || !request.user.id) {
          return reply.status(401).send({ 
            success: false, 
            error: 'Unauthorized: Authentication required.' 
          });
        }

        const body = request.body as ChangePasswordInput;
        const { current_password, new_password } = body;
        const userId = request.user.id;

        const db = getDb();
        const schema = getSchema();
        const authUserTable = schema.authUser;

        if (!authUserTable) {
          fastify.log.error('AuthUser table not found in schema');
          return reply.status(500).send({ 
            success: false, 
            error: 'Internal server error: User table configuration missing.' 
          });
        }

        // Get user from database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.id, userId))
          .limit(1);

        if (users.length === 0) {
          return reply.status(401).send({ 
            success: false, 
            error: 'User not found.' 
          });
        }

        const user = users[0];

        // Check if user has email authentication (has a password)
        if (!user.hashed_password || user.auth_type !== 'email_signup') {
          return reply.status(403).send({ 
            success: false, 
            error: 'Password change is only available for email-authenticated users.' 
          });
        }

        // Verify current password
        const validCurrentPassword = await verify(user.hashed_password, current_password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        if (!validCurrentPassword) {
          return reply.status(400).send({ 
            success: false, 
            error: 'Current password is incorrect.' 
          });
        }

        // Check if new password is different from current password
        const samePassword = await verify(user.hashed_password, new_password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        if (samePassword) {
          return reply.status(400).send({ 
            success: false, 
            error: 'New password must be different from current password.' 
          });
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

        fastify.log.info(`Password changed successfully for user: ${userId}`);

        // Optional: Invalidate all other sessions for security
        // This would require additional implementation to track and invalidate sessions
        // For now, we'll just log this as a security consideration
        fastify.log.info(`Consider invalidating other sessions for user: ${userId} after password change`);

        // Send success response
        return reply.status(200).send({
          success: true,
          message: 'Password changed successfully.'
        });

      } catch (error) {
        fastify.log.error(error, 'Error during password change:');
        return reply.status(500).send({ 
          success: false, 
          error: 'An unexpected error occurred during password change.' 
        });
      }
    }
  );
}
