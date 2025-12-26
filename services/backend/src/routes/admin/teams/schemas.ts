// Shared schemas for admin team management routes

export const UPDATE_TEAM_ADMIN_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Team name (1-100 characters)'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Team description (max 500 characters, optional)'
    },
    non_http_mcp_limit: {
      type: 'integer',
      minimum: 0,
      description: 'Maximum number of non-HTTP (stdio) MCP servers the team can install'
    },
    mcp_server_limit: {
      type: 'integer',
      minimum: 0,
      description: 'Maximum total number of MCP servers the team can install (all transport types)'
    },
    member_limit: {
      type: 'integer',
      minimum: 1,
      description: 'Maximum number of members allowed in this team'
    }
  },
  additionalProperties: false
} as const;

export const TEAM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Team unique identifier' },
    name: { type: 'string', description: 'Team name' },
    slug: { type: 'string', description: 'Team URL slug' },
    description: { type: 'string', nullable: true, description: 'Team description' },
    owner_id: { type: 'string', description: 'Team owner user ID' },
    is_default: { type: 'boolean', description: 'Whether this is the default team' },
    non_http_mcp_limit: { type: 'integer', description: 'Non-HTTP MCP server limit' },
    mcp_server_limit: { type: 'integer', description: 'Total MCP server limit' },
    member_limit: { type: 'integer', description: 'Team member limit' },
    created_at: { type: 'string', description: 'ISO8601 timestamp' },
    updated_at: { type: 'string', description: 'ISO8601 timestamp' }
  },
  required: ['id', 'name', 'slug', 'owner_id', 'is_default', 'non_http_mcp_limit', 'mcp_server_limit', 'member_limit', 'created_at', 'updated_at']
} as const;

export const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    message: { type: 'string', description: 'Success message' },
    data: TEAM_RESPONSE_SCHEMA
  },
  required: ['success', 'message', 'data']
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false, description: 'Indicates operation failure' },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error']
} as const;

export const LIST_TEAMS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    data: {
      type: 'array',
      items: TEAM_RESPONSE_SCHEMA
    }
  },
  required: ['success', 'data']
} as const;

// TypeScript interfaces
export interface UpdateTeamAdminRequest {
  name?: string;
  description?: string | null;
  non_http_mcp_limit?: number;
  mcp_server_limit?: number;
  member_limit?: number;
}

export interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  is_default: boolean;
  non_http_mcp_limit: number;
  mcp_server_limit: number;
  member_limit: number;
  created_at: string;
  updated_at: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
  data: TeamResponse;
}

export interface ListTeamsResponse {
  success: boolean;
  data: TeamResponse[];
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}
