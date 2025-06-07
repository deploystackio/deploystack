import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq, and, ne } from 'drizzle-orm';
import { UpdateProfileSchema, type UpdateProfileInput } from './schemas';
import { requireAuthHook } from '../../hooks/authHook';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas
const updateProfileSuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the profile update was successful'),
  message: z.string().describe('Success message'),
  user: z.object({
    id: z.string().describe('User ID'),
    username: z.string().describe('Updated username'),
    email: z.string().describe('User email'),
    first_name: z.string().nullable().describe('Updated first name'),
    last_name: z.string().nullable().describe('Updated last name'),
    auth_type: z.string().describe('Authentication type'),
    role_id: z.string().nullable().describe('User role ID')
  }).describe('Updated user information')
});

const updateProfileErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message describing what went wrong')
});

// Route schema for OpenAPI documentation
const updateProfileRouteSchema = {
  tags: ['Authentication'],
  summary: 'Update user profile',
  description: 'Allows authenticated users to update their profile information including username, first name, and last name. Requires an active session. At least one field must be provided.',
  body: zodToJsonSchema(UpdateProfileSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  security: [{ cookieAuth: [] }],
  response: {
    200: zodToJsonSchema(updateProfileSuccessResponseSchema.describe('Profile updated successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(updateProfileErrorResponseSchema.describe('Bad Request - Invalid input, no fields provided, or username already taken'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    401: zodToJsonSchema(updateProfileErrorResponseSchema.describe('Unauthorized - Authentication required'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(updateProfileErrorResponseSchema.describe('Internal Server Error - Profile update failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

export default async function updateProfileRoute(fastify: FastifyInstance) {
  fastify.put<{ Body: UpdateProfileInput }>(
    '/profile/update',
    { 
      schema: updateProfileRouteSchema,
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

        const body = request.body as UpdateProfileInput;
        const { username, first_name, last_name } = body;
        const userId = request.user.id;

        // Check if at least one field is provided
        if (!username && first_name === undefined && last_name === undefined) {
          return reply.status(400).send({ 
            success: false, 
            error: 'At least one field (username, first_name, or last_name) must be provided.' 
          });
        }

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

        // Get current user from database
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

        const currentUser = users[0];

        // If username is being updated, check if it's already taken by another user
        if (username && username !== currentUser.username) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingUsers = await (db as any)
            .select()
            .from(authUserTable)
            .where(and(
              eq(authUserTable.username, username),
              ne(authUserTable.id, userId)
            ))
            .limit(1);

          if (existingUsers.length > 0) {
            return reply.status(400).send({ 
              success: false, 
              error: 'Username is already taken.' 
            });
          }
        }

        // Prepare update data - only include fields that are provided
        const updateData: any = {
          updated_at: new Date()
        };

        if (username !== undefined) {
          updateData.username = username;
        }
        if (first_name !== undefined) {
          updateData.first_name = first_name;
        }
        if (last_name !== undefined) {
          updateData.last_name = last_name;
        }

        // Update user profile in database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .update(authUserTable)
          .set(updateData)
          .where(eq(authUserTable.id, userId));

        // Get updated user data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedUsers = await (db as any)
          .select()
          .from(authUserTable)
          .where(eq(authUserTable.id, userId))
          .limit(1);

        const updatedUser = updatedUsers[0];

        fastify.log.info(`Profile updated successfully for user: ${userId}`);

        // Send success response with updated user data
        return reply.status(200).send({
          success: true,
          message: 'Profile updated successfully.',
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            auth_type: updatedUser.auth_type,
            role_id: updatedUser.role_id
          }
        });

      } catch (error) {
        fastify.log.error(error, 'Error during profile update:');
        return reply.status(500).send({ 
          success: false, 
          error: 'An unexpected error occurred during profile update.' 
        });
      }
    }
  );
}
