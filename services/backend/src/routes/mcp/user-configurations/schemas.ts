// Shared parameter schemas
export const TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    },
    installationId: {
      type: 'string', 
      minLength: 1,
      description: 'Installation ID'
    },
    configId: {
      type: 'string',
      minLength: 1,
      description: 'User configuration ID'
    }
  },
  required: ['teamId', 'installationId', 'configId'],
  additionalProperties: false
} as const;

export const TEAM_AND_INSTALLATION_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    },
    installationId: {
      type: 'string',
      minLength: 1, 
      description: 'Installation ID'
    }
  },
  required: ['teamId', 'installationId'],
  additionalProperties: false
} as const;

// Request schemas
export const CREATE_USER_CONFIG_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    device_id: {
      type: 'string',
      description: 'Optional device ID for device-specific configuration'
    },
    user_args: {
      type: 'array',
      items: { type: 'string' },
      description: 'User-specific command line arguments'
    },
    user_env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-specific environment variables'
    }
  },
  additionalProperties: false
} as const;

export const UPDATE_USER_CONFIG_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    device_id: {
      type: 'string',
      description: 'Optional device ID for device-specific configuration'
    },
    user_args: {
      type: 'array',
      items: { type: 'string' },
      description: 'User-specific command line arguments'
    },
    user_env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-specific environment variables'
    }
  },
  additionalProperties: false
} as const;

export const UPDATE_USER_ARGS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    args: {
      type: 'array',
      items: { type: 'string' },
      description: 'User-specific command line arguments'
    }
  },
  required: ['args'],
  additionalProperties: false
} as const;

export const UPDATE_USER_ENV_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-specific environment variables'
    }
  },
  required: ['env'],
  additionalProperties: false
} as const;

// Response schemas
export const USER_CONFIG_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User configuration ID' },
    installation_id: { type: 'string', description: 'Installation ID' },
    user_id: { type: 'string', description: 'User ID' },
    device_id: { type: 'string', description: 'Device ID' },
    user_args: {
      type: 'array',
      items: { type: 'string' },
      description: 'User-specific command line arguments'
    },
    user_env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-specific environment variables'
    },
    created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
    updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
    last_used_at: { type: 'string', format: 'date-time', description: 'Last used timestamp' }
  },
  required: ['id', 'installation_id', 'user_id', 'created_at', 'updated_at'],
  additionalProperties: false
} as const;

export const USER_CONFIG_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    data: USER_CONFIG_RESPONSE_SCHEMA,
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

export const USER_CONFIG_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    data: {
      type: 'array',
      items: USER_CONFIG_RESPONSE_SCHEMA
    },
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

export const USER_CONFIG_UPDATE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    data: USER_CONFIG_RESPONSE_SCHEMA,
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'data', 'message'],
  additionalProperties: false
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error'],
  additionalProperties: false
} as const;

// Common error responses
export const COMMON_ERROR_RESPONSES = {
  400: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Bad Request'
  },
  401: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Unauthorized'
  },
  403: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Forbidden'
  },
  404: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Not Found'
  },
  500: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Internal Server Error'
  }
} as const;

// Security schema
export const DUAL_AUTH_SECURITY = [
  { cookieAuth: [] },
  { bearerAuth: [] }
] as const;

// TypeScript interfaces
export interface TeamAndInstallationAndConfigParams {
  teamId: string;
  installationId: string;
  configId: string;
}

export interface TeamAndInstallationParams {
  teamId: string;
  installationId: string;
}

export interface CreateUserConfigRequest {
  device_id?: string;
  user_args?: string[];
  user_env?: Record<string, string>;
}

export interface UpdateUserConfigRequest {
  device_id?: string;
  user_args?: string[];
  user_env?: Record<string, string>;
}

export interface UpdateUserArgsRequest {
  args: string[];
}

export interface UpdateUserEnvRequest {
  env: Record<string, string>;
}

