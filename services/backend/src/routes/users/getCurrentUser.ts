import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requireAuthentication } from '../../middleware/roleMiddleware';
import { GlobalSettings } from '../../global-settings/helpers';
import {
  ERROR_RESPONSE_SCHEMA,
  USER_PROFILE_SCHEMA,
  type ErrorResponse,
  type CurrentUserProfile
} from './schemas';

export default async function getCurrentUserRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /users/me - Get current user profile
  server.get('/users/me', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
      description: 'Retrieves the profile of the currently authenticated user.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...USER_PROFILE_SCHEMA,
          description: 'Current user profile data'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
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
      // request.user is guaranteed to exist due to requireAuthentication() middleware
      const userId = request.user!.id;

      const user = await userService.getUserById(userId);

      if (!user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Fetch user-display settings dynamically
      const userDisplaySettingsRaw = await GlobalSettings.getGroupValues('user-display');

      // Convert string values to proper types (booleans)
      const userDisplaySettings: Record<string, string | boolean | null> = {};
      for (const [key, value] of Object.entries(userDisplaySettingsRaw)) {
        if (value === 'true') {
          userDisplaySettings[key] = true;
        } else if (value === 'false') {
          userDisplaySettings[key] = false;
        } else {
          userDisplaySettings[key] = value;
        }
      }

      // Create clean response object to avoid serialization issues
      const userProfile: CurrentUserProfile = {
        id: String(user.id),
        username: String(user.username),
        email: String(user.email),
        first_name: user.first_name ? String(user.first_name) : null,
        last_name: user.last_name ? String(user.last_name) : null,
        role_id: user.role_id ? String(user.role_id) : null,
        auth_type: user.auth_type ? String(user.auth_type) : null,
        github_id: user.github_id ? String(user.github_id) : null,
        user_display_settings: userDisplaySettings
      };

      const jsonString = JSON.stringify(userProfile);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching current user');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user profile'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
