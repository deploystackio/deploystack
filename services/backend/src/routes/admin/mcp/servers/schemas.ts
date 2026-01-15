// Shared schemas for admin MCP server routes

// Reusable schema constants
const INSTALLATION_DETAIL_SCHEMA = {
  type: 'object',
  properties: {
    installation_id: { type: 'string', description: 'Installation unique identifier' },
    installation_name: { type: 'string', description: 'Installation name' },
    created_at: { type: 'string', description: 'ISO8601 timestamp' },
    last_used_at: { type: 'string', nullable: true, description: 'ISO8601 timestamp or null' }
  },
  required: ['installation_id', 'installation_name', 'created_at']
} as const;

const STATUS_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    total_instances: { type: 'integer', description: 'Total number of user instances' },
    online: { type: 'integer', description: 'Number of instances with online status' },
    offline: { type: 'integer', description: 'Number of instances with offline status' },
    error: { type: 'integer', description: 'Number of instances with error or permanently_failed status' },
    provisioning: { type: 'integer', description: 'Number of instances in provisioning states' }
  },
  required: ['total_instances', 'online', 'offline', 'error', 'provisioning']
} as const;

export const TEAM_WITH_INSTALLATION_SCHEMA = {
  type: 'object',
  properties: {
    team_id: { type: 'string', description: 'Team unique identifier' },
    team_name: { type: 'string', description: 'Team name' },
    team_slug: { type: 'string', description: 'Team URL slug' },
    installations: {
      type: 'array',
      items: INSTALLATION_DETAIL_SCHEMA,
      description: 'All installations of this server by the team'
    },
    installation_count: { type: 'integer', description: 'Number of installations of this server' },
    status_summary: STATUS_SUMMARY_SCHEMA
  },
  required: ['team_id', 'team_name', 'team_slug', 'installations', 'installation_count', 'status_summary']
} as const;

const SERVER_INFO_SCHEMA = {
  type: 'object',
  properties: {
    server_id: { type: 'string', description: 'MCP server unique identifier' },
    server_name: { type: 'string', description: 'MCP server name' },
    server_slug: { type: 'string', description: 'MCP server slug' }
  },
  required: ['server_id', 'server_name', 'server_slug']
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

export const TEAMS_BY_SERVER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    data: {
      type: 'object',
      properties: {
        server_info: SERVER_INFO_SCHEMA,
        teams: {
          type: 'array',
          items: TEAM_WITH_INSTALLATION_SCHEMA
        },
        pagination: PAGINATION_SCHEMA
      },
      required: ['server_info', 'teams', 'pagination']
    }
  },
  required: ['success', 'data']
} as const;

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

export const SEARCH_TEAMS_BY_SERVER_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Filter by team name or slug (partial match, case-insensitive)'
    },
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

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false, description: 'Indicates operation failure' },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
export interface PaginationQuery {
  limit?: string;
  offset?: string;
}

export interface SearchTeamsByServerQuery {
  name?: string;
  limit?: string;
  offset?: string;
}

export interface StatusSummary {
  total_instances: number;
  online: number;
  offline: number;
  error: number;
  provisioning: number;
}

export interface InstallationDetail {
  installation_id: string;
  installation_name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface TeamWithInstallations {
  team_id: string;
  team_name: string;
  team_slug: string;
  installations: InstallationDetail[];
  installation_count: number;
  status_summary: StatusSummary;
}

export interface TeamsByServerResponse {
  success: boolean;
  data: {
    server_info: {
      server_id: string;
      server_name: string;
      server_slug: string;
    };
    teams: TeamWithInstallations[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
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
