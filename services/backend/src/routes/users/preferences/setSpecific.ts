import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../services/UserPreferencesService';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { 
  SET_PREFERENCE_REQUEST_SCHEMA,
  SIMPLE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type SetPreferenceRequest,
  type SimpleSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function setSpecificPreference(server: FastifyInstance) {
  server.put('/users/me/preferences/:key', {
    preValidation: requirePermission('preferences.edit'), // Require preferences.edit permission
    schema: {
      tags: ['User Preferences'],
      summary: 'Set specific preference',
      description: 'Sets a specific preference value by key path (e.g., "walkthrough", "ui.theme"). Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      params: {
        type: 'object',
        properties: {
          key: { 
            type: 'string', 
            minLength: 1,
            description: 'Preference key path (supports dot notation for nested preferences)'
          }
        },
        required: ['key'],
        additionalProperties: false
      },
      
      // Fastify validation schema
      body: SET_PREFERENCE_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: SET_PREFERENCE_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SIMPLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Preference set successfully'
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
      const { key } = request.params as { key: string };
      const { value } = request.body as SetPreferenceRequest;
      const db = getDb();
      const preferencesService = new UserPreferencesService(db);
      
      await preferencesService.setPreference(userId, key, value);
      
      const successResponse: SimpleSuccessResponse = {
        success: true,
        message: `Preference '${key}' updated successfully`
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error('Error setting specific preference:', error);
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to set preference'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
