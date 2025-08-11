import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  USERS_LIST_RESPONSE_SCHEMA,
  type ErrorResponse,
  type UsersListResponse,
  type User
} from './schemas';

export default async function listUsersRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /users - List all users (admin only)
  server.get('/users', {
    preValidation: requirePermission('users.list'),
    schema: {
      tags: ['Users'],
      summary: 'List all users',
      description: 'Retrieves a list of all users in the system. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...USERS_LIST_RESPONSE_SCHEMA,
          description: 'Successfully retrieved users list'
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
    },
  }, async (request, reply) => {
    try {
      const users = await userService.getAllUsers();
      
      // Convert users to proper response format following getCurrentUser pattern
      const serializedUsers: User[] = users.map(user => ({
        id: String(user.id),
        username: String(user.username),
        email: String(user.email),
        auth_type: String(user.auth_type),
        first_name: user.first_name ? String(user.first_name) : null,
        last_name: user.last_name ? String(user.last_name) : null,
        github_id: user.github_id ? String(user.github_id) : null,
        role_id: user.role_id ? String(user.role_id) : null,
        role: user.role ? {
          id: String(user.role.id),
          name: String(user.role.name),
          permissions: user.role.permissions
        } : undefined
      }));
      
      const successResponse: UsersListResponse = {
        success: true,
        data: serializedUsers
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching users');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch users'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
