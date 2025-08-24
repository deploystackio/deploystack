import { type FastifyInstance } from 'fastify';
import { DeviceService } from '../../../../services/deviceService';
import { requireAuthentication } from '../../../../middleware/roleMiddleware';
import { 
  UPDATE_DEVICE_SCHEMA,
  DEVICE_DETAIL_RESPONSE_SCHEMA, 
  ERROR_RESPONSE_SCHEMA,
  DEVICE_PARAMS_SCHEMA,
  type UpdateDeviceRequest,
  type DeviceDetailResponse,
  type ErrorResponse,
  type DeviceParams
} from './schemas';

export default async function updateDeviceRoute(server: FastifyInstance) {
  const deviceService = new DeviceService(server.db);

  server.put('/users/me/devices/:deviceId', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'Update device',
      description: 'Updates device information such as the device name. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: DEVICE_PARAMS_SCHEMA,
      body: UPDATE_DEVICE_SCHEMA,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_DEVICE_SCHEMA
          }
        }
      },
      response: {
        200: {
          ...DEVICE_DETAIL_RESPONSE_SCHEMA,
          description: 'Successfully updated device'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request'
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
      const updateData = request.body as UpdateDeviceRequest;

      const updatedDevice = await deviceService.updateDevice(deviceId, userId, {
        device_name: updateData.device_name
      });

      const response: DeviceDetailResponse = {
        success: true,
        device: updatedDevice
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
        error: error instanceof Error ? error.message : 'Failed to update device'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
