import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  PARAMS_WITH_ROLE_ID_SCHEMA, 
  USERS_LIST_RESPONSE_SCHEMA,
  type ErrorResponse,
  type ParamsWithRoleId,
  type UsersListResponse
} from './schemas';

export default async function getUsersByRoleRoute(server: FastifyInstance) {
  const userService = new UserService();

  server.get('/users/role/:roleId', {
    preValidation: requirePermission('users.list'),
    schema: {
      tags: ['Users'],
      summary: 'Get users by role',
      description: 'Retrieves all users with a specific role. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      
      params: PARAMS_WITH_ROLE_ID_SCHEMA,
      
      response: {
        200: {
          ...USERS_LIST_RESPONSE_SCHEMA,
          description: 'Users with specified role retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
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
      const { roleId } = request.params as ParamsWithRoleId;
      const users = await userService.getUsersByRole(roleId);
      
      // Create clean response object with proper typing
      const usersResponse: UsersListResponse = {
        success: true,
        data: users.map(user => ({
          id: String(user.id),
          username: String(user.username),
          email: String(user.email),
          auth_type: String(user.auth_type),
          first_name: user.first_name ? String(user.first_name) : null,
          last_name: user.last_name ? String(user.last_name) : null,
          role_id: user.role_id ? String(user.role_id) : null,
          github_id: user.github_id ? String(user.github_id) : null,
          role: user.role ? {
            id: String(user.role.id),
            name: String(user.role.name),
            permissions: user.role.permissions
          } : undefined
        }))
      };
      
      const jsonString = JSON.stringify(usersResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching users by role');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch users by role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
