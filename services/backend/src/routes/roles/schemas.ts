import { AVAILABLE_PERMISSIONS } from '../../permissions';

// ✅ CORE ROLE SCHEMA (used by multiple endpoints)
export const ROLE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique role identifier' },
    name: { type: 'string', description: 'Role name' },
    description: { type: ['string', 'null'], description: 'Role description' },
    permissions: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Array of permissions assigned to this role'
    },
    is_system_role: { type: 'boolean', description: 'Whether this is a system-defined role' },
    created_at: { type: 'string', description: 'Role creation timestamp' },
    updated_at: { type: 'string', description: 'Role last update timestamp' }
  },
  required: ['id', 'name', 'permissions', 'is_system_role', 'created_at', 'updated_at']
} as const;

// ✅ REQUEST SCHEMAS
export const CREATE_ROLE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      minLength: 1,
      description: 'Unique role identifier'
    },
    name: { 
      type: 'string', 
      minLength: 1,
      description: 'Human-readable role name'
    },
    description: { 
      type: 'string',
      description: 'Optional role description'
    },
    permissions: { 
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'Array of permission strings'
    }
  },
  required: ['id', 'name', 'permissions'],
  additionalProperties: false
} as const;

export const UPDATE_ROLE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    name: { 
      type: 'string', 
      minLength: 1,
      description: 'Human-readable role name'
    },
    description: { 
      type: 'string',
      description: 'Optional role description'
    },
    permissions: { 
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'Array of permission strings'
    }
  },
  additionalProperties: false
} as const;

export const ROLE_ID_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string',
      minLength: 1,
      description: 'Role ID'
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

// ✅ RESPONSE SCHEMAS
export const ROLE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: ROLE_SCHEMA,
    message: { 
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'data']
} as const;

export const ROLES_LIST_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      type: 'array',
      items: ROLE_SCHEMA,
      description: 'Array of roles'
    }
  },
  required: ['success', 'data']
} as const;

export const PERMISSIONS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      type: 'object',
      properties: {
        permissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of available permissions'
        },
        default_roles: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: { type: 'string' }
          },
          description: 'Default role permissions mapping'
        }
      },
      required: ['permissions', 'default_roles'],
      description: 'Permissions and default roles data'
    }
  },
  required: ['success', 'data']
} as const;

export const SUCCESS_MESSAGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    message: { 
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'message']
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean', 
      default: false,
      description: 'Indicates the operation failed'
    },
    error: { 
      type: 'string',
      description: 'Error message describing what went wrong'
    },
    details: {
      type: 'object',
      description: 'Additional error details (validation errors, invalid permissions)',
      additionalProperties: true
    }
  },
  required: ['success', 'error']
} as const;

// ✅ TYPESCRIPT INTERFACES
export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleRequest {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface RoleParams {
  id: string;
}

export interface RoleSuccessResponse {
  success: boolean;
  data: Role;
  message?: string;
}

export interface RolesListSuccessResponse {
  success: boolean;
  data: Role[];
}

export interface PermissionsSuccessResponse {
  success: boolean;
  data: {
    permissions: string[];
    default_roles: Record<string, string[]>;
  };
}

export interface SuccessMessageResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  details?: Record<string, unknown>;
}

// ✅ RE-EXPORT PERMISSIONS (keep this useful part)
export { AVAILABLE_PERMISSIONS } from '../../permissions';
export type Permission = typeof AVAILABLE_PERMISSIONS[number];
