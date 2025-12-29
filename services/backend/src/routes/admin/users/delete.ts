import type { FastifyInstance } from 'fastify';
import { UserService } from '../../../services/userService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  ERROR_RESPONSE_SCHEMA,
  SUCCESS_MESSAGE_RESPONSE_SCHEMA,
  PARAMS_WITH_ID_SCHEMA,
  type ErrorResponse,
  type SuccessMessageResponse,
  type ParamsWithId
} from './schemas';

export default async function deleteUserAdminRoute(server: FastifyInstance) {
  const userService = new UserService();

  // DELETE /admin/users/:id - Delete user (Global Admin only)
  server.delete('/users/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Users'],
      summary: 'Delete user (Global Admin)',
      description: 'Allows global administrators to delete a user from the system. Users cannot delete themselves. Cannot delete the last global administrator.',
      security: [{ cookieAuth: [] }],

      // Fastify validation schema
      params: PARAMS_WITH_ID_SCHEMA,

      response: {
        200: {
          ...SUCCESS_MESSAGE_RESPONSE_SCHEMA,
          description: 'User deleted successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Cannot delete own account or last global administrator'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - User not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // TypeScript type assertion (Fastify has already validated)
      const { id } = request.params as ParamsWithId;

      // Prevent users from deleting themselves
      if (request.user?.id === id) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Cannot delete your own account'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const success = await userService.deleteUser(id);

      if (!success) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: SuccessMessageResponse = {
        success: true,
        message: 'User deleted successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot delete the last global administrator') {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Cannot delete the last global administrator'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error deleting user in admin route');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to delete user'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
