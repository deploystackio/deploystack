// Shared schemas for user devices CRUD operations
// Following DeployStack architecture: single source of truth for schemas

export const DEVICE_RESPONSE_SCHEMA = {
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

export const DEVICES_LIST_RESPONSE_SCHEMA = {
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

export const DEVICE_DETAIL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    device: DEVICE_RESPONSE_SCHEMA
  },
  required: ['success', 'device']
} as const;

export const UPDATE_DEVICE_SCHEMA = {
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

export const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export const DEVICE_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    deviceId: { type: 'string', minLength: 1 }
  },
  required: ['deviceId'],
  additionalProperties: false
} as const;

// Shared TypeScript interfaces
export interface UpdateDeviceRequest {
  device_name: string;
}

export interface DevicesListResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  devices: any[];
}

export interface DeviceDetailResponse {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  device: any;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface DeviceParams {
  deviceId: string;
}
