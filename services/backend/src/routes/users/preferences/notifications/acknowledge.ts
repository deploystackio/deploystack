import { type FastifyInstance } from 'fastify';
import { UserPreferencesService } from '../../../../services/UserPreferencesService';
import { requirePermission } from '../../../../middleware/roleMiddleware';
import { getDb } from '../../../../db';
import { 
  ACKNOWLEDGE_NOTIFICATION_REQUEST_SCHEMA,
  SIMPLE_SUCCESS_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type AcknowledgeNotificationRequest,
  type SimpleSuccessResponse,
  type ErrorResponse
} from '../schemas';

export default async function acknowledgeNotification(server: FastifyInstance) {
  server.post('/users/me/preferences/notifications/acknowledge', {
    preValidation: requirePermission('preferences.edit'), // Require preferences.edit permission
    schema: {
      tags: ['User Preferences', 'Notifications'],
      summary: 'Acknowledge notification',
      description: 'Records that a user has acknowledged a specific notification. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: ACKNOWLEDGE_NOTIFICATION_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ACKNOWLEDGE_NOTIFICATION_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...SIMPLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Notification acknowledged successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid notification ID'
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
      const { notification_id } = request.body as AcknowledgeNotificationRequest;
      const db = getDb();
      const preferencesService = new UserPreferencesService(db);
      
      await preferencesService.acknowledgeNotification(userId, notification_id);
      
      const successResponse: SimpleSuccessResponse = {
        success: true,
        message: `Notification '${notification_id}' acknowledged successfully`
      };
      
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      request.log.error('Error acknowledging notification:', error);
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to acknowledge notification'
      };
      
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
