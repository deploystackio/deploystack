import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  PARAMS_WITH_ID_SCHEMA,
  type ErrorResponse,
  type ParamsWithId
} from './schemas';

// Route-specific Schema Constants

const DELETE_USER_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the user deletion was successful'
    },
    message: { 
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'message']
} as const;

// TypeScript interfaces for route-specific types
interface DeleteUserSuccessResponse {
  success: boolean;
  message: string;
}

export default async function deleteUserRoute(server: FastifyInstance) {
  const userService = new UserService();

  // DELETE /users/:id - Delete user (admin only)
  server.delete('/users/:id', {
    preValidation: requirePermission('users.delete'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Users'],
      summary: 'Delete user',
      description: 'Deletes a user from the system. Requires admin permissions. Users cannot delete themselves.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: PARAMS_WITH_ID_SCHEMA,
      
      response: {
        200: {
          ...DELETE_USER_SUCCESS_RESPONSE_SCHEMA,
          description: 'User deleted successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or cannot delete own account'
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

      const successResponse: DeleteUserSuccessResponse = {
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
      
      server.log.error(error, 'Error deleting user');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to delete user'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
