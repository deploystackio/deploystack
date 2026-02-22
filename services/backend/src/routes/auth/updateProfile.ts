import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDb, getSchema } from '../../db';
import { eq, and, ne } from 'drizzle-orm';
import { type UpdateProfileInput } from './schemas';
import { requireAuthHook } from '../../hooks/authHook';

const USER_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    email: { type: 'string' },
    first_name: { type: ['string', 'null'] },
    last_name: { type: ['string', 'null'] },
    auth_type: { type: 'string' },
    role_id: { type: ['string', 'null'] }
  },
  required: ['id', 'username', 'email', 'auth_type']
} as const;

const UPDATE_PROFILE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    user: USER_OBJECT
  },
  required: ['success', 'message', 'user']
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
const updateProfileRouteSchema = {
  tags: ['Authentication'],
  summary: 'Update user profile',
  description: 'Allows authenticated users to update their profile information including username, first name, and last name. Requires an active session. At least one field must be provided. Requires Content-Type: application/json header when sending request body.',
  body: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_]+$'
      },
      first_name: {
        type: 'string',
        maxLength: 50
      },
      last_name: {
        type: 'string',
        maxLength: 50
      }
    },
    additionalProperties: false
  },
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      ...UPDATE_PROFILE_SUCCESS_RESPONSE_SCHEMA,
      description: 'Profile updated successfully'
    },
    400: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - Invalid input, no fields provided, username already taken, or missing Content-Type header'
    },
    401: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Unauthorized - Authentication required'
    },
    403: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Forbidden - Cannot change username for non-email users'
    },
    500: {
      ...ERROR_RESPONSE_SCHEMA,
      description: 'Internal Server Error - Profile update failed'
    }
  }
};

export default async function updateProfileRoute(server: FastifyInstance) {
  server.put<{ Body: UpdateProfileInput }>(
    '/profile/update',
    {
      schema: updateProfileRouteSchema,
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

        const body = request.body as UpdateProfileInput;
        const { username, first_name, last_name } = body;
        const userId = request.user.id;

        // Check if at least one field is provided
        if (!username && first_name === undefined && last_name === undefined) {
          const errorResponse = {
            success: false,
            error: 'At least one field (username, first_name, or last_name) must be provided.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }

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

        // Get current user from database
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

        const currentUser = users[0];

        // Check if username change is allowed for this auth type
        if (username && username !== currentUser.username && currentUser.auth_type !== 'email_signup') {
          const errorResponse = {
            success: false,
            error: 'Username change is only available for email-authenticated users.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(403).type('application/json').send(jsonString);
        }

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
            const errorResponse = {
              success: false,
              error: 'Username is already taken.'
            };
            const jsonString = JSON.stringify(errorResponse);
            return reply.status(400).type('application/json').send(jsonString);
          }
        }

        // Prepare update data - only include fields that are provided
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        server.log.info(`Profile updated successfully for user: ${userId}`);

        // Send success response with updated user data
        const successResponse = {
          success: true,
          message: 'Profile updated successfully.',
          user: {
            id: String(updatedUser.id),
            username: String(updatedUser.username),
            email: String(updatedUser.email),
            first_name: updatedUser.first_name ? String(updatedUser.first_name) : null,
            last_name: updatedUser.last_name ? String(updatedUser.last_name) : null,
            auth_type: String(updatedUser.auth_type),
            role_id: updatedUser.role_id ? String(updatedUser.role_id) : null
          }
        };
        const jsonString = JSON.stringify(successResponse);
        return reply.status(200).type('application/json').send(jsonString);

      } catch (error) {
        server.log.error(error, 'Error during profile update:');
        const errorResponse = {
          success: false,
          error: 'An unexpected error occurred during profile update.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }
    }
  );
}
