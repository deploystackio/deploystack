/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Optimized Shared Schemas for MCP Servers Routes
 * 
 * This file contains consolidated JSON Schema constants and TypeScript interfaces
 * with eliminated duplication and improved maintainability.
 */

// =============================================================================
// CONSTANTS AND REUSABLE COMPONENTS
// =============================================================================

export const CONFIG_VALUE_TYPES = ['string', 'number', 'boolean', 'secret'] as const;
export type ConfigValueType = typeof CONFIG_VALUE_TYPES[number];

// Common field definitions to eliminate repetition
const COMMON_FIELDS = {
  name: { type: 'string', description: 'Configuration name' },
  description: { type: 'string', description: 'Configuration description' },
  required: { type: 'boolean', description: 'Whether this configuration is required' },
  locked: { type: 'boolean', description: 'Whether this configuration is locked' },
  type: { type: 'string', enum: CONFIG_VALUE_TYPES, description: 'Configuration data type' },
  default_team_locked: { type: 'boolean', description: 'Whether this configuration is locked at team level by default' },
  visible_to_users: { type: 'boolean', description: 'Whether this configuration is visible to team users' },
  min_items: { type: 'number', description: 'Minimum number of items (for arrays)' },
  max_items: { type: 'number', description: 'Maximum number of items (for arrays)' }
} as const;

// Schema factory functions to reduce duplication
function createConfigSchema(entityType: string, additionalFields: Record<string, any> = {}, requiredBase: string[] = []) {
  const baseRequired = ['name', 'type', 'description', 'required', 'locked'];
  return {
    type: 'object',
    properties: {
      name: { ...COMMON_FIELDS.name, description: `${entityType} name` },
      type: COMMON_FIELDS.type,
      description: { ...COMMON_FIELDS.description, description: `${entityType} description` },
      required: { ...COMMON_FIELDS.required, description: `Whether this ${entityType} is required` },
      locked: { ...COMMON_FIELDS.locked, description: `Whether this ${entityType} is locked` },
      ...additionalFields
    },
    required: [...baseRequired, ...requiredBase],
    additionalProperties: false
  } as const;
}

// Reusable field definitions for server properties
const SERVER_FIELDS = {
  name: { type: 'string', minLength: 1, maxLength: 255, description: 'Server name (1-255 characters)' },
  description: { type: 'string', minLength: 1, description: 'Server description is required' },
  long_description: { type: 'string', description: 'Detailed server description' },
  github_url: { type: 'string', format: 'uri', description: 'GitHub repository URL' },
  git_branch: { type: 'string', description: 'Git branch (defaults to main)' },
  homepage_url: { type: 'string', format: 'uri', description: 'Homepage URL' },
  language: { type: 'string', minLength: 1, description: 'Programming language is required' },
  runtime: { type: 'string', minLength: 1, description: 'Runtime environment is required' },
  transport_type: { type: 'string', enum: ['stdio', 'http', 'sse'], description: 'MCP transport type' },
  installation_methods: { type: 'array', description: 'Installation methods' },
  author_name: { type: 'string', description: 'Author name' },
  author_contact: { type: 'string', description: 'Author contact information' },
  organization: { type: 'string', description: 'Organization name' },
  license: { type: 'string', description: 'License type' },
  dependencies: { type: 'object', description: 'Package dependencies' },
  category_id: { type: 'string', description: 'Category ID' },
  tags: { type: 'array', items: { type: 'string' }, description: 'Server tags' },
  status: { type: 'string', enum: ['active', 'deprecated', 'maintenance'], description: 'Server status' },
  featured: { type: 'boolean', description: 'Whether server is featured' },
  auto_install_new_default_team: { type: 'boolean', description: 'Auto-install for new default teams' }
} as const;

