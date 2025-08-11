import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requireOwnershipOrAdmin, getUserIdFromParams } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  PARAMS_WITH_ID_SCHEMA, 
  USER_PROFILE_SCHEMA,
  type ErrorResponse,
  type ParamsWithId,
  type UserProfile
} from './schemas';

export default async function getUserByIdRoute(server: FastifyInstance) {
  const userService = new UserService();

  server.get('/users/:id', {
    preValidation: requireOwnershipOrAdmin(getUserIdFromParams),
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Retrieves a specific user by their ID. Users can access their own profile, admins can access any user.',
      security: [{ cookieAuth: [] }],
      
      params: PARAMS_WITH_ID_SCHEMA,
      
      response: {
        200: {
          ...USER_PROFILE_SCHEMA,
          description: 'User data retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Cannot access this user'
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
      const user = await userService.getUserById(id);
      
      if (!user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create clean response object
      const userResponse: UserProfile = {
        id: String(user.id),
        username: String(user.username),
        email: String(user.email),
        first_name: user.first_name ? String(user.first_name) : null,
        last_name: user.last_name ? String(user.last_name) : null,
        role_id: user.role_id ? String(user.role_id) : null,
        auth_type: user.auth_type ? String(user.auth_type) : null,
        github_id: user.github_id ? String(user.github_id) : null
      };

      const jsonString = JSON.stringify(userResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching user');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