export interface UserConfigData {
  id: string;
  installation_id: string;
  user_id: string;
  device_id?: string;
  user_args?: string[];
  user_env?: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface UserConfigSuccessResponse {
  success: boolean;
  data: UserConfigData;
  message?: string;
}

export interface UserConfigListResponse {
  success: boolean;
  data: UserConfigData[];
  message?: string;
}

export interface UserConfigUpdateSuccessResponse {
  success: boolean;
  data: UserConfigData;
  message: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

// Fastify route schemas
export const getUserConfigurationByIdSchema = {
  params: TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
  response: {
    200: USER_CONFIG_SUCCESS_RESPONSE_SCHEMA,
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

export const createUserConfigurationSchema = {
  params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  body: CREATE_USER_CONFIG_REQUEST_SCHEMA,
  response: {
    201: USER_CONFIG_SUCCESS_RESPONSE_SCHEMA,
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

export const listUserConfigurationsSchema = {
  params: TEAM_AND_INSTALLATION_PARAMS_SCHEMA,
  response: {
    200: USER_CONFIG_LIST_RESPONSE_SCHEMA,
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

export const updateUserConfigurationSchema = {
  params: TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
  body: UPDATE_USER_CONFIG_REQUEST_SCHEMA,
  response: {
    200: USER_CONFIG_UPDATE_SUCCESS_RESPONSE_SCHEMA,
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

export const deleteUserConfigurationSchema = {
  params: TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', default: true },
        message: { type: 'string', description: 'Success message' }
      },
      required: ['success', 'message'],
      additionalProperties: false
    },
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

export const updateUserArgsSchema = {
  params: TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
  body: UPDATE_USER_ARGS_REQUEST_SCHEMA,
  response: {
    200: USER_CONFIG_UPDATE_SUCCESS_RESPONSE_SCHEMA,
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

export const updateUserEnvSchema = {
  params: TEAM_AND_INSTALLATION_AND_CONFIG_PARAMS_SCHEMA,
  body: UPDATE_USER_ENV_REQUEST_SCHEMA,
  response: {
    200: USER_CONFIG_UPDATE_SUCCESS_RESPONSE_SCHEMA,
    ...COMMON_ERROR_RESPONSES
  },
  security: DUAL_AUTH_SECURITY
} as const;

// Request interfaces for Fastify
export interface GetUserConfigurationByIdRequest {
  Params: TeamAndInstallationAndConfigParams;
}

export interface CreateUserConfigurationRequest {
  Params: TeamAndInstallationParams;
  Body: CreateUserConfigRequest;
}

export interface ListUserConfigurationsRequest {
  Params: TeamAndInstallationParams;
}

export interface UpdateUserConfigurationRequest {
  Params: TeamAndInstallationAndConfigParams;
  Body: UpdateUserConfigRequest;
}

export interface DeleteUserConfigurationRequest {
  Params: TeamAndInstallationAndConfigParams;
}

export interface UpdateUserArgsRouteRequest {
  Params: TeamAndInstallationAndConfigParams;
  Body: UpdateUserArgsRequest;
}

export interface UpdateUserEnvRouteRequest {
  Params: TeamAndInstallationAndConfigParams;
  Body: UpdateUserEnvRequest;
}

// Helper function to format user config response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatUserConfigResponse(config: any): UserConfigData {
  // Helper to safely handle JSON parsing - config might already be parsed by service layer
  const safeJsonParse = (value: any, defaultValue: any) => {
    if (value === null || value === undefined || value === '') {
      return defaultValue
    }
    // If it's already parsed (object/array), return as-is
    if (typeof value !== 'string') {
      return value
    }
    // If it's a string, try to parse it
    try {
      return JSON.parse(value)
    } catch {
      return defaultValue
    }
  }

  return {
    id: config.id,
    installation_id: config.installation_id,
    user_id: config.user_id,
    device_id: config.device_id || undefined,
    user_args: safeJsonParse(config.user_args, undefined),
    user_env: safeJsonParse(config.user_env, undefined),
    created_at: config.created_at.toISOString(),
    updated_at: config.updated_at.toISOString(),
    last_used_at: config.last_used_at ? config.last_used_at.toISOString() : undefined
  };
}
