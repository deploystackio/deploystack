// Team creation schema constants
export const CREATE_TEAM_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Team name'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Team description'
    }
  },
  required: ['name'],
  additionalProperties: false
} as const;

// Team update schema constants
export const UPDATE_TEAM_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Team name'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Team description'
    }
  },
  additionalProperties: false
} as const;

// Team response schema constants
export const TEAM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Team ID' },
    name: { type: 'string', description: 'Team name' },
    slug: { type: 'string', description: 'Team slug' },
    description: { type: 'string', nullable: true, description: 'Team description' },
    owner_id: { type: 'string', description: 'Team owner ID' },
    is_default: { type: 'boolean', description: 'Indicates if this is the user\'s default team' },
    created_at: { type: 'string', format: 'date-time', description: 'Team creation date' },
    updated_at: { type: 'string', format: 'date-time', description: 'Team last update date' }
  },
  required: ['id', 'name', 'slug', 'owner_id', 'is_default', 'created_at', 'updated_at']
} as const;

// Team with membership info schema constants
export const TEAM_WITH_MEMBERSHIP_SCHEMA = {
  type: 'object',
  properties: {
    ...TEAM_SCHEMA.properties,
    role: {
      type: 'string',
      enum: ['team_admin', 'team_user'],
      description: 'User role in the team'
    }
  },
  required: [...TEAM_SCHEMA.required, 'role']
} as const;

// Enhanced team with role info schema constants
export const TEAM_WITH_ROLE_INFO_SCHEMA = {
  type: 'object',
  properties: {
    ...TEAM_SCHEMA.properties,
    role: {
      type: 'string',
      enum: ['team_admin', 'team_user'],
      description: 'User role in the team'
    },
    is_admin: { type: 'boolean', description: 'True if user is team admin' },
    is_owner: { type: 'boolean', description: 'True if user is team owner' },
    member_count: { type: 'number', description: 'Total number of team members' }
  },
  required: [...TEAM_SCHEMA.required, 'role', 'is_admin', 'is_owner', 'member_count']
} as const;

// Team member schema constants
export const TEAM_MEMBER_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Membership ID' },
    user_id: { type: 'string', description: 'User ID' },
    username: { type: 'string', description: 'Username' },
    email: { type: 'string', description: 'User email' },
    first_name: { type: 'string', nullable: true, description: 'User first name' },
    last_name: { type: 'string', nullable: true, description: 'User last name' },
    role: {
      type: 'string',
      enum: ['team_admin', 'team_user'],
      description: 'User role in the team'
    },
    is_admin: { type: 'boolean', description: 'True if user is team admin' },
    is_owner: { type: 'boolean', description: 'True if user is team owner' },
    joined_at: { type: 'string', format: 'date-time', description: 'Date when user joined the team' }
  },
  required: ['id', 'user_id', 'username', 'email', 'role', 'is_admin', 'is_owner', 'joined_at']
} as const;

// Request schemas for team member management
export const ADD_TEAM_MEMBER_SCHEMA = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'Email address of user to add to team'
    },
    role: {
      type: 'string',
      enum: ['team_admin', 'team_user'],
      description: 'Role to assign to the user'
    }
  },
  required: ['email', 'role'],
  additionalProperties: false
} as const;

export const UPDATE_MEMBER_ROLE_SCHEMA = {
  type: 'object',
  properties: {
    role: {
      type: 'string',
      enum: ['team_admin', 'team_user'],
      description: 'New role for the user'
    }
  },
  required: ['role'],
  additionalProperties: false
} as const;

export const TRANSFER_OWNERSHIP_SCHEMA = {
  type: 'object',
  properties: {
    newOwnerId: {
      type: 'string',
      minLength: 1,
      description: 'ID of user to transfer ownership to'
    }
  },
  required: ['newOwnerId'],
  additionalProperties: false
} as const;

// Success response schema constants
export const TEAM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: TEAM_SCHEMA,
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'data']
} as const;

