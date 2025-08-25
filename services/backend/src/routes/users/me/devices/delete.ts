import { type FastifyInstance } from 'fastify';
import { DeviceService } from '../../../../services/deviceService';
import { getDb } from '../../../../db';
import { requireAuthentication } from '../../../../middleware/roleMiddleware';
import { 
  SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  DEVICE_PARAMS_SCHEMA,
  type SuccessResponse,
  type ErrorResponse,
  type DeviceParams
} from './schemas';

export default async function deleteDeviceRoute(server: FastifyInstance) {
  const db = getDb();
  const deviceService = new DeviceService(db);

  server.delete('/users/me/devices/:deviceId', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'Remove device',
      description: 'Removes a device from the user account. This will deactivate the device and prevent it from accessing MCP configurations.',
      security: [{ cookieAuth: [] }],
      params: DEVICE_PARAMS_SCHEMA,
      response: {
        200: {
          ...SUCCESS_RESPONSE_SCHEMA,
          description: 'Successfully removed device'
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

      await deviceService.removeDevice(deviceId, userId);

      const response: SuccessResponse = {
        success: true,
        message: 'Device removed successfully'
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error && error.message === 'Device not found or access denied') {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Device not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove device'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
