import { type FastifyInstance } from 'fastify';
import { DeviceService } from '../../../../services/deviceService';
import { requireAuthentication } from '../../../../middleware/roleMiddleware';
import { 
  DEVICE_DETAIL_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  DEVICE_PARAMS_SCHEMA,
  type DeviceDetailResponse,
  type ErrorResponse,
  type DeviceParams
} from './schemas';

export default async function getDeviceRoute(server: FastifyInstance) {
  const deviceService = new DeviceService(server.db);

  server.get('/users/me/devices/:deviceId', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'Get device details',
      description: 'Retrieves detailed information about a specific device owned by the authenticated user.',
      security: [{ cookieAuth: [] }],
      params: DEVICE_PARAMS_SCHEMA,
      response: {
        200: {
          ...DEVICE_DETAIL_RESPONSE_SCHEMA,
          description: 'Successfully retrieved device details'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Device not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { deviceId } = request.params as DeviceParams;
      const userId = request.user!.id;

      const device = await deviceService.getDeviceById(deviceId);
      
      if (!device || device.user_id !== userId) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Device not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const response: DeviceDetailResponse = {
        success: true,
        device
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve device'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
