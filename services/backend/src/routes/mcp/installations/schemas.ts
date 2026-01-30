/**
 * Shared schemas for MCP Installations routes
 * 
 * This file contains all reusable JSON Schema constants and TypeScript interfaces
 * for the MCP installations module to eliminate duplication and ensure consistency.
 */

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

export const TEAM_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    teamId: { 
      type: 'string', 
      minLength: 1,
      description: 'Team ID is required'
    }
  },
  required: ['teamId'],
  additionalProperties: false
} as const;

export const INSTALLATION_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    installationId: { 
      type: 'string', 
      minLength: 1,
      description: 'Installation ID is required'
    }
  },
  required: ['installationId'],
  additionalProperties: false
} as const;

export const TEAM_AND_INSTALLATION_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: { 
      type: 'string', 
      minLength: 1,
      description: 'Team ID that owns the installation'
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

export const CLIENT_CONFIG_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID that owns the installation'
    },
    installationId: {
      type: 'string',
      minLength: 1,
      description: 'MCP installation ID'
    },
    clientType: {
      type: 'string',
      enum: ['claude-desktop', 'vscode', 'cursor'],
      description: 'Client type for configuration generation'
    }
  },
  required: ['teamId', 'installationId', 'clientType'],
  additionalProperties: false
} as const;

export const FLOW_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    teamId: {
      type: 'string',
      minLength: 1,
      description: 'Team ID'
    },
    flowId: {
      type: 'string',
      minLength: 1,
      description: 'OAuth flow ID'
    }
  },
  required: ['teamId', 'flowId'],
  additionalProperties: false
} as const;

// =============================================================================
// QUERY PARAMETER SCHEMAS
// =============================================================================

export const INSTALLATION_LIST_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    include_stats: {
      type: 'boolean',
      description: 'Include instance statistics aggregated by status (requires mcp.installations.stats.view permission)'
    }
  },
  additionalProperties: false
} as const;

// =============================================================================
// REQUEST BODY SCHEMAS
// =============================================================================

export const CREATE_INSTALLATION_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    server_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server ID to install'
    },
    installation_name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Custom name for this installation'
    },
    installation_type: {
      type: 'string',
      enum: ['global', 'team'],
      description: 'Installation type (defaults to global)'
    },
    satellite_id: {
      type: 'string',
      description: 'Satellite ID to install on (optional, auto-selected if not provided)'
    },
    team_args: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 500, // Security: limit argument length
        pattern: '^[a-zA-Z0-9@/_\\.\\-=:#]+$' // Security: restrict to safe characters
      },
      maxItems: 100, // Security: limit total arguments
      description: 'Team-level shared command line arguments'
    },
    team_env: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 32768 // 32KB max for env values
      },
      maxProperties: 100, // Security: limit total env vars
      propertyNames: {
        pattern: '^[A-Za-z_][A-Za-z0-9_]*$', // POSIX env var naming
        maxLength: 256
      },
      description: 'Team-level shared environment variables'
    },
    team_headers: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 8192 // 8KB max for header values
      },
      maxProperties: 50, // Security: limit total headers
      propertyNames: {
        pattern: '^[A-Za-z0-9\\-]+$', // HTTP token format
        maxLength: 256
      },
      description: 'Team-level shared headers'
    },
    team_url_query_params: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 2048 // 2KB max for query param values
      },
      maxProperties: 50, // Security: limit total query params
      propertyNames: {
        pattern: '^[A-Za-z0-9_\\-]+$',
        maxLength: 256
      },
      description: 'Team-level shared URL query parameters'
    },
    user_args: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 500
      },
      maxProperties: 50,
      description: 'User-level argument mappings (placeholder -> actual value)'
    },
    user_environment_variables: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 32768
      },
      maxProperties: 100,
      propertyNames: {
        pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
        maxLength: 256
      },
      description: 'User-level environment variables'
    },
    user_headers: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 8192
      },
      maxProperties: 50,
      propertyNames: {
        pattern: '^[A-Za-z0-9\\-]+$',
        maxLength: 256
      },
      description: 'User-level HTTP headers (optional)'
    },
    user_url_query_params: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 2048
      },
      maxProperties: 50,
      propertyNames: {
        pattern: '^[A-Za-z0-9_\\-]+$',
        maxLength: 256
      },
      description: 'User-level URL query parameters'
    }
  },
  required: ['server_id', 'installation_name'],
  additionalProperties: false
} as const;

