import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  ERROR_RESPONSE_SCHEMA,
  SEARCH_USERS_QUERY_SCHEMA,
  USERS_LIST_PAGINATED_RESPONSE_SCHEMA,
  type ErrorResponse,
  type UsersListPaginatedResponse,
  type User,
  type SearchUsersQuery,
  validatePaginationParams
} from './schemas';

export default async function searchUsersRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /users/search - Search users with filters and pagination
  server.get('/users/search', {
    preValidation: requirePermission('users.list'),
    schema: {
      tags: ['Users'],
      summary: 'Search users',
      description: 'Search and filter users with pagination support. Requires admin permissions. Supports filtering by username (partial, case-insensitive), email (partial, case-insensitive), auth_type (exact), and role_id (exact). Results are paginated with limit (1-100, default: 20) and offset (default: 0) parameters.',
      security: [{ cookieAuth: [] }],

      querystring: SEARCH_USERS_QUERY_SCHEMA,

      response: {
        200: {
          ...USERS_LIST_PAGINATED_RESPONSE_SCHEMA,
          description: 'Successfully retrieved filtered users'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid parameters'
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
      // Parse and validate pagination parameters
      const query = request.query as SearchUsersQuery;
      const { limit, offset } = validatePaginationParams(query);

      const allUsers = await userService.getAllUsers();

      // Convert users to proper response format
      let serializedUsers: User[] = allUsers.map(user => ({
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

      // Apply filters
      if (query.username) {
        serializedUsers = serializedUsers.filter(u =>
          u.username.toLowerCase().includes(query.username!.toLowerCase())
        );
      }

      if (query.email) {
        serializedUsers = serializedUsers.filter(u =>
          u.email.toLowerCase().includes(query.email!.toLowerCase())
        );
      }

      if (query.auth_type) {
        serializedUsers = serializedUsers.filter(u =>
          u.auth_type === query.auth_type
        );
      }

      if (query.role_id) {
        serializedUsers = serializedUsers.filter(u =>
          u.role_id === query.role_id
        );
      }

      // Apply pagination
      const total = serializedUsers.length;
      const paginatedUsers = serializedUsers.slice(offset, offset + limit);

      server.log.info({
        operation: 'search_users',
        totalResults: total,
        returnedResults: paginatedUsers.length,
        filters: {
          username: query.username,
          email: query.email,
          auth_type: query.auth_type,
          role_id: query.role_id
        },
        pagination: { limit, offset }
      }, 'User search completed');

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
        server.log.warn({ error: error.message }, 'Invalid search parameters');
        const errorResponse: ErrorResponse = {
          success: false,
          error: error.message
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      server.log.error(error, 'Error searching users');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to search users'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