// Search-specific query schema - extends list schema but makes 'q' required instead of optional 'search'
export const SEARCH_SERVERS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    q: { 
      type: 'string', 
      minLength: 1, 
      maxLength: 255, 
      description: 'Search query string' 
    },
    // Reuse all other properties from LIST_SERVERS_QUERY_SCHEMA except 'search'
    category_id: { 
      type: 'string',
      description: 'Filter by category ID'
    },
    language: { 
      type: 'string',
      description: 'Filter by programming language'
    },
    runtime: { 
      type: 'string',
      description: 'Filter by runtime environment'
    },
    status: { 
      type: 'string',
      enum: ['active', 'deprecated', 'maintenance'],
      description: 'Filter by server status'
    },
    featured: { 
      type: 'string',
      enum: ['true', 'false'],
      description: 'Filter by featured status: true for featured servers, false for non-featured servers'
    },
    auto_install_new_default_team: { 
      type: 'boolean',
      description: 'Filter by auto-install flag'
    },
    limit: { 
      type: 'string',
      pattern: '^\\d+$',
      description: 'Limit must be a number between 1 and 100'
    },
    offset: { 
      type: 'string',
      pattern: '^\\d+$',
      description: 'Offset must be non-negative'
    }
  },
  required: ['q'],
  additionalProperties: false
} as const;


// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

export const SERVER_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      minLength: 1,
      description: 'Server ID is required'
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

export const LIST_SERVERS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    category_id: { 
      type: 'string',
      description: 'Filter by category ID'
    },
    language: { 
      type: 'string',
      description: 'Filter by programming language'
    },
    runtime: { 
      type: 'string',
      description: 'Filter by runtime environment'
    },
    status: { 
      type: 'string',
      enum: ['active', 'deprecated', 'maintenance'],
      description: 'Filter by server status'
    },
    featured: { 
      type: 'string',
      enum: ['true', 'false'],
      description: 'Filter by featured status: true for featured servers, false for non-featured servers'
    },
    auto_install_new_default_team: { 
      type: 'boolean',
      description: 'Filter by auto-install flag'
    },
    search: { 
      type: 'string',
      description: 'Search query for server name and description'
    },
    limit: { 
      type: 'string',
      pattern: '^\\d+$',
      description: 'Limit must be a number between 1 and 100'
    },
    offset: { 
      type: 'string',
      pattern: '^\\d+$',
      description: 'Offset must be non-negative'
    }
  },
  additionalProperties: false
} as const;

// =============================================================================
// CONFIGURATION SCHEMAS (THREE-TIER CONFIGURATION) - CONSOLIDATED
// =============================================================================

// Template level - simpler structure
export const TEMPLATE_ARG_SCHEMA = {
  type: 'object',
  properties: {
    value: { 
      type: 'string',
      description: 'Template argument value'
    },
    locked: { 
      type: 'boolean',
      description: 'Whether this template argument is locked'
    },
    description: { 
      type: 'string',
      description: 'Optional description of the template argument'
    }
  },
  required: ['value', 'locked'],
  additionalProperties: false
} as const;

export const TEMPLATE_ENV_SCHEMA = {
  type: 'object',
  properties: {
    name: { 
      type: 'string',
      description: 'Environment variable name'
    },
    value: { 
      type: 'string', 
      nullable: true,
      description: 'Environment variable value (can be null)'
    },
    locked: { 
      type: 'boolean',
      description: 'Whether this environment variable is locked'
    },
    description: { 
      type: 'string',
      description: 'Optional description of the environment variable'
    }
  },
  required: ['name', 'value', 'locked'],
  additionalProperties: false
} as const;

export const TEMPLATE_HEADER_SCHEMA = {
  type: 'object',
  properties: {
    name: { 
      type: 'string',
      description: 'Header name'
    },
    value: { 
      type: 'string', 
      nullable: true,
      description: 'Header value (can be null)'
    },
    locked: { 
      type: 'boolean',
      description: 'Whether this header is locked'
    },
    description: { 
      type: 'string',
      description: 'Optional description of the header'
    }
  },
  required: ['name', 'value', 'locked'],
  additionalProperties: false
} as const;