export const UPDATE_INSTALLATION_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    installation_name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Updated installation name'
    },
    team_args: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 500,
        pattern: '^[a-zA-Z0-9@/_\\.\\-=:#]+$'
      },
      maxItems: 100,
      description: 'Updated team-level shared command line arguments'
    },
    team_env: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 32768
      },
      maxProperties: 100,
      propertyNames: {
        pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
        maxLength: 256
      },
      description: 'Updated team-level shared environment variables'
    }
  },
  additionalProperties: false
} as const;

export const UPDATE_ENVIRONMENT_VARS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    team_env: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 32768
      },
      maxProperties: 100,
      propertyNames: {
        pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
        maxLength: 256
      },
      description: 'Team-level environment variables to update'
    }
  },
  required: ['team_env'],
  additionalProperties: false
} as const;

export const UPDATE_ARGS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    args: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 500,
        pattern: '^[a-zA-Z0-9@/_\\.\\-=:#]+$'
      },
      maxItems: 100,
      description: 'Command line arguments to update'
    }
  },
  required: ['args'],
  additionalProperties: false
} as const;

export const UPDATE_HEADERS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    team_headers: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 8192
      },
      maxProperties: 50,
      propertyNames: {
        pattern: '^[A-Za-z0-9\\-]+$',
        maxLength: 256
      },
      description: 'Team-level headers to update'
    }
  },
  required: ['team_headers'],
  additionalProperties: false
} as const;

export const UPDATE_QUERY_PARAMS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    team_url_query_params: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 2048
      },
      maxProperties: 50,
      propertyNames: {
        pattern: '^[A-Za-z0-9_\\-]+$',
        maxLength: 256
      },
      description: 'Team-level URL query parameters to update'
    }
  },
  required: ['team_url_query_params'],
  additionalProperties: false
} as const;

export const OAUTH_AUTHORIZE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    server_id: {
      type: 'string',
      minLength: 1,
      description: 'MCP server ID that requires OAuth'
    },
    installation_name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Custom name for this installation (optional)'
    },
    installation_type: {
      type: 'string',
      enum: ['global', 'team'],
      description: 'Installation type - required for OAuth installations'
    },
    team_config: {
      type: 'object',
      additionalProperties: true,
      description: 'Team-level configuration for installation (optional)'
    }
  },
  required: ['server_id', 'installation_type'],
  additionalProperties: false
} as const;

export const OAUTH_CALLBACK_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Authorization code from OAuth provider'
    },
    state: {
      type: 'string',
      description: 'State parameter for CSRF protection'
    },
    error: {
      type: 'string',
      description: 'OAuth error code if authorization failed'
    },
    error_description: {
      type: 'string',
      description: 'Human-readable error description'
    }
  },
  additionalProperties: false
} as const;

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

export const SERVER_DETAILS_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      description: 'Server ID' 
    },
    name: { 
      type: 'string', 
      description: 'Server name' 
    },
    description: { 
      type: 'string', 
      description: 'Server description' 
    },
    repository_url: { 
      type: 'string', 
      nullable: true, 
      description: 'Repository URL' 
    },
    repository_source: { 
      type: 'string', 
      nullable: true, 
      description: 'Repository platform (github, gitlab, bitbucket)' 
    },
    repository_id: { 
      type: 'string', 
      nullable: true, 
      description: 'Platform-specific repository identifier' 
    },
    repository_subfolder: {
      type: 'string',
      nullable: true,
      description: 'Subfolder path for monorepos'
    },
    source: {
      type: 'string',
      enum: ['official_registry', 'manual', 'github'],
      description: 'Source of the MCP server'
    },
    git_branch: {
      type: 'string',
      nullable: true,
      description: 'Git branch for GitHub-deployed servers'
    },
    git_commit_sha: {
      type: 'string',
      nullable: true,
      description: 'Git commit SHA for GitHub-deployed servers'
    },
    slug: {
      type: 'string',
      description: 'Server slug for hierarchical router'
    },
    website_url: {
      type: 'string',
      nullable: true,
      description: 'Website URL'
    },
    icon_url: {
      type: 'string',
      nullable: true,
      description: 'Icon/logo URL'
    },
    author_name: {
      type: 'string',
      nullable: true,
      description: 'Author name'
    },
    github_stars: { 
      type: 'number', 
      nullable: true,
      description: 'Number of GitHub stars'
    },
    language: { 
      type: 'string', 
      description: 'Programming language' 
    },
    runtime: { 
      type: 'string', 
      description: 'Runtime environment' 
    },
    status: { 
      type: 'string', 
      enum: ['active', 'deprecated', 'maintenance'],
      description: 'Server status'
    },
    tags: { 
      type: 'array', 
      items: { type: 'string' }, 
      nullable: true,
      description: 'Server tags'
    },
    environment_variables: { 
      type: 'array', 
      items: {},
      nullable: true,
      description: 'Server environment variables'
    },
    args: {
      type: 'array',
      items: {},
      nullable: true,
      description: 'Server command line arguments'
    },
    packages: { 
      type: 'array', 
      items: {},
      description: 'MCP Registry packages array'
    },
    remotes: { 
      type: 'array', 
      items: {},
      nullable: true,
      description: 'MCP Registry remotes array for HTTP/SSE'
    },
    category_id: { 
      type: 'string', 
      nullable: true,
      description: 'Category ID'
    },
    transport_type: {
      type: 'string',
      enum: ['stdio', 'http', 'sse'],
      description: 'MCP transport type'
    }
  }
} as const;

