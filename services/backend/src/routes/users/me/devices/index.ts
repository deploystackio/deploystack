import { type FastifyInstance } from 'fastify';
import { DeviceService } from '../../../../services/deviceService';
import { requireAuthentication } from '../../../../middleware/roleMiddleware';




// Reusable Schema Constants
const DEVICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique device identifier' },
    user_id: { type: 'string', description: 'User ID who owns the device' },
    device_name: { type: 'string', description: 'User-friendly device name' },
    hostname: { type: 'string', nullable: true, description: 'System hostname' },
    hardware_id: { type: 'string', nullable: true, description: 'Hardware fingerprint' },
    os_type: { type: 'string', nullable: true, description: 'Operating system type' },
    os_version: { type: 'string', nullable: true, description: 'Operating system version' },
    arch: { type: 'string', nullable: true, description: 'System architecture' },
    node_version: { type: 'string', nullable: true, description: 'Node.js version' },
    last_ip: { type: 'string', nullable: true, description: 'Last known IP address' },
    user_agent: { type: 'string', nullable: true, description: 'User agent string' },
    is_active: { type: 'boolean', description: 'Whether device is active' },
    is_trusted: { type: 'boolean', description: 'Whether device is trusted' },
    last_login_at: { type: 'string', format: 'date-time', nullable: true, description: 'Last login timestamp' },
    last_activity_at: { type: 'string', format: 'date-time', nullable: true, description: 'Last activity timestamp' },
    created_at: { type: 'string', format: 'date-time', description: 'Device creation timestamp' },
    updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
  },
  required: ['id', 'user_id', 'device_name', 'is_active', 'is_trusted', 'created_at', 'updated_at']
} as const;

const DEVICES_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    devices: {
      type: 'array',
      items: DEVICE_RESPONSE_SCHEMA
    }
  },
  required: ['success', 'devices']
} as const;

const DEVICE_DETAIL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    device: DEVICE_RESPONSE_SCHEMA
  },
  required: ['success', 'device']
} as const;

const UPDATE_DEVICE_SCHEMA = {
  type: 'object',
  properties: {
    device_name: { 
      type: 'string', 
      minLength: 1, 
      maxLength: 100,
      description: 'New device name' 
    }
  },
  required: ['device_name'],
  additionalProperties: false
} as const;

const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
interface UpdateDeviceRequest {
  device_name: string;
}

interface DevicesListResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  devices: any[];
}

interface DeviceDetailResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  device: any;
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export default async function userDevicesRoute(server: FastifyInstance) {
  const deviceService = new DeviceService(server.db);

  // GET /api/users/me/devices - List user's devices
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

  // GET /api/users/me/devices/:deviceId - Get specific device
  server.get('/users/me/devices/:deviceId', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'Get device details',
      description: 'Retrieves detailed information about a specific device owned by the authenticated user.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', minLength: 1 }
        },
        required: ['deviceId'],
        additionalProperties: false
      },
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
      const { deviceId } = request.params as { deviceId: string };
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

  // PUT /api/users/me/devices/:deviceId - Update device
  server.put('/users/me/devices/:deviceId', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'Update device',
      description: 'Updates device information such as the device name. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', minLength: 1 }
        },
        required: ['deviceId'],
        additionalProperties: false
      },
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
      const { deviceId } = request.params as { deviceId: string };
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

  // DELETE /api/users/me/devices/:deviceId - Remove device
  server.delete('/users/me/devices/:deviceId', {
    preValidation: requireAuthentication(),
    schema: {
      tags: ['User Devices'],
      summary: 'Remove device',
      description: 'Removes a device from the user account. This will deactivate the device and prevent it from accessing MCP configurations.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', minLength: 1 }
        },
        required: ['deviceId'],
        additionalProperties: false
      },
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
      const { deviceId } = request.params as { deviceId: string };
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
