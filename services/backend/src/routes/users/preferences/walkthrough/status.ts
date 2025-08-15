import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../../services/UserPreferencesService';
import { requirePermission } from '../../../../middleware/roleMiddleware';
import { getDb } from '../../../../db';
import { 
  ERROR_RESPONSE_SCHEMA,
  type ErrorResponse
} from '../schemas';

// Simple response schema for walkthrough status
const WALKTHROUGH_STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    should_show_walkthrough: { type: 'boolean' }
  },
  required: ['success', 'should_show_walkthrough']
} as const;

interface WalkthroughStatusResponse {
  success: boolean;
  should_show_walkthrough: boolean;
}

export default async function getWalkthroughStatus(server: FastifyInstance) {
  server.get('/users/me/preferences/walkthrough/status', {
    preValidation: requirePermission('preferences.view'), // Require preferences.view permission
    schema: {
      tags: ['User Preferences', 'Walkthrough'],
      summary: 'Get walkthrough status',
      description: 'Checks if the user should see the walkthrough based on their completion and cancellation status',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...WALKTHROUGH_STATUS_RESPONSE_SCHEMA,
          description: 'Walkthrough status retrieved successfully'
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
      
      const shouldShowWalkthrough = await preferencesService.shouldShowWalkthrough(userId);
      
      const successResponse: WalkthroughStatusResponse = {
        success: true,
        should_show_walkthrough: shouldShowWalkthrough
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error('Error getting walkthrough status:', error);
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to get walkthrough status'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