// Team level - includes team-specific fields
const TEAM_ADDITIONAL_FIELDS = {
  default_team_locked: COMMON_FIELDS.default_team_locked,
  visible_to_users: COMMON_FIELDS.visible_to_users
};

export const TEAM_ARG_SCHEMA = createConfigSchema('team argument', {
  ...TEAM_ADDITIONAL_FIELDS,
  min_items: COMMON_FIELDS.min_items,
  max_items: COMMON_FIELDS.max_items
}, ['default_team_locked']);

export const TEAM_ENV_SCHEMA = createConfigSchema('team environment variable', TEAM_ADDITIONAL_FIELDS, ['default_team_locked', 'visible_to_users']);

export const TEAM_HEADER_SCHEMA = createConfigSchema('team header', TEAM_ADDITIONAL_FIELDS, ['default_team_locked', 'visible_to_users']);

// User level - basic structure
export const USER_ARG_SCHEMA = createConfigSchema('user argument', {
  min_items: COMMON_FIELDS.min_items,
  max_items: COMMON_FIELDS.max_items
});

export const USER_ENV_SCHEMA = createConfigSchema('user environment variable');

export const USER_HEADER_SCHEMA = createConfigSchema('user header');

export const CONFIGURATION_SCHEMA = {
  type: 'object',
  properties: {
    template_args: { 
      type: 'array',
      items: TEMPLATE_ARG_SCHEMA,
      description: 'Template-level arguments'
    },
    template_env: { 
      type: 'array',
      items: TEMPLATE_ENV_SCHEMA,
      description: 'Template-level environment variables'
    },
    template_headers: { 
      type: 'array',
      items: TEMPLATE_HEADER_SCHEMA,
      description: 'Template-level headers'
    },
    team_args_schema: { 
      type: 'array',
      items: TEAM_ARG_SCHEMA,
      description: 'Team-level argument schema definitions'
    },
    team_env_schema: { 
      type: 'array',
      items: TEAM_ENV_SCHEMA,
      description: 'Team-level environment variable schema definitions'
    },
    team_headers_schema: { 
      type: 'array',
      items: TEAM_HEADER_SCHEMA,
      description: 'Team-level header schema definitions'
    },
    user_args_schema: { 
      type: 'array',
      items: USER_ARG_SCHEMA,
      description: 'User-level argument schema definitions'
    },
    user_env_schema: { 
      type: 'array',
      items: USER_ENV_SCHEMA,
      description: 'User-level environment variable schema definitions'
    },
    user_headers_schema: { 
      type: 'array',
      items: USER_HEADER_SCHEMA,
      description: 'User-level header schema definitions'
    }
  },
  additionalProperties: false
} as const;

// =============================================================================
// CLAUDE DESKTOP CONFIG SCHEMA (OLD FORMAT)
// =============================================================================

export const CLAUDE_DESKTOP_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    mcpServers: {
      type: 'object',
      additionalProperties: {
        oneOf: [
          {
            type: 'object',
            properties: {
              command: { 
                type: 'string', 
                minLength: 1,
                description: 'Command to run (e.g., npx, node, python)'
              },
              args: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Command line arguments'
              },
              env: { 
                type: 'object', 
                additionalProperties: { type: 'string' },
                description: 'Environment variables'
              }
            },
            required: ['command', 'args'],
            additionalProperties: false
          },
          {
            type: 'object',
            properties: {
              url: { 
                type: 'string', 
                format: 'uri',
                description: 'HTTP/SSE endpoint URL'
              },
              type: { 
                type: 'string', 
                enum: ['http', 'sse', 'streamableHttp'],
                description: 'Transport type'
              },
              headers: { 
                type: 'object', 
                additionalProperties: { type: 'string' },
                description: 'HTTP headers'
              }
            },
            required: ['url', 'type'],
            additionalProperties: false
          }
        ]
      }
    }
  },
  required: ['mcpServers'],
  additionalProperties: false
} as const;

