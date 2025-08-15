import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../services/UserPreferencesService';
import { requirePermission } from '../../../middleware/roleMiddleware';
import { getDb } from '../../../db';
import { 
  PREFERENCE_VALUE_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type PreferenceValueResponse,
  type ErrorResponse
} from './schemas';

export default async function getSpecificPreference(server: FastifyInstance) {
  server.get('/users/me/preferences/:key', {
    preValidation: requirePermission('preferences.view'), // Require preferences.view permission
    schema: {
      tags: ['User Preferences'],
      summary: 'Get specific preference',
      description: 'Retrieves a specific preference value by key path (e.g., "walkthrough", "ui.theme")',
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
      
      response: {
        200: {
          ...PREFERENCE_VALUE_RESPONSE_SCHEMA,
          description: 'Preference value retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Preference not found'
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
      const db = getDb();
      const preferencesService = new UserPreferencesService(db);
      
      const value = await preferencesService.getPreference(userId, key);
      
      if (value === undefined) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: `Preference '${key}' not found`
        };
        
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }
      
      const successResponse: PreferenceValueResponse = {
        success: true,
        value
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error('Error getting specific preference:', error);
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to retrieve preference'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
