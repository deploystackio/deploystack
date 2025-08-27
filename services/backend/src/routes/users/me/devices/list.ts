import { type FastifyInstance } from 'fastify';
import { DeviceService } from '../../../../services/deviceService';
import { getDb } from '../../../../db';
import { requireAuthentication } from '../../../../middleware/roleMiddleware';
import { 
  DEVICES_LIST_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  type DevicesListResponse,
  type ErrorResponse
} from './schemas';

export default async function listDevicesRoute(server: FastifyInstance) {
  server.get('/users/me/devices', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'List my devices',
      description: 'Retrieves all devices registered to the authenticated user, ordered by last activity.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...DEVICES_LIST_RESPONSE_SCHEMA,
          description: 'Successfully retrieved user devices'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const db = getDb(); // ✅ Called inside route handler when database is ready
      const deviceService = new DeviceService(db);
      const userId = request.user!.id;
      const devices = await deviceService.getDevicesByUser(userId);

      const response: DevicesListResponse = {
        success: true,
        devices
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve devices'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