// =============================================================================
// REQUEST BODY SCHEMAS - CONSOLIDATED
// =============================================================================

const ENTITY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name: { 
      type: 'string', 
      minLength: 1,
      description: 'Name is required'
    },
    description: { 
      type: 'string', 
      minLength: 1,
      description: 'Description is required'
    }
  },
  required: ['name', 'description'],
  additionalProperties: false
} as const;

// Reuse the same structure for tools and prompts
export const TOOL_SCHEMA = { ...ENTITY_ITEM_SCHEMA };
export const PROMPT_SCHEMA = { ...ENTITY_ITEM_SCHEMA };

// Resource schema has a different first property name
export const RESOURCE_SCHEMA = {
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      minLength: 1,
      description: 'Resource type is required'
    },
    description: { 
      type: 'string', 
      minLength: 1,
      description: 'Resource description is required'
    }
  },
  required: ['type', 'description'],
  additionalProperties: false
} as const;

export const CREATE_GLOBAL_SERVER_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    // Required fields
    name: { 
      type: 'string', 
      minLength: 1, 
      maxLength: 255,
      description: 'Server name (1-255 characters)'
    },
    description: { 
      type: 'string', 
      minLength: 1,
      description: 'Server description is required'
    },
    language: { 
      type: 'string', 
      minLength: 1,
      description: 'Programming language is required'
    },
    runtime: { 
      type: 'string', 
      minLength: 1,
      description: 'Runtime environment is required'
    },
    
    // New format (ADR-007) - optional for backward compatibility
    configuration_schema: CONFIGURATION_SCHEMA,
    transport_type: { 
      type: 'string', 
      enum: ['stdio', 'http', 'sse'],
      description: 'MCP transport type'
    },
    installation_methods: { 
      type: 'array',
      description: 'Installation methods'
    },
    
    // Old format (backward compatibility) - optional
    claude_desktop_config: CLAUDE_DESKTOP_CONFIG_SCHEMA,
    
    // Optional fields
    long_description: { 
      type: 'string',
      description: 'Detailed server description'
    },
    github_url: { 
      type: 'string', 
      format: 'uri',
      description: 'GitHub repository URL'
    },
    git_branch: { 
      type: 'string',
      description: 'Git branch (defaults to main)'
    },
    homepage_url: { 
      type: 'string', 
      format: 'uri',
      description: 'Homepage URL'
    },
    resources: { 
      type: 'array',
      items: RESOURCE_SCHEMA,
      description: 'Available resources'
    },
    prompts: { 
      type: 'array',
      items: PROMPT_SCHEMA,
      description: 'Available prompts'
    },
    author_name: { 
      type: 'string',
      description: 'Author name'
    },
    author_contact: { 
      type: 'string',
      description: 'Author contact information'
    },
    organization: { 
      type: 'string',
      description: 'Organization name'
    },
    license: { 
      type: 'string',
      description: 'License type'
    },
    dependencies: { 
      type: 'object',
      description: 'Package dependencies'
    },
    category_id: { 
      type: 'string',
      description: 'Category ID'
    },
    tags: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Server tags'
    },
    featured: { 
      type: 'boolean',
      description: 'Whether server is featured'
    },
    auto_install_new_default_team: { 
      type: 'boolean',
      description: 'Auto-install for new default teams'
    }
  },
  required: ['name', 'description', 'language', 'runtime'],
  additionalProperties: false
} as const;

// =============================================================================
// RESPONSE SCHEMAS - STANDARDIZED
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
    },
    details: { 
      description: 'Additional error details'
    }
  },
  required: ['success', 'error']
} as const;

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

