import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../services/UserPreferencesService';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { 
  PREFERENCES_SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type PreferencesSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getPreferences(server: FastifyInstance) {
  server.get('/users/me/preferences', {
    preValidation: requirePermission('preferences.view'), // Require preferences.view permission
    schema: {
      tags: ['User Preferences'],
      summary: 'Get user preferences',
      description: 'Retrieves all preferences for the authenticated user',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...PREFERENCES_SUCCESS_RESPONSE_SCHEMA,
          description: 'User preferences retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal server error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const db = getDb();
      const preferencesService = new UserPreferencesService(db);
      
      const preferences = await preferencesService.getUserPreferences(userId);
      
      const successResponse: PreferencesSuccessResponse = {
        success: true,
        preferences
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error({ error }, 'Error getting user preferences:');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to retrieve user preferences'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
