// ===== COMMON RESPONSE SCHEMAS =====
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
    }
  },
  required: ['success', 'error']
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

// ===== COMMON PARAMETER SCHEMAS =====
export const PARAMS_WITH_ID_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      minLength: 1,
      description: 'User ID'
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

export const PARAMS_WITH_ROLE_ID_SCHEMA = {
  type: 'object',
  properties: {
    roleId: { 
      type: 'string', 
      description: 'Role ID to filter users by' 
    }
  },
  required: ['roleId'],
  additionalProperties: false
} as const;

// ===== CORE ENTITY SCHEMAS =====
export const USER_ROLE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Role ID' },
    name: { type: 'string', description: 'Role name' },
    permissions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of role permissions'
    }
  },
  required: ['id', 'name', 'permissions'],
  nullable: true,
  description: 'User role information'
} as const;

export const USER_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User ID' },
    username: { type: 'string', description: 'Username' },
    email: { type: 'string', format: 'email', description: 'User email address' },
    auth_type: { type: 'string', description: 'Authentication type (email, github)' },
    first_name: { type: ['string', 'null'], description: 'User first name' },
    last_name: { type: ['string', 'null'], description: 'User last name' },
    github_id: { type: ['string', 'null'], description: 'GitHub user ID' },
    role_id: { type: ['string', 'null'], description: 'User role ID' },
    role: USER_ROLE_SCHEMA
  },
  required: ['id', 'username', 'email', 'auth_type'],
  additionalProperties: false
} as const;

export const USER_PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string',
      description: 'User unique identifier'
    },
    username: { 
      type: 'string',
      description: 'Username'
    },
    email: { 
      type: 'string',
      description: 'User email address'
    },
    first_name: { 
      type: ['string', 'null'],
      description: 'User first name'
    },
    last_name: { 
      type: ['string', 'null'],
      description: 'User last name'
    },
    role_id: { 
      type: ['string', 'null'],
      description: 'User role identifier'
    },
    auth_type: { 
      type: ['string', 'null'],
      description: 'Authentication method used'
    },
    github_id: { 
      type: ['string', 'null'],
      description: 'GitHub user identifier if authenticated via GitHub'
    }
  },
  required: ['id', 'username', 'email'],
  additionalProperties: false
} as const;

export const TEAM_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Team unique identifier'
    },
    name: {
      type: 'string',
      description: 'Team name'
    },
    slug: {
      type: 'string',
      description: 'Team URL-friendly identifier'
    },
    description: {
      type: ['string', 'null'],
      description: 'Team description'
    },
    owner_id: {
      type: 'string',
      description: 'User ID of the team owner'
    },
    is_default: {
      type: 'boolean',
      description: 'Whether this is the default team'
    },
    created_at: {
      type: ['string', 'null'],
      description: 'Team creation timestamp (ISO 8601)'
    },
    updated_at: {
      type: ['string', 'null'],
      description: 'Team last update timestamp (ISO 8601)'
    },
    role: {
      type: 'string',
      description: 'User role within this team (team_admin or team_user)'
    },
    is_owner: {
      type: 'boolean',
      description: 'Whether the current user owns this team'
    }
  },
  required: ['id', 'name', 'slug', 'owner_id', 'is_default', 'role', 'is_owner'],
  additionalProperties: false
} as const;

// ===== REQUEST SCHEMAS =====
export const UPDATE_USER_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    username: { 
      type: 'string', 
      minLength: 1,
      description: 'Username for the user account'
    },
    email: { 
      type: 'string', 
      format: 'email',
      description: 'Valid email address'
    },
    first_name: { 
      type: 'string',
      description: 'User first name'
    },
    last_name: { 
      type: 'string',
      description: 'User last name'
    },
    role_id: { 
      type: 'string',
      description: 'Role ID to assign to the user (admin only)'
    }
  },
  additionalProperties: false,
  minProperties: 1
} as const;

export const ASSIGN_ROLE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    role_id: { 
      type: 'string', 
      minLength: 1,
      description: 'Role ID to assign to the user'
    }
  },
  required: ['role_id'],
  additionalProperties: false
} as const;

// ===== RESPONSE SCHEMAS =====
export const USERS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      type: 'array',
      items: USER_SCHEMA,
      description: 'Array of users'
    }
  },
  required: ['success', 'data']
} as const;

export const USER_TEAMS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    teams: { 
      type: 'array',
      items: TEAM_ITEM_SCHEMA,
      description: 'Array of teams the user belongs to'
    }
  },
  required: ['success', 'teams']
} as const;

// ===== TYPESCRIPT INTERFACES =====
export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface SuccessMessageResponse {
  success: boolean;
  message: string;
}

export interface ParamsWithId {
  id: string;
}

export interface ParamsWithRoleId {
  roleId: string;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  auth_type: string;
  first_name: string | null;
  last_name: string | null;
  github_id: string | null;
  role_id: string | null;
  role?: UserRole;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_id: string | null;
  auth_type: string | null;
  github_id: string | null;
}

export interface TeamItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
  role: string;
  is_owner: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
}

export interface AssignRoleRequest {
  role_id: string;
}

export interface UsersListResponse {
  success: boolean;
  data: User[];
}

export interface UserTeamsResponse {
  success: boolean;
  teams: TeamItem[];
}