export const SERVER_ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string',
      description: 'Unique server identifier'
    },
    name: { 
      type: 'string',
      description: 'Server name'
    },
    slug: { 
      type: 'string',
      description: 'URL-friendly server slug'
    },
    description: { 
      type: 'string',
      description: 'Server description'
    },
    long_description: { 
      type: 'string', 
      nullable: true,
      description: 'Detailed server description'
    },
    github_url: { 
      type: 'string', 
      nullable: true,
      description: 'GitHub repository URL'
    },
    git_branch: { 
      type: 'string', 
      nullable: true,
      description: 'Git branch'
    },
    homepage_url: { 
      type: 'string', 
      nullable: true,
      description: 'Homepage URL'
    },
    language: { 
      type: 'string',
      description: 'Programming language'
    },
    runtime: { 
      type: 'string',
      description: 'Runtime environment'
    },
    installation_methods: { 
      type: 'array',
      description: 'Installation methods'
    },
    resources: { 
      type: 'array', 
      nullable: true,
      description: 'Available resources'
    },
    prompts: { 
      type: 'array', 
      nullable: true,
      description: 'Available prompts'
    },
    visibility: { 
      type: 'string', 
      enum: ['global', 'team'],
      description: 'Server visibility'
    },
    owner_team_id: { 
      type: 'string', 
      nullable: true,
      description: 'Owning team ID (null for global servers)'
    },
    created_by: { 
      type: 'string',
      description: 'User ID who created the server'
    },
    author_name: { 
      type: 'string', 
      nullable: true,
      description: 'Author name'
    },
    author_contact: { 
      type: 'string', 
      nullable: true,
      description: 'Author contact'
    },
    organization: { 
      type: 'string', 
      nullable: true,
      description: 'Organization'
    },
    license: { 
      type: 'string', 
      nullable: true,
      description: 'License type'
    },
    transport_type: { 
      type: 'string', 
      enum: ['stdio', 'http', 'sse'],
      description: 'Transport type'
    },
    // Three-tier configuration schema
    template_args: { 
      type: 'array',
      description: 'Template arguments'
    },
    template_env: { 
      type: 'array',
      description: 'Template environment variables'
    },
    template_headers: { 
      type: 'array',
      description: 'Template headers'
    },
    team_args_schema: { 
      type: 'array',
      description: 'Team argument schema'
    },
    team_env_schema: { 
      type: 'array',
      description: 'Team environment variable schema'
    },
    team_headers_schema: { 
      type: 'array',
      description: 'Team header schema'
    },
    user_args_schema: { 
      type: 'array',
      description: 'User argument schema'
    },
    user_env_schema: { 
      type: 'array', 
      nullable: true,
      description: 'User environment variable schema'
    },
    user_headers_schema: { 
      type: 'array', 
      nullable: true,
      description: 'User header schema'
    },
    dependencies: { 
      type: 'object', 
      nullable: true,
      description: 'Package dependencies'
    },
    category_id: { 
      type: 'string', 
      nullable: true,
      description: 'Category ID'
    },
    tags: { 
      type: 'array', 
      items: { type: 'string' }, 
      nullable: true,
      description: 'Server tags'
    },
    status: { 
      type: 'string', 
      enum: ['active', 'deprecated', 'maintenance'],
      description: 'Server status'
    },
    featured: { 
      type: 'boolean',
      description: 'Whether server is featured'
    },
    auto_install_new_default_team: { 
      type: 'boolean',
      description: 'Auto-install for new default teams'
    },
    created_at: { 
      type: 'string', 
      format: 'date-time',
      description: 'Creation timestamp'
    },
    updated_at: { 
      type: 'string', 
      format: 'date-time',
      description: 'Last update timestamp'
    },
    last_sync_at: { 
      type: 'string', 
      format: 'date-time', 
      nullable: true,
      description: 'Last sync timestamp'
    }
  },
  required: ['id', 'name', 'slug', 'description', 'language', 'runtime', 'installation_methods', 'visibility', 'created_by', 'transport_type', 'template_args', 'template_env', 'template_headers', 'team_args_schema', 'team_env_schema', 'team_headers_schema', 'user_args_schema', 'status', 'featured', 'auto_install_new_default_team', 'created_at', 'updated_at']
} as const;

