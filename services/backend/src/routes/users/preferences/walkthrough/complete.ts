import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../../services/UserPreferencesService';
import { requirePermission } from '../../../../middleware/roleMiddleware';
import { getDb } from '../../../../db';
import { 
  SIMPLE_SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type SimpleSuccessResponse,
  type ErrorResponse
} from '../schemas';

export default async function completeWalkthrough(server: FastifyInstance) {
  server.post('/users/me/preferences/walkthrough/complete', {
    preValidation: requirePermission('preferences.edit'), // Require preferences.edit permission
    schema: {
      tags: ['User Preferences', 'Walkthrough'],
      summary: 'Complete walkthrough',
      description: 'Marks the user walkthrough as completed and records the completion timestamp',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...SIMPLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Walkthrough marked as completed'
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
      
      await preferencesService.completeWalkthrough(userId);
      
      const successResponse: SimpleSuccessResponse = {
        success: true,
        message: 'Walkthrough marked as completed'
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error('Error completing walkthrough:', error);
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to complete walkthrough'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