export const TEAMS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'array',
      items: TEAM_WITH_MEMBERSHIP_SCHEMA,
      description: 'Array of teams with user roles'
    }
  },
  required: ['success', 'data']
} as const;

export const TEAMS_LIST_WITH_ROLE_INFO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'array',
      items: TEAM_WITH_ROLE_INFO_SCHEMA,
      description: 'Array of teams with enhanced role information'
    }
  },
  required: ['success', 'data']
} as const;

export const TEAM_MEMBERS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'array',
      items: TEAM_MEMBER_SCHEMA,
      description: 'Array of team members with user information'
    }
  },
  required: ['success', 'data']
} as const;

export const TEAM_MEMBER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: TEAM_MEMBER_SCHEMA,
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'data']
} as const;

export const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'message']
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates if the operation was successful (false for errors)'
    },
    error: { type: 'string', description: 'Error message' },
    details: {
      type: 'array',
      items: {},
      description: 'Additional error details (validation errors)'
    }
  },
  required: ['success', 'error']
} as const;

// Additional schema constants for specific endpoints
export const TEAM_ID_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

export const CREATE_TEAM_REQUEST_SCHEMA = CREATE_TEAM_SCHEMA;

export const UPDATE_TEAM_REQUEST_SCHEMA = UPDATE_TEAM_SCHEMA;

export const TEAM_PARAMS_SCHEMA = TEAM_ID_PARAMS_SCHEMA;

export const DELETE_SUCCESS_RESPONSE_SCHEMA = SUCCESS_RESPONSE_SCHEMA;

export const TEAM_SUCCESS_RESPONSE_SCHEMA = TEAM_RESPONSE_SCHEMA;

export const TEAMS_LIST_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'array',
      items: TEAM_WITH_ROLE_INFO_SCHEMA,
      description: 'Array of teams with enhanced role information'
    }
  },
  required: ['success', 'data']
} as const;

export const TEAM_WITH_ROLE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: TEAM_WITH_ROLE_INFO_SCHEMA,
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'data']
} as const;

// TypeScript interfaces for type safety
export interface CreateTeamInput {
  name: string;
  description?: string;
}

// Additional interfaces expected by existing files
export interface CreateTeamRequest extends CreateTeamInput {}

export interface UpdateTeamRequest extends UpdateTeamInput {}

export interface TeamIdParams {
  id: string;
}

export interface TeamParams extends TeamIdParams {}

export interface DeleteSuccessResponse {
  success: boolean;
  message: string;
}

export interface TeamData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamSuccessResponse {
  success: boolean;
  data: TeamData;
  message?: string;
}

export interface TeamsListSuccessResponse {
  success: boolean;
  data: TeamWithRoleInfo[];
}

export interface TeamWithRoleSuccessResponse {
  success: boolean;
  data: TeamWithRoleInfo;
  message?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string | null;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamWithMembership extends Team {
  role: 'team_admin' | 'team_user';
}

export interface TeamWithRoleInfo extends Team {
  role: 'team_admin' | 'team_user';
  is_admin: boolean;
  is_owner: boolean;
  member_count: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'team_admin' | 'team_user';
  is_admin: boolean;
  is_owner: boolean;
  joined_at: Date;
}

export interface AddTeamMemberInput {
  email: string;
  role: 'team_admin' | 'team_user';
}

export interface UpdateMemberRoleInput {
  role: 'team_admin' | 'team_user';
}

export interface TransferOwnershipInput {
  newOwnerId: string;
}

export interface TeamResponse {
  success: boolean;
  data: Team;
  message?: string;
}

export interface TeamsListResponse {
  success: boolean;
  data: TeamWithMembership[];
}

export interface TeamsListWithRoleInfoResponse {
  success: boolean;
  data: TeamWithRoleInfo[];
}

export interface TeamMembersListResponse {
  success: boolean;
  data: TeamMember[];
}

export interface TeamMemberResponse {
  success: boolean;
  data: TeamMember;
  message?: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  details?: any[];
}
