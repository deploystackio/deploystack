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
    },
    user_display_settings: {
      type: 'object',
      description: 'User interface display settings',
      additionalProperties: true
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
    },
    allow_remote_mcp: {
      type: 'boolean',
      description: 'Whether remote MCP servers are allowed for this team'
    },
    allow_github_mcp: {
      type: 'boolean',
      description: 'Whether GitHub MCP deployments are allowed for this team'
    },
    allow_private_github_repos: {
      type: 'boolean',
      description: 'Whether private GitHub repositories are allowed for MCP deployments'
    }
  },
  required: ['id', 'name', 'slug', 'owner_id', 'is_default', 'role', 'is_owner', 'allow_remote_mcp', 'allow_github_mcp', 'allow_private_github_repos'],
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

// ===== PAGINATION SCHEMAS =====
export const PAGINATION_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    limit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum number of items to return (1-100, default: 20)'
    },
    offset: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Number of items to skip (≥0, default: 0)'
    }
  },
  additionalProperties: false
} as const;

const PAGINATION_SCHEMA = {
  type: 'object',
  properties: {
    total: {
      type: 'number',
      description: 'Total number of users'
    },
    limit: {
      type: 'number',
      description: 'Number of users per page'
    },
    offset: {
      type: 'number',
      description: 'Number of users skipped'
    },
    has_more: {
      type: 'boolean',
      description: 'Whether there are more users beyond this page'
    }
  },
  required: ['total', 'limit', 'offset', 'has_more']
} as const;

export const SEARCH_USERS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    // Search filters (all optional)
    username: {
      type: 'string',
      description: 'Filter by username (partial match, case-insensitive)'
    },
    email: {
      type: 'string',
      description: 'Filter by email (partial match, case-insensitive)'
    },
    auth_type: {
      type: 'string',
      enum: ['email', 'email_signup', 'github'],
      description: 'Filter by authentication type'
    },
    role_id: {
      type: 'string',
      description: 'Filter by role ID (exact match)'
    },
    // Pagination
    limit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum number of items to return (1-100, default: 20)'
    },
    offset: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Number of items to skip (≥0, default: 0)'
    }
  },
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

export const USERS_LIST_PAGINATED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: USER_SCHEMA,
          description: 'Array of users for current page'
        },
        pagination: PAGINATION_SCHEMA
      },
      required: ['users', 'pagination']
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

export interface CurrentUserProfile extends UserProfile {
  user_display_settings: Record<string, unknown>;
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
  allow_remote_mcp: boolean;
  allow_github_mcp: boolean;
  allow_private_github_repos: boolean;
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

export interface PaginationQuery {
  limit?: string;
  offset?: string;
}

export interface SearchUsersQuery extends PaginationQuery {
  username?: string;
  email?: string;
  auth_type?: 'email' | 'github';
  role_id?: string;
}

export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface UsersListResponse {
  success: boolean;
  data: User[];
}

export interface UsersListPaginatedResponse {
  success: boolean;
  data: {
    users: User[];
    pagination: PaginationMetadata;
  };
}

export interface UserTeamsResponse {
  success: boolean;
  teams: TeamItem[];
}

// Validation helper function
export function validatePaginationParams(query: PaginationQuery): { limit: number; offset: number } {
  const limit = query.limit ? parseInt(query.limit, 10) : 20;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  if (isNaN(offset) || offset < 0) {
    throw new Error('Offset must be non-negative');
  }

  return { limit, offset };
}
