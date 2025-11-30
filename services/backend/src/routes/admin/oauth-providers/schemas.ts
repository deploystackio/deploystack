// Shared schemas for admin OAuth provider management routes

export const CREATE_PROVIDER_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Display name (e.g., "GitHub", "Google")'
    },
    slug: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      description: 'URL-safe identifier (lowercase alphanumeric + hyphens, e.g., "github")'
    },
    icon_url: {
      type: 'string',
      nullable: true,
      description: 'Provider logo URL'
    },
    auth_server_patterns: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'Regex patterns to match authorization server URLs'
    },
    client_id: {
      type: 'string',
      minLength: 1,
      description: 'OAuth App client ID'
    },
    client_secret: {
      type: 'string',
      nullable: true,
      description: 'OAuth App client secret (null for public clients)'
    },
    authorization_endpoint: {
      type: 'string',
      minLength: 1,
      description: 'OAuth authorization URL (e.g., "https://github.com/login/oauth/authorize")'
    },
    token_endpoint: {
      type: 'string',
      minLength: 1,
      description: 'OAuth token exchange URL (e.g., "https://github.com/login/oauth/access_token")'
    },
    default_scopes: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Default scopes to request'
    },
    pkce_required: {
      type: 'boolean',
      default: true,
      description: 'Whether PKCE is required for this provider'
    },
    token_endpoint_auth_method: {
      type: 'string',
      enum: ['client_secret_post', 'client_secret_basic', 'none'],
      default: 'client_secret_post',
      description: 'How to send client credentials to token endpoint'
    },
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Whether this provider is enabled'
    }
  },
  required: ['name', 'slug', 'auth_server_patterns', 'client_id', 'authorization_endpoint', 'token_endpoint'],
  additionalProperties: false
} as const;

export const UPDATE_PROVIDER_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Display name (e.g., "GitHub", "Google")'
    },
    slug: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      description: 'URL-safe identifier (lowercase alphanumeric + hyphens)'
    },
    icon_url: {
      type: 'string',
      nullable: true,
      description: 'Provider logo URL'
    },
    auth_server_patterns: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'Regex patterns to match authorization server URLs'
    },
    client_id: {
      type: 'string',
      minLength: 1,
      description: 'OAuth App client ID'
    },
    client_secret: {
      type: 'string',
      nullable: true,
      description: 'OAuth App client secret (empty string to remove, null to keep existing)'
    },
    authorization_endpoint: {
      type: 'string',
      minLength: 1,
      description: 'OAuth authorization URL'
    },
    token_endpoint: {
      type: 'string',
      minLength: 1,
      description: 'OAuth token exchange URL'
    },
    default_scopes: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Default scopes to request'
    },
    pkce_required: {
      type: 'boolean',
      description: 'Whether PKCE is required for this provider'
    },
    token_endpoint_auth_method: {
      type: 'string',
      enum: ['client_secret_post', 'client_secret_basic', 'none'],
      description: 'How to send client credentials to token endpoint'
    },
    enabled: {
      type: 'boolean',
      description: 'Whether this provider is enabled'
    }
  },
  additionalProperties: false
} as const;

export const PROVIDER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Provider unique identifier' },
    name: { type: 'string', description: 'Display name' },
    slug: { type: 'string', description: 'URL-safe identifier' },
    icon_url: { type: 'string', nullable: true, description: 'Provider logo URL' },
    auth_server_patterns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Regex patterns to match authorization server URLs'
    },
    client_id: { type: 'string', description: 'OAuth App client ID' },
    has_client_secret: { type: 'boolean', description: 'Whether client secret is configured' },
    authorization_endpoint: { type: 'string', description: 'OAuth authorization URL' },
    token_endpoint: { type: 'string', description: 'OAuth token exchange URL' },
    default_scopes: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Default scopes to request'
    },
    pkce_required: { type: 'boolean', description: 'Whether PKCE is required' },
    token_endpoint_auth_method: { type: 'string', description: 'Client credential transmission method' },
    enabled: { type: 'boolean', description: 'Whether provider is enabled' },
    created_at: { type: 'string', description: 'ISO8601 timestamp' },
    updated_at: { type: 'string', description: 'ISO8601 timestamp' }
  },
  required: [
    'id', 'name', 'slug', 'auth_server_patterns', 'client_id', 'has_client_secret',
    'authorization_endpoint', 'token_endpoint', 'pkce_required',
    'token_endpoint_auth_method', 'enabled', 'created_at', 'updated_at'
  ]
} as const;

export const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    message: { type: 'string', description: 'Success message' },
    data: PROVIDER_RESPONSE_SCHEMA
  },
  required: ['success', 'message', 'data']
} as const;

export const LIST_PROVIDERS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    data: {
      type: 'array',
      items: PROVIDER_RESPONSE_SCHEMA
    }
  },
  required: ['success', 'data']
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false, description: 'Indicates operation failure' },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error']
} as const;

export const DELETE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    message: { type: 'string', description: 'Success message' }
  },
  required: ['success', 'message']
} as const;

// TypeScript interfaces
export interface CreateProviderRequest {
  name: string;
  slug: string;
  icon_url?: string | null;
  auth_server_patterns: string[];
  client_id: string;
  client_secret?: string | null;
  authorization_endpoint: string;
  token_endpoint: string;
  default_scopes?: string[] | null;
  pkce_required?: boolean;
  token_endpoint_auth_method?: 'client_secret_post' | 'client_secret_basic' | 'none';
  enabled?: boolean;
}

export interface UpdateProviderRequest {
  name?: string;
  slug?: string;
  icon_url?: string | null;
  auth_server_patterns?: string[];
  client_id?: string;
  client_secret?: string | null;
  authorization_endpoint?: string;
  token_endpoint?: string;
  default_scopes?: string[] | null;
  pkce_required?: boolean;
  token_endpoint_auth_method?: 'client_secret_post' | 'client_secret_basic' | 'none';
  enabled?: boolean;
}

export interface ProviderResponse {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  auth_server_patterns: string[];
  client_id: string;
  has_client_secret: boolean;
  authorization_endpoint: string;
  token_endpoint: string;
  default_scopes: string[] | null;
  pkce_required: boolean;
  token_endpoint_auth_method: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
  data: ProviderResponse;
}

export interface ListProvidersResponse {
  success: boolean;
  data: ProviderResponse[];
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface DeleteSuccessResponse {
  success: boolean;
  message: string;
}