export const INSTANCE_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique instance ID'
    },
    user_id: {
      type: 'string',
      description: 'User ID who owns this instance'
    },
    user_slug: {
      type: 'string',
      description: 'User slug (username) for display'
    },
    user_email: {
      type: 'string',
      format: 'email',
      description: 'User email address'
    },
    status: {
      type: 'string',
      description: 'Current instance status'
    },
    status_message: {
      type: 'string',
      nullable: true,
      description: 'Optional status message'
    },
    status_updated_at: {
      type: 'string',
      format: 'date-time',
      description: 'When status was last updated'
    },
    last_health_check_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Last health check timestamp'
    },
    created_at: {
      type: 'string',
      format: 'date-time',
      description: 'Instance creation timestamp'
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp'
    }
  },
  required: ['id', 'user_id', 'user_slug', 'user_email', 'status', 'status_updated_at']
} as const;

export const STATUS_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    total_instances: {
      type: 'number',
      description: 'Total number of instances across all team members'
    },
    online: {
      type: 'number',
      description: 'Number of instances with status "online"'
    },
    offline: {
      type: 'number',
      description: 'Number of instances with status "offline"'
    },
    error: {
      type: 'number',
      description: 'Number of instances with error statuses (error, permanently_failed, requires_reauth)'
    },
    provisioning: {
      type: 'number',
      description: 'Number of instances in provisioning states (provisioning, connecting, discovering_tools, syncing_tools, restarting, command_received, awaiting_user_config)'
    }
  },
  required: ['total_instances', 'online', 'offline', 'error', 'provisioning']
} as const;

export const INSTALLATION_ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique installation ID'
    },
    team_id: {
      type: 'string',
      description: 'Team ID that owns this installation'
    },
    team_slug: {
      type: 'string',
      description: 'Team slug for hierarchical router path'
    },
    server_id: {
      type: 'string',
      description: 'MCP server ID that was installed'
    },
    created_by: {
      type: 'string',
      description: 'User ID who created this installation'
    },
    installation_name: {
      type: 'string',
      description: 'Custom name for this installation'
    },
    installation_type: {
      type: 'string',
      enum: ['global', 'team'],
      description: 'Installation type'
    },
    team_args: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Team-level shared command line arguments'
    },
    team_env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      nullable: true,
      description: 'Team-level shared environment variables'
    },
    team_headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      nullable: true,
      description: 'Team-level shared headers'
    },
    created_at: {
      type: 'string',
      format: 'date-time',
      description: 'Installation creation timestamp'
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp'
    },
    last_used_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Last usage timestamp'
    },
    server: {
      ...SERVER_DETAILS_SCHEMA,
      description: 'Optional server details if included'
    },
    instances: {
      type: 'array',
      items: INSTANCE_SCHEMA,
      description: 'Per-user instances (optional)'
    },
    status_summary: {
      ...STATUS_SUMMARY_SCHEMA,
      description: 'Aggregated instance statistics by status (optional, requires mcp.installations.stats.view permission)'
    }
  },
  required: ['id', 'team_id', 'server_id', 'created_by', 'installation_name', 'installation_type', 'created_at', 'updated_at', 'last_used_at']
} as const;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

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

export const INSTALLATION_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: INSTALLATION_ENTITY_SCHEMA
  },
  required: ['success', 'data']
} as const;

export const INSTALLATION_LIST_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      default: true,
      description: 'Indicates successful operation'
    },
    data: { 
      type: 'array',
      items: INSTALLATION_ENTITY_SCHEMA,
      description: 'Array of MCP installations for the team'
    }
  },
  required: ['success', 'data']
} as const;

export const INSTALLATION_UPDATE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: INSTALLATION_ENTITY_SCHEMA,
    message: { 
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'data', 'message']
} as const;