const PAGINATION_SCHEMA = {
  type: 'object',
  properties: {
    total: { 
      type: 'number',
      description: 'Total number of servers'
    },
    limit: { 
      type: 'number',
      description: 'Number of servers requested per page'
    },
    offset: { 
      type: 'number',
      description: 'Number of servers skipped'
    },
    has_more: { 
      type: 'boolean',
      description: 'Whether there are more servers beyond this page'
    }
  },
  required: ['total', 'limit', 'offset', 'has_more']
} as const;

// Success response factory
function createSuccessResponseSchema(dataSchema: any, description: string) {
  return {
    type: 'object',
    properties: {
      success: { 
        type: 'boolean', 
        description: `Indicates successful ${description}` 
      },
      data: dataSchema
    },
    required: ['success', 'data']
  } as const;
}

export const GET_SERVER_SUCCESS_RESPONSE_SCHEMA = createSuccessResponseSchema(SERVER_ENTITY_SCHEMA, 'server retrieval');
export const CREATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA = createSuccessResponseSchema(SERVER_ENTITY_SCHEMA, 'server creation');

export const DELETE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates successful server deletion'
    },
    message: {
      type: 'string',
      description: 'Success message'
    },
    data: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the deleted server'
        },
        name: {
          type: 'string',
          description: 'Name of the deleted server'
        },
        deleted_at: {
          type: 'string',
          format: 'date-time',
          description: 'Deletion timestamp'
        }
      },
      required: ['id', 'name', 'deleted_at']
    }
  },
  required: ['success', 'message', 'data']
} as const;

// Standardized error responses
export const COMMON_ERROR_RESPONSES = {
  400: { ...ERROR_RESPONSE_SCHEMA, description: 'Bad Request - Invalid input or missing Content-Type header' },
  401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
  403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Global admin permissions required' },
  404: { ...ERROR_RESPONSE_SCHEMA, description: 'Not Found - Server not found or access denied' },
  409: { ...ERROR_RESPONSE_SCHEMA, description: 'Conflict - Server name already exists' },
  500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
} as const;

export const LIST_SERVERS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates successful server list retrieval'
    },
    data: {
      type: 'object',
      properties: {
        servers: {
          type: 'array',
          items: SERVER_ENTITY_SCHEMA,
          description: 'Array of server objects'
        },
        pagination: {
          ...PAGINATION_SCHEMA,
          description: 'Pagination information'
        }
      },
      required: ['servers', 'pagination'],
      additionalProperties: false
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

// Update request schema - all fields from CREATE_GLOBAL_SERVER_REQUEST_SCHEMA but optional
export const UPDATE_GLOBAL_SERVER_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    // All fields from SERVER_FIELDS but optional
    name: SERVER_FIELDS.name,
    description: SERVER_FIELDS.description,
    long_description: SERVER_FIELDS.long_description,
    github_url: SERVER_FIELDS.github_url,
    git_branch: SERVER_FIELDS.git_branch,
    homepage_url: SERVER_FIELDS.homepage_url,
    language: SERVER_FIELDS.language,
    runtime: SERVER_FIELDS.runtime,
    transport_type: SERVER_FIELDS.transport_type,
    installation_methods: SERVER_FIELDS.installation_methods,
    resources: { 
      type: 'array',
      items: RESOURCE_SCHEMA,
      description: 'Available resources'
    },
    prompts: { 
      type: 'array',
      items: PROMPT_SCHEMA,
      description: 'Available prompts'
    },
    author_name: SERVER_FIELDS.author_name,
    author_contact: SERVER_FIELDS.author_contact,
    organization: SERVER_FIELDS.organization,
    license: SERVER_FIELDS.license,
    dependencies: SERVER_FIELDS.dependencies,
    category_id: SERVER_FIELDS.category_id,
    tags: SERVER_FIELDS.tags,
    status: SERVER_FIELDS.status,
    featured: SERVER_FIELDS.featured,
    auto_install_new_default_team: SERVER_FIELDS.auto_install_new_default_team
  },
  additionalProperties: false
} as const;

