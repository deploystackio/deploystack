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
      enum: ['local', 'cloud'],
      description: 'Installation type (defaults to local)'
    },
    user_environment_variables: { 
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Custom environment variables for this installation'
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
    user_environment_variables: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Updated environment variables'
    }
  },
  additionalProperties: false
} as const;

export const UPDATE_ENVIRONMENT_VARS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    environment_variables: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Environment variables to update'
    }
  },
  required: ['environment_variables'],
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
    github_url: { 
      type: 'string', 
      nullable: true, 
      description: 'GitHub repository URL' 
    },
    homepage_url: { 
      type: 'string', 
      nullable: true, 
      description: 'Homepage URL' 
    },
    author_name: { 
      type: 'string', 
      nullable: true, 
      description: 'Author name' 
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
    installation_methods: { 
      type: 'array', 
      items: {},
      description: 'Installation methods'
    },
    category_id: { 
      type: 'string', 
      nullable: true,
      description: 'Category ID'
    },
    default_config: {
      nullable: true,
      description: 'Default configuration'
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
    user_id: { 
      type: 'string',
      description: 'User ID who created this installation'
    },
    installation_name: { 
      type: 'string',
      description: 'Custom name for this installation'
    },
    installation_type: { 
      type: 'string',
      enum: ['local', 'cloud'],
      description: 'Installation type'
    },
    user_environment_variables: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Custom environment variables'
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
  required: ['id', 'team_id', 'server_id', 'user_id', 'installation_name', 'installation_type', 'created_at', 'updated_at', 'last_used_at']
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

export interface CreateInstallationRequest {
  server_id: string;
  installation_name: string;
  installation_type?: 'local' | 'cloud';
  user_environment_variables?: Record<string, string>;
}

export interface UpdateInstallationRequest {
  installation_name?: string;
  user_environment_variables?: Record<string, string>;
}

export interface UpdateEnvironmentVariablesRequest {
  environment_variables: Record<string, string>;
}

export interface ServerDetails {
  id: string;
  name: string;
  description: string;
  github_url: string | null;
  homepage_url: string | null;
  author_name: string | null;
  language: string;
  runtime: string;
  status: 'active' | 'deprecated' | 'maintenance';
  tags: string[] | null;
  environment_variables: any[] | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  installation_methods: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  category_id: string | null;
  default_config?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface InstallationData {
  id: string;
  team_id: string;
  server_id: string;
  user_id: string;
  installation_name: string;
  installation_type: 'local' | 'cloud';
  user_environment_variables?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
  server?: ServerDetails;
}

export interface InstallationResponse {
  id: string;
  team_id: string;
  server_id: string;
  user_id: string;
  installation_name: string;
  installation_type: 'local' | 'cloud';
  user_environment_variables?: Record<string, string>;
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