export const INSTALLATION_DELETE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the installation was deleted successfully'
    },
    data: {
      type: 'object',
      properties: {
        id: { 
          type: 'string',
          description: 'ID of the deleted installation'
        },
        deleted: { 
          type: 'boolean',
          description: 'Confirmation that the installation was deleted'
        }
      },
      required: ['id', 'deleted']
    }
  },
  required: ['success', 'data']
} as const;

export const CLIENT_CONFIG_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the configuration was generated successfully'
    },
    data: {
      type: 'object',
      description: 'Client-specific configuration object (varies by client type)'
    }
  },
  required: ['success', 'data']
} as const;

export const OAUTH_AUTHORIZE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    flow_id: {
      type: 'string',
      description: 'Unique flow ID for the pending OAuth flow'
    },
    authorization_url: {
      type: 'string',
      format: 'uri',
      description: 'OAuth authorization URL to redirect user to for authentication'
    },
    requires_authorization: {
      type: 'boolean',
      description: 'Indicates that OAuth authorization is required (always true for this endpoint)'
    },
    expires_at: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp when the OAuth state expires'
    }
  },
  required: ['flow_id', 'authorization_url', 'requires_authorization', 'expires_at']
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface TeamIdParams {
  teamId: string;
}

export interface InstallationIdParams {
  installationId: string;
}

export interface TeamAndInstallationParams {
  teamId: string;
  installationId: string;
}

export interface ClientConfigParams {
  teamId: string;
  installationId: string;
  clientType: 'claude-desktop' | 'vscode' | 'cursor';
}

export interface FlowIdParams {
  teamId: string;
  flowId: string;
}

export interface CreateInstallationRequest {
  server_id: string;
  installation_name: string;
  installation_type?: 'global' | 'team';
  satellite_id?: string;
  team_args?: string[];
  team_env?: Record<string, string>;
  team_headers?: Record<string, string>;
  team_url_query_params?: Record<string, string>;
  user_args?: Record<string, string>;
  user_environment_variables?: Record<string, string>;
  user_headers?: Record<string, string>;
  user_url_query_params?: Record<string, string>;
}

export interface UpdateInstallationRequest {
  installation_name?: string;
  team_args?: string[];
  team_env?: Record<string, string>;
}

export interface UpdateEnvironmentVariablesRequest {
  team_env: Record<string, string>;
}

export interface UpdateArgsRequest {
  args: string[];
}

export interface UpdateHeadersRequest {
  team_headers: Record<string, string>;
}

export interface UpdateQueryParamsRequest {
  team_url_query_params: Record<string, string>;
}

export interface ServerDetails {
  id: string;
  name: string;
  description: string;
  repository_url: string | null;
  repository_source: string | null;
  repository_id: string | null;
  repository_subfolder: string | null;
  source: 'official_registry' | 'manual' | 'github';
  git_branch: string | null;
  git_commit_sha: string | null;
  slug: string;
  website_url: string | null;
  icon_url: string | null;
  author_name: string | null;
  github_stars: number | null;
  language: string;
  runtime: string;
  status: 'active' | 'deprecated' | 'maintenance' | 'disabled';
  tags: string[] | null;
  environment_variables: any[] | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  args: any[] | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  packages: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  remotes: any[] | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  category_id: string | null;
  transport_type: 'stdio' | 'http' | 'sse';
}

