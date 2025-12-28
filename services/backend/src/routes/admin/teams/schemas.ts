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
    },
    allow_remote_mcp: {
      type: 'boolean',
      description: 'Allow team to install MCP servers from remote sources not in the catalog'
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
    allow_remote_mcp: { type: 'boolean', description: 'Allow remote MCP servers' },
    created_at: { type: 'string', description: 'ISO8601 timestamp' },
    updated_at: { type: 'string', description: 'ISO8601 timestamp' }
  },
  required: ['id', 'name', 'slug', 'owner_id', 'is_default', 'non_http_mcp_limit', 'mcp_server_limit', 'member_limit', 'allow_remote_mcp', 'created_at', 'updated_at']
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

export const SEARCH_TEAMS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    // Search filter
    name: {
      type: 'string',
      description: 'Filter by team name (partial match, case-insensitive)'
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

const PAGINATION_SCHEMA = {
  type: 'object',
  properties: {
    total: { type: 'number', description: 'Total number of teams' },
    limit: { type: 'number', description: 'Number of teams per page' },
    offset: { type: 'number', description: 'Number of teams skipped' },
    has_more: { type: 'boolean', description: 'Whether there are more teams beyond this page' }
  },
  required: ['total', 'limit', 'offset', 'has_more']
} as const;

export const LIST_TEAMS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    data: {
      type: 'object',
      properties: {
        teams: {
          type: 'array',
          items: TEAM_RESPONSE_SCHEMA
        },
        pagination: PAGINATION_SCHEMA
      },
      required: ['teams', 'pagination']
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
  allow_remote_mcp?: boolean;
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
  allow_remote_mcp: boolean;
  created_at: string;
  updated_at: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
  data: TeamResponse;
}

export interface PaginationQuery {
  limit?: string;
  offset?: string;
}

export interface SearchTeamsQuery {
  name?: string;
  limit?: string;
  offset?: string;
}

export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ListTeamsResponse {
  success: boolean;
  data: {
    teams: TeamResponse[];
    pagination: PaginationMetadata;
  };
}

export interface ErrorResponse {
  success: boolean;
  error: string;
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

// ===== MCP INSTALLATIONS SCHEMAS =====
export const MCP_INSTALLATION_SCHEMA = {
  type: 'object',
  properties: {
    installation_id: { type: 'string', description: 'Installation unique identifier' },
    server_id: { type: 'string', description: 'MCP server unique identifier' },
    installation_name: { type: 'string', description: 'User-defined installation name' },
    server_name: { type: 'string', description: 'MCP server name' },
    server_slug: { type: 'string', description: 'MCP server slug' },
    status: { type: 'string', description: 'Installation status (provisioning|online|offline|error|...)' },
    created_at: { type: 'string', description: 'ISO8601 timestamp' },
    last_used_at: { type: 'string', nullable: true, description: 'ISO8601 timestamp or null' }
  },
  required: ['installation_id', 'server_id', 'installation_name', 'server_name', 'server_slug', 'status', 'created_at']
} as const;

export const MCP_INSTALLATIONS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    data: {
      type: 'object',
      properties: {
        installations: {
          type: 'array',
          items: MCP_INSTALLATION_SCHEMA
        },
        pagination: PAGINATION_SCHEMA
      },
      required: ['installations', 'pagination']
    }
  },
  required: ['success', 'data']
} as const;

// TypeScript interfaces for MCP installations
export interface McpInstallation {
  installation_id: string;
  server_id: string;
  installation_name: string;
  server_name: string;
  server_slug: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
}

export interface McpInstallationsResponse {
  success: boolean;
  data: {
    installations: McpInstallation[];
    pagination: PaginationMetadata;
  };
}
