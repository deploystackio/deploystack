import type { FastifyInstance } from 'fastify';
import { UserService } from '../../../services/userService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  ERROR_RESPONSE_SCHEMA,
  PAGINATION_QUERY_SCHEMA,
  USERS_LIST_PAGINATED_RESPONSE_SCHEMA,
  type ErrorResponse,
  type UsersListPaginatedResponse,
  type User,
  type PaginationQuery,
  validatePaginationParams
} from './schemas';

export default async function listUsersAdminRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /admin/users - List all users (Global Admin only) with pagination
  server.get('/users', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Users'],
      summary: 'List all users (Global Admin)',
      description: 'Allows global administrators to retrieve a paginated list of all users in the system. Supports pagination with limit (1-100, default: 20) and offset (default: 0) parameters.',
      security: [{ cookieAuth: [] }],

      querystring: PAGINATION_QUERY_SCHEMA,

      response: {
        200: {
          ...USERS_LIST_PAGINATED_RESPONSE_SCHEMA,
          description: 'Successfully retrieved users list'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid pagination parameters'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    },
  }, async (request, reply) => {
    try {
      // Parse and validate pagination parameters
      const query = request.query as PaginationQuery;
      const { limit, offset } = validatePaginationParams(query);

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

      // Apply pagination
      const total = serializedUsers.length;
      const paginatedUsers = serializedUsers.slice(offset, offset + limit);

      server.log.info({
        operation: 'list_users_admin',
        totalResults: total,
        returnedResults: paginatedUsers.length,
        pagination: { limit, offset }
      }, 'Admin users list completed');

      const successResponse: UsersListPaginatedResponse = {
        success: true,
        data: {
          users: paginatedUsers,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total
          }
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      // Check if it's a validation error
      if (error instanceof Error && error.message.includes('must be')) {
        server.log.warn({ error: error.message }, 'Invalid pagination parameters');
        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error fetching users in admin route');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch users'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
