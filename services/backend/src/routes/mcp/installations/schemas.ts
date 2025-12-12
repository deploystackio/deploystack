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
    team_args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Team-level shared command line arguments'
    },
    team_env: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Team-level shared environment variables'
    },
    team_headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Team-level shared headers'
    },
    team_url_query_params: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Team-level shared URL query parameters'
    },
    user_args: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-level argument mappings (placeholder -> actual value)'
    },
    user_environment_variables: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-level environment variables'
    },
    user_headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'User-level HTTP headers (optional)'
    },
    user_url_query_params: {
      type: 'object',
      additionalProperties: { type: 'string' },
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
      description: 'Updated installation name'
    },
    team_args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Updated team-level shared command line arguments'
    },
    team_env: {
      type: 'object',
      additionalProperties: { type: 'string' },
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
      additionalProperties: { type: 'string' },
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
      items: { type: 'string' },
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
      additionalProperties: { type: 'string' },
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
      additionalProperties: { type: 'string' },
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

export interface InstallationData {
  id: string;
  team_id: string;
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
}

export interface InstallationResponse {
  id: string;
  team_id: string;
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
}

export interface InstallationSuccessResponse {
  success: boolean;
  data: InstallationResponse;
}

export interface InstallationListSuccessResponse {
  success: boolean;
  data: InstallationResponse[];
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
  return {
    ...installation,
    created_at: installation.created_at.toISOString(),
    updated_at: installation.updated_at.toISOString(),
    last_used_at: installation.last_used_at?.toISOString() || null
  };
}

/**
 * Converts array of InstallationData to array of InstallationResponse
 */
export function formatInstallationListResponse(installations: InstallationData[]): InstallationResponse[] {
  return installations.map(formatInstallationResponse);
}