export const UPDATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA = createSuccessResponseSchema(SERVER_ENTITY_SCHEMA, 'server update');

// =============================================================================
// TYPESCRIPT INTERFACES - CONSOLIDATED
// =============================================================================

export interface ErrorResponse {
  success: boolean;
  error: string;
  details?: any;
}

export interface ServerIdParams {
  id: string;
}

export interface ListServersQueryParams {
  category_id?: string;
  language?: string;
  runtime?: string;
  status?: 'active' | 'deprecated' | 'maintenance';
  featured?: 'true' | 'false';
  auto_install_new_default_team?: boolean;
  search?: string;
  limit?: string;
  offset?: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Unified server interface - handles both database and API response formats
export interface ServerEntity {
  id: string;
  name: string;
  slug: string;
  description: string;
  long_description: string | null;
  github_url: string | null;
  git_branch: string | null;
  homepage_url: string | null;
  language: string;
  runtime: string;
  installation_methods: any[];
  resources: any[] | null;
  prompts: any[] | null;
  visibility: 'global' | 'team';
  owner_team_id: string | null;
  created_by: string;
  author_name: string | null;
  author_contact: string | null;
  organization: string | null;
  license: string | null;
  transport_type: 'stdio' | 'http' | 'sse';
  template_args: any[];
  template_env: any[];
  template_headers: any[];
  team_args_schema: any[];
  team_env_schema: any[];
  team_headers_schema: any[];
  user_args_schema: any[];
  user_env_schema: any[] | null;
  user_headers_schema: any[] | null;
  dependencies: Record<string, any> | null;
  category_id: string | null;
  tags: string[] | null;
  status: 'active' | 'deprecated' | 'maintenance';
  featured: boolean;
  auto_install_new_default_team: boolean;
  created_at: string | Date; // Flexible for both DB (Date) and API (string) formats
  updated_at: string | Date;
  last_sync_at: string | Date | null;
}

// Base configuration interfaces
interface BaseConfig {
  name: string;
  type: ConfigValueType;
  description: string;
  required: boolean;
  locked: boolean;
}

export interface TemplateArg {
  value: string;
  locked: boolean;
  description?: string;
}

export interface TemplateEnv extends BaseConfig {
  value: string | null;
}

export interface TemplateHeader extends BaseConfig {
  value: string | null;
}

export interface TeamConfig extends BaseConfig {
  default_team_locked: boolean;
  visible_to_users: boolean;
}

export interface TeamArg extends TeamConfig {
  min_items?: number;
  max_items?: number;
}

// TeamEnv and TeamHeader are just aliases for TeamConfig
export type TeamEnv = TeamConfig;
export type TeamHeader = TeamConfig;

export interface UserConfig extends BaseConfig {
  min_items?: number;
  max_items?: number;
}

// UserArg is just an alias for UserConfig
export type UserArg = UserConfig;
// UserEnv and UserHeader omit the array-specific fields
export type UserEnv = Omit<UserConfig, 'min_items' | 'max_items'>;
export type UserHeader = Omit<UserConfig, 'min_items' | 'max_items'>;

export interface ConfigurationSchema {
  template_args?: TemplateArg[];
  template_env?: TemplateEnv[];
  template_headers?: TemplateHeader[];
  team_args_schema?: TeamArg[];
  team_env_schema?: TeamEnv[];
  team_headers_schema?: TeamHeader[];
  user_args_schema?: UserArg[];
  user_env_schema?: UserEnv[];
  user_headers_schema?: UserHeader[];
}

export interface Tool {
  name: string;
  description: string;
}

export interface Resource {
  type: string;
  description: string;
}

export interface Prompt {
  name: string;
  description: string;
}

export interface ClaudeDesktopConfig {
  mcpServers: Record<string, 
    | { command: string; args: string[]; env?: Record<string, string>; }
    | { url: string; type: 'http' | 'sse' | 'streamableHttp'; headers?: Record<string, string>; }
  >;
}

export interface CreateGlobalServerRequest {
  // Required fields
  name: string;
  description: string;
  language: string;
  runtime: string;
  