export interface InstanceData {
  id: string;
  user_id: string;
  user_slug: string;
  user_email: string;
  status: string;
  status_message: string | null;
  status_updated_at: Date | null;
  last_health_check_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface InstanceResponse {
  id: string;
  user_id: string;
  user_slug: string;
  user_email: string;
  status: string;
  status_message: string | null;
  status_updated_at: string;
  last_health_check_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusSummary {
  total_instances: number;
  online: number;
  offline: number;
  error: number;
  provisioning: number;
}

export interface InstallationData {
  id: string;
  team_id: string;
  team_slug: string;
  server_id: string;
  created_by: string;
  installation_name: string;
  installation_type: 'global' | 'team';
  team_args?: string[] | null;
  team_env?: Record<string, string> | null;
  team_headers?: Record<string, string> | null;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
  server?: ServerDetails;
  instances?: InstanceData[];
}

export interface InstallationResponse {
  id: string;
  team_id: string;
  team_slug: string;
  server_id: string;
  created_by: string;
  installation_name: string;
  installation_type: 'global' | 'team';
  team_args?: string[] | null;
  team_env?: Record<string, string> | null;
  team_headers?: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  server?: ServerDetails;
  instances?: InstanceResponse[];
}

// Raw installation data from database (before formatting)
export interface RawInstallationListItem {
  id: string;
  installation_name: string;
  installation_type: 'global' | 'team';
  team_id: string;
  created_at: Date;
  last_used_at: Date | null;
  status?: string;
  status_message?: string | null;
  status_updated_at?: Date | null;
  last_health_check_at?: Date | null;
  server?: {
    id: string;
    icon_url: string | null;
    category_id: string | null;
    runtime: string;
  };
  status_summary?: StatusSummary;
}

// Minimal response interface for list views (optimized)
export interface InstallationListItemResponse {
  id: string;
  installation_name: string;
  installation_type: 'global' | 'team';
  team_id: string;
  created_at: string;
  last_used_at: string | null;
  status?: string;
  status_message?: string | null;
  status_updated_at?: string;
  last_health_check_at?: string | null;
  server?: {
    id: string;
    icon_url: string | null;
    category_id: string | null;
    runtime: string;
  };
  status_summary?: StatusSummary;
}

export interface InstallationSuccessResponse {
  success: boolean;
  data: InstallationResponse;
}

export interface InstallationListSuccessResponse {
  success: boolean;
  data: InstallationListItemResponse[];
}

export interface InstallationUpdateSuccessResponse {
  success: boolean;
  data: InstallationResponse;
  message: string;
}

export interface InstallationDeleteSuccessResponse {
  success: boolean;
  data: {
    id: string;
    deleted: boolean;
  };
}

export interface ClientConfigSuccessResponse {
  success: boolean;
  data: object;
}

export interface OAuthAuthorizeRequest {
  server_id: string;
  installation_name?: string;
  installation_type: 'global' | 'team';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  team_config?: Record<string, any>;
}

export interface OAuthAuthorizeSuccessResponse {
  flow_id: string;
  authorization_url: string;
  requires_authorization: boolean;
  expires_at: string;
}

export interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

// =============================================================================
// COMMON RESPONSE DEFINITIONS FOR OPENAPI
// =============================================================================

export const COMMON_ERROR_RESPONSES = {
  400: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Bad Request - Invalid input or validation error'
  },
  401: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Unauthorized - Authentication required or invalid token'
  },
  403: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Forbidden - Insufficient permissions or scope'
  },
  404: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Not Found - Resource not found'
  },
  500: {
    ...ERROR_RESPONSE_SCHEMA,
    description: 'Internal Server Error'
  }
} as const;

export const DUAL_AUTH_SECURITY = [
  { cookieAuth: [] },
  { bearerAuth: [] }
] as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Converts InstallationData (with Date objects) to InstallationResponse (with ISO strings)
 */
export function formatInstallationResponse(installation: InstallationData): InstallationResponse {
  // Destructure to remove instances if present
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { instances: _instances, created_at, updated_at, last_used_at, ...rest } = installation;

  return {
    ...rest,
    created_at: created_at.toISOString(),
    updated_at: updated_at.toISOString(),
    last_used_at: last_used_at?.toISOString() || null
  };
}

/**
 * Converts array of minimal installation data to array of InstallationListItemResponse
 * Optimized for list views - returns only essential fields including status
 */
export function formatInstallationListResponse(installations: RawInstallationListItem[]): InstallationListItemResponse[] {
  return installations.map(installation => ({
    id: installation.id,
    installation_name: installation.installation_name,
    installation_type: installation.installation_type,
    team_id: installation.team_id,
    created_at: installation.created_at.toISOString(),
    last_used_at: installation.last_used_at?.toISOString() || null,
    status: installation.status,
    status_message: installation.status_message,
    status_updated_at: installation.status_updated_at?.toISOString(),
    last_health_check_at: installation.last_health_check_at?.toISOString() || null,
    server: installation.server,
    status_summary: installation.status_summary
  }));
}

/**
 * Converts array of InstanceData (with Date objects) to array of InstanceResponse (with ISO strings)
 */
export function formatInstancesResponse(instances: InstanceData[]): InstanceResponse[] {
  return instances.map(inst => ({
    id: inst.id,
    user_id: inst.user_id,
    user_slug: inst.user_slug,
    user_email: inst.user_email,
    status: inst.status,
    status_message: inst.status_message,
    status_updated_at: inst.status_updated_at?.toISOString() || new Date().toISOString(),
    last_health_check_at: inst.last_health_check_at?.toISOString() || null,
    created_at: inst.created_at.toISOString(),
    updated_at: inst.updated_at.toISOString()
  }));
}
