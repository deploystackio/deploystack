import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../services/UserPreferencesService';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { 
  UPDATE_PREFERENCES_REQUEST_SCHEMA,
  SIMPLE_SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type UpdatePreferencesRequest,
  type SimpleSuccessResponse,
  type ErrorResponse,
  type UserPreferences
} from './schemas';

export default async function updatePreferences(server: FastifyInstance) {
  server.post('/users/me/preferences', {
    preValidation: requirePermission('preferences.edit'), // Require preferences.edit permission
    schema: {
      tags: ['User Preferences'],
      summary: 'Update user preferences',
      description: 'Updates multiple user preferences at once. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: UPDATE_PREFERENCES_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_PREFERENCES_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SIMPLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Preferences updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid preference data'
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
      const updates = request.body as UpdatePreferencesRequest;
      const db = getDb();
      const preferencesService = new UserPreferencesService(db);
      
      await preferencesService.updatePreferences(userId, updates as Partial<UserPreferences>);
      
      const successResponse: SimpleSuccessResponse = {
        success: true,
        message: 'Preferences updated successfully'
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error({ error }, 'Error updating user preferences:');
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update user preferences'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