  // New format (ADR-007) - optional for backward compatibility
  configuration_schema?: ConfigurationSchema;
  transport_type?: 'stdio' | 'http' | 'sse';
  installation_methods?: any[];
  tools?: Tool[];
  
  // Old format (backward compatibility) - optional
  claude_desktop_config?: ClaudeDesktopConfig;
  
  // Optional fields
  long_description?: string;
  github_url?: string;
  git_branch?: string;
  homepage_url?: string;
  resources?: Resource[];
  prompts?: Prompt[];
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  dependencies?: Record<string, any>;
  category_id?: string;
  tags?: string[];
  featured?: boolean;
  auto_install_new_default_team?: boolean;
}

export interface CreateGlobalServerSuccessResponse {
  success: boolean;
  data: ServerEntity;
}

export interface GetServerSuccessResponse {
  success: boolean;
  data: ServerEntity;
}

export interface DeleteGlobalServerSuccessResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    deleted_at: string;
  };
}

export interface ListServersSuccessResponse {
  success: boolean;
  data: {
    servers: ServerEntity[];
    pagination: PaginationInfo;
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Converts McpServer (from database) to API response format
 * Handles undefined -> null conversion and JSON parsing for complex fields
 */
export function formatServerResponse(server: any): ServerEntity {
  return {
    id: server.id,
    name: server.name,
    slug: server.slug,
    description: server.description,
    long_description: server.long_description || null,
    github_url: server.github_url || null,
    git_branch: server.git_branch || null,
    homepage_url: server.homepage_url || null,
    language: server.language,
    runtime: server.runtime,
    installation_methods: server.installation_methods ? JSON.parse(server.installation_methods) : [],
    resources: server.resources ? JSON.parse(server.resources) : null,
    prompts: server.prompts ? JSON.parse(server.prompts) : null,
    visibility: server.visibility,
    owner_team_id: server.owner_team_id || null,
    created_by: server.created_by,
    author_name: server.author_name || null,
    author_contact: server.author_contact || null,
    organization: server.organization || null,
    license: server.license || null,
    transport_type: server.transport_type,
    // Three-tier configuration schema - parse JSON fields
    template_args: server.template_args ? JSON.parse(server.template_args) : [],
    template_env: server.template_env ? JSON.parse(server.template_env) : [],
    template_headers: server.template_headers ? JSON.parse(server.template_headers) : [],
    team_args_schema: server.team_args_schema ? JSON.parse(server.team_args_schema) : [],
    team_env_schema: server.team_env_schema ? JSON.parse(server.team_env_schema) : [],
    team_headers_schema: server.team_headers_schema ? JSON.parse(server.team_headers_schema) : [],
    user_args_schema: server.user_args_schema ? JSON.parse(server.user_args_schema) : [],
    user_env_schema: server.user_env_schema ? JSON.parse(server.user_env_schema) : null,
    user_headers_schema: server.user_headers_schema ? JSON.parse(server.user_headers_schema) : null,
    dependencies: server.dependencies ? JSON.parse(server.dependencies) : null,
    category_id: server.category_id || null,
    tags: server.tags ? JSON.parse(server.tags) : null,
    status: server.status,
    featured: server.featured,
    auto_install_new_default_team: server.auto_install_new_default_team,
    created_at: server.created_at.toISOString(),
    updated_at: server.updated_at.toISOString(),
    last_sync_at: server.last_sync_at?.toISOString() || null
  };
}
