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

// MCP Server Status Values - Single source of truth
export const MCP_SERVER_STATUS_VALUES = ['active', 'deprecated', 'maintenance', 'disabled'] as const;
export type McpServerStatus = typeof MCP_SERVER_STATUS_VALUES[number];

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
  max_items: { type: 'number', description: 'Maximum number of items (for arrays)' },
  order: { type: 'number', description: 'Order position for STDIO argument ordering' }
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
  repository_url: { type: 'string', format: 'uri', description: 'Repository URL' },
  repository_source: { type: 'string', description: 'Repository platform (github, gitlab, bitbucket)' },
  repository_id: { type: 'string', description: 'Platform-specific repository identifier' },
  repository_subfolder: { type: 'string', description: 'Subfolder path for monorepos' },
  git_branch: { type: 'string', description: 'Git branch (defaults to main)' },
  website_url: { type: 'string', format: 'uri', description: 'Website URL' },
  icon_url: {
    oneOf: [
      { type: 'string', maxLength: 0 },
      { type: 'string', format: 'uri' }
    ],
    description: 'Icon/logo URL (empty string or valid URI)'
  },
  language: { type: 'string', minLength: 1, description: 'Programming language is required' },
  runtime: { type: 'string', minLength: 1, description: 'Runtime environment is required' },
  transport_type: { type: 'string', enum: ['stdio', 'http', 'sse'], description: 'MCP transport type' },
  packages: { type: 'array', description: 'MCP Registry packages array' },
  remotes: { type: 'array', description: 'MCP Registry remotes array for HTTP/SSE' },
  author_name: { type: 'string', description: 'Author name' },
  author_contact: { type: 'string', description: 'Author contact information' },
  organization: { type: 'string', description: 'Organization name' },
  license: { type: 'string', description: 'License type' },
  dependencies: { type: 'object', description: 'Package dependencies' },
  category_id: { type: 'string', description: 'Category ID' },
  tags: { type: 'array', items: { type: 'string' }, description: 'Server tags' },
  status: { type: 'string', enum: MCP_SERVER_STATUS_VALUES as unknown as string[], description: 'Server status' },
  featured: { type: 'boolean', description: 'Whether server is featured' },
  auto_install_new_default_team: { type: 'boolean', description: 'Auto-install for new default teams' },
  requires_oauth: { type: 'boolean', description: 'Whether this server requires OAuth authentication' }
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
      enum: MCP_SERVER_STATUS_VALUES as unknown as string[],
      description: 'Filter by server status'
    },
    source: {
      type: 'string',
      enum: ['official_registry', 'manual', 'github'],
      description: 'Filter by server source: official_registry, manual, or github'
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
    tags: {
      type: 'string',
      description: 'Filter by tags (comma-separated list, e.g., "mcp,web-scraping"). Servers matching ANY of the provided tags will be returned.'
    },
    sort_by: {
      type: 'string',
      enum: ['name', 'github_stars'],
      description: 'Sort results by name (default) or GitHub stars (descending, nulls last)'
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
      enum: MCP_SERVER_STATUS_VALUES as unknown as string[],
      description: 'Filter by server status'
    },
    featured: {
      type: 'string',
      enum: ['true', 'false'],
      description: 'Filter by featured status: true for featured servers, false for non-featured servers'
    },
    source: {
      type: 'string',
      enum: ['official_registry', 'manual', 'github'],
      description: 'Filter by source: official_registry for servers synced from MCP Registry, manual for manually added servers, github for GitHub deployments'
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
    },
    order: {
      type: 'number',
      description: 'Order position for STDIO argument ordering'
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

export const TEMPLATE_URL_QUERY_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'URL query parameter name'
    },
    value: {
      type: 'string',
      nullable: true,
      description: 'URL query parameter value (can be null)'
    },
    locked: {
      type: 'boolean',
      description: 'Whether this URL query parameter is locked'
    },
    description: {
      type: 'string',
      description: 'Optional description of the URL query parameter'
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
  max_items: COMMON_FIELDS.max_items,
  order: COMMON_FIELDS.order
}, ['default_team_locked']);

export const TEAM_ENV_SCHEMA = createConfigSchema('team environment variable', TEAM_ADDITIONAL_FIELDS, ['default_team_locked', 'visible_to_users']);

export const TEAM_HEADER_SCHEMA = createConfigSchema('team header', TEAM_ADDITIONAL_FIELDS, ['default_team_locked', 'visible_to_users']);

export const TEAM_URL_QUERY_PARAM_SCHEMA = createConfigSchema('team URL query parameter', TEAM_ADDITIONAL_FIELDS, ['default_team_locked', 'visible_to_users']);

// User level - basic structure
export const USER_ARG_SCHEMA = createConfigSchema('user argument', {
  min_items: COMMON_FIELDS.min_items,
  max_items: COMMON_FIELDS.max_items,
  order: COMMON_FIELDS.order
});

export const USER_ENV_SCHEMA = createConfigSchema('user environment variable');

export const USER_HEADER_SCHEMA = createConfigSchema('user header');

export const USER_URL_QUERY_PARAM_SCHEMA = createConfigSchema('user URL query parameter');

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
    template_url_query_params: {
      type: 'array',
      items: TEMPLATE_URL_QUERY_PARAM_SCHEMA,
      description: 'Template-level URL query parameters'
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
    team_url_query_params_schema: {
      type: 'array',
      items: TEAM_URL_QUERY_PARAM_SCHEMA,
      description: 'Team-level URL query parameter schema definitions'
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
    },
    user_url_query_params_schema: {
      type: 'array',
      items: USER_URL_QUERY_PARAM_SCHEMA,
      description: 'User-level URL query parameter schema definitions'
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
    
    // Configuration schema
    configuration_schema: CONFIGURATION_SCHEMA,
    transport_type: { 
      type: 'string', 
      enum: ['stdio', 'http', 'sse'],
      description: 'MCP transport type'
    },
    packages: { 
      type: 'array',
      description: 'MCP Registry packages array'
    },
    remotes: { 
      type: 'array',
      description: 'MCP Registry remotes array for HTTP/SSE'
    },
    
    // Old format (backward compatibility) - optional
    claude_desktop_config: CLAUDE_DESKTOP_CONFIG_SCHEMA,
    
    // Optional fields
    long_description: { 
      type: 'string',
      description: 'Detailed server description'
    },
    repository_url: { 
    type: 'string', 
    format: 'uri', 
    description: 'Repository URL' 
    },
    repository_source: { 
      type: 'string', 
      description: 'Repository platform (github, gitlab, bitbucket)' 
    },
    repository_id: { 
      type: 'string', 
      description: 'Platform-specific repository identifier' 
    },
    repository_subfolder: { 
      type: 'string', 
      description: 'Subfolder path for monorepos' 
    },
    git_branch: { 
      type: 'string',
      description: 'Git branch (defaults to main)'
    },
    website_url: {
      type: 'string',
      format: 'uri',
      description: 'Website URL'
    },
    icon_url: {
      oneOf: [
        { type: 'string', maxLength: 0 },
        { type: 'string', format: 'uri' }
      ],
      description: 'Icon/logo URL (empty string or valid URI)'
    },
    github_account_id: {
      type: 'string',
      description: 'GitHub Account ID (owner.id from GitHub API)'
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
    },
    requires_oauth: {
      type: 'boolean',
      description: 'Whether this server requires OAuth authentication'
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
    git_branch: { 
      type: 'string', 
      nullable: true,
      description: 'Git branch'
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
    github_account_id: {
      type: 'string',
      nullable: true,
      description: 'GitHub Account ID'
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
    packages: { 
      type: 'array',
      description: 'MCP Registry packages array'
    },
    remotes: { 
      type: 'array',
      nullable: true,
      description: 'MCP Registry remotes array for HTTP/SSE'
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
      enum: MCP_SERVER_STATUS_VALUES as unknown as string[],
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
    requires_oauth: {
      type: 'boolean',
      description: 'Whether this server requires OAuth authentication'
    },
    source: {
      type: 'string',
      enum: ['official_registry', 'manual'],
      description: 'Source of the MCP server'
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
  required: ['id', 'name', 'slug', 'description', 'language', 'runtime', 'packages', 'visibility', 'created_by', 'transport_type', 'template_args', 'template_env', 'template_headers', 'template_url_query_params', 'team_args_schema', 'team_env_schema', 'team_headers_schema', 'team_url_query_params_schema', 'user_args_schema', 'status', 'featured', 'auto_install_new_default_team', 'requires_oauth', 'created_at', 'updated_at']
} as const;

// GET endpoint uses the same schema as base entity (github_readme_base64 removed)
export const GET_SERVER_ENTITY_SCHEMA = SERVER_ENTITY_SCHEMA;

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

export const GET_SERVER_SUCCESS_RESPONSE_SCHEMA = createSuccessResponseSchema(GET_SERVER_ENTITY_SCHEMA, 'server retrieval');
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

// =============================================================================
// BULK DELETE GLOBAL SERVERS SCHEMAS
// =============================================================================

export const BULK_DELETE_GLOBAL_SERVERS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    server_ids: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
      description: 'Array of server IDs to delete (1-100 unique IDs)'
    }
  },
  required: ['server_ids'],
  additionalProperties: false
} as const;

export const BULK_DELETE_JOB_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    server_id: { type: 'string', description: 'Server ID' },
    server_name: { type: 'string', description: 'Server name' },
    job_id: { type: 'string', description: 'Background job ID for tracking' }
  },
  required: ['server_id', 'server_name', 'job_id']
} as const;

export const BULK_DELETE_SKIPPED_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    server_id: { type: 'string', description: 'Server ID' },
    reason: { type: 'string', description: 'Reason for skipping' }
  },
  required: ['server_id', 'reason']
} as const;

export const BULK_DELETE_GLOBAL_SERVERS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates request was accepted'
    },
    message: {
      type: 'string',
      description: 'Status message'
    },
    data: {
      type: 'object',
      properties: {
        total_requested: {
          type: 'number',
          description: 'Total number of server IDs requested'
        },
        total_queued: {
          type: 'number',
          description: 'Number of servers successfully queued for deletion'
        },
        total_skipped: {
          type: 'number',
          description: 'Number of servers skipped'
        },
        jobs: {
          type: 'array',
          items: BULK_DELETE_JOB_ITEM_SCHEMA,
          description: 'Array of queued deletion jobs'
        },
        skipped: {
          type: 'array',
          items: BULK_DELETE_SKIPPED_ITEM_SCHEMA,
          description: 'Array of skipped servers with reasons'
        }
      },
      required: ['total_requested', 'total_queued', 'total_skipped', 'jobs', 'skipped']
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

// =============================================================================
// UPDATE GLOBAL SERVER STATUS SCHEMAS
// =============================================================================

export const UPDATE_GLOBAL_SERVER_STATUS_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: MCP_SERVER_STATUS_VALUES as unknown as string[],
      description: 'New server status'
    }
  },
  required: ['status'],
  additionalProperties: false
} as const;

export const UPDATE_GLOBAL_SERVER_STATUS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful status update'
    },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Server ID' },
        name: { type: 'string', description: 'Server name' },
        slug: { type: 'string', description: 'Server slug' },
        status: {
          type: 'string',
          enum: MCP_SERVER_STATUS_VALUES as unknown as string[],
          description: 'Updated server status'
        },
        previous_status: {
          type: 'string',
          enum: MCP_SERVER_STATUS_VALUES as unknown as string[],
          description: 'Previous server status'
        },
        updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
      },
      required: ['id', 'name', 'slug', 'status', 'previous_status', 'updated_at']
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

// Category object schema for embedding in server list responses
export const CATEGORY_EMBED_SCHEMA = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', description: 'Category ID' },
    name: { type: 'string', description: 'Category name' },
    icon: { type: 'string', nullable: true, description: 'Category icon name/class' }
  },
  required: ['id', 'name']
} as const;

// Minimal server entity for list endpoints - excludes configuration schemas and heavy fields
export const SERVER_LIST_ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique server identifier' },
    name: { type: 'string', description: 'Server name' },
    slug: { type: 'string', description: 'URL-friendly server slug' },
    description: { type: 'string', description: 'Server description' },
    icon_url: { type: 'string', nullable: true, description: 'Icon/logo URL' },
    website_url: { type: 'string', nullable: true, description: 'Website URL' },
    language: { type: 'string', description: 'Programming language' },
    runtime: { type: 'string', description: 'Runtime environment' },
    transport_type: { type: 'string', enum: ['stdio', 'http', 'sse'], description: 'Transport type' },
    visibility: { type: 'string', enum: ['global', 'team'], description: 'Server visibility' },
    owner_team_id: { type: 'string', nullable: true, description: 'Owning team ID' },
    category: CATEGORY_EMBED_SCHEMA,
    tags: { type: 'array', items: { type: 'string' }, nullable: true, description: 'Server tags' },
    status: { type: 'string', enum: MCP_SERVER_STATUS_VALUES as unknown as string[], description: 'Server status' },
    featured: { type: 'boolean', description: 'Whether server is featured' },
    requires_oauth: { type: 'boolean', description: 'Whether server requires OAuth' },
    github_stars: { type: 'number', nullable: true, description: 'GitHub stars count' },
    author_name: { type: 'string', nullable: true, description: 'Author name' },
    organization: { type: 'string', nullable: true, description: 'Organization' },
    official_name: { type: 'string', nullable: true, description: 'Official registry name' },
    source: { type: 'string', enum: ['official_registry', 'manual', 'github'], description: 'Source of the MCP server' },
    created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
    updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
    team_name: { type: 'string', nullable: true, description: 'Team name (present when server belongs to a team)' },
    team_slug: { type: 'string', nullable: true, description: 'Team slug (present when server belongs to a team)' },
    team_id: { type: 'string', nullable: true, description: 'Team ID (present when server belongs to a team)' }
  },
  required: ['id', 'name', 'slug', 'description', 'language', 'runtime', 'transport_type', 'visibility', 'status', 'featured', 'requires_oauth', 'source', 'created_at', 'updated_at']
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
          items: SERVER_LIST_ENTITY_SCHEMA,
          description: 'Array of server objects (minimal fields for listing)'
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
export const UPDATE_GLOBAL_SERVER_REQUEST_SCHEMA = { type: 'object',
  properties: {
    // All fields from SERVER_FIELDS but optional
    name: SERVER_FIELDS.name,
    slug: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      description: 'URL-friendly unique identifier (lowercase alphanumeric with hyphens, e.g., "my-server-name")'
    },
    description: SERVER_FIELDS.description,
    long_description: SERVER_FIELDS.long_description,
    repository_url: SERVER_FIELDS.repository_url,
    repository_source: SERVER_FIELDS.repository_source,
    repository_id: SERVER_FIELDS.repository_id,
    repository_subfolder: SERVER_FIELDS.repository_subfolder,
    git_branch: SERVER_FIELDS.git_branch,
    website_url: SERVER_FIELDS.website_url,
    icon_url: SERVER_FIELDS.icon_url,
    github_account_id: {
      type: 'string',
      description: 'GitHub Account ID (owner.id from GitHub API)'
    },
    github_readme_base64: {
      type: 'string',
      description: 'Base64 encoded README content'
    },
    language: SERVER_FIELDS.language,
    runtime: SERVER_FIELDS.runtime,
    transport_type: SERVER_FIELDS.transport_type,
    packages: SERVER_FIELDS.packages,
    remotes: SERVER_FIELDS.remotes,
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
    auto_install_new_default_team: SERVER_FIELDS.auto_install_new_default_team,
    requires_oauth: SERVER_FIELDS.requires_oauth,
    // Three-tier configuration schema - CRITICAL FIX
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
    template_url_query_params: {
      type: 'array',
      items: TEMPLATE_URL_QUERY_PARAM_SCHEMA,
      description: 'Template-level URL query parameters'
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
    team_url_query_params_schema: {
      type: 'array',
      items: TEAM_URL_QUERY_PARAM_SCHEMA,
      description: 'Team-level URL query parameter schema definitions'
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
    },
    user_url_query_params_schema: {
      type: 'array',
      items: USER_URL_QUERY_PARAM_SCHEMA,
      description: 'User-level URL query parameter schema definitions'
    }
  },
  additionalProperties: false
} as const;

export const UPDATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA = createSuccessResponseSchema(SERVER_ENTITY_SCHEMA, 'server update');

export const GET_TAGS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful tags retrieval'
    },
    data: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of unique tags sorted alphabetically'
        },
        total: {
          type: 'number',
          description: 'Total number of unique tags'
        }
      },
      required: ['tags', 'total'],
      additionalProperties: false
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

export const GET_LANGUAGES_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful languages retrieval'
    },
    data: {
      type: 'object',
      properties: {
        languages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of unique programming languages sorted alphabetically'
        },
        total: {
          type: 'number',
          description: 'Total number of unique languages'
        }
      },
      required: ['languages', 'total'],
      additionalProperties: false
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

export const GET_RUNTIMES_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful runtimes retrieval'
    },
    data: {
      type: 'object',
      properties: {
        runtimes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of unique runtime environments sorted alphabetically'
        },
        total: {
          type: 'number',
          description: 'Total number of unique runtimes'
        }
      },
      required: ['runtimes', 'total'],
      additionalProperties: false
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

// README-specific schemas
export const README_ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    github_readme_base64: {
      type: 'string',
      nullable: true,
      description: 'Base64-encoded GitHub README content'
    }
  },
  required: ['github_readme_base64'],
  additionalProperties: false
} as const;

export const GET_README_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful README retrieval'
    },
    data: README_ENTITY_SCHEMA
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

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
  status?: McpServerStatus;
  featured?: 'true' | 'false';
  source?: 'official_registry' | 'manual' | 'github';
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
  repository_url: string | null;
  repository_source: string | null;
  repository_id: string | null;
  repository_subfolder: string | null;
  git_branch: string | null;
  website_url: string | null;
  icon_url: string | null;
  github_account_id: string | null;
  github_stars: number | null;
  language: string;
  runtime: string;
  packages: any[];
  remotes: any[] | null;
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
  template_url_query_params: any[];
  team_args_schema: any[];
  team_env_schema: any[];
  team_headers_schema: any[];
  team_url_query_params_schema: any[];
  user_args_schema: any[];
  user_env_schema: any[] | null;
  user_headers_schema: any[] | null;
  user_url_query_params_schema: any[] | null;
  dependencies: Record<string, any> | null;
  category_id: string | null;
  tags: string[] | null;
  status: McpServerStatus;
  featured: boolean;
  auto_install_new_default_team: boolean;
  requires_oauth: boolean;
  source: 'official_registry' | 'manual' | 'github';
  
  // Official Registry Sync Tracking
  official_name: string | null;
  synced_from_official_registry: boolean;
  official_registry_server_id: string | null;
  official_registry_version_id: string | null;
  official_registry_published_at: string | Date | null;
  official_registry_updated_at: string | Date | null;
  
  created_at: string | Date; // Flexible for both DB (Date) and API (string) formats
  updated_at: string | Date;
  last_sync_at: string | Date | null;
}

// GET endpoint uses the same entity as base (github_readme_base64 removed)
export type GetServerEntity = ServerEntity;

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
  order?: number;
}

export interface TemplateEnv extends BaseConfig {
  value: string | null;
}

export interface TemplateHeader extends BaseConfig {
  value: string | null;
}

export interface TemplateUrlQueryParam extends BaseConfig {
  value: string | null;
}

export interface TeamConfig extends BaseConfig {
  default_team_locked: boolean;
  visible_to_users: boolean;
}

export interface TeamArg extends TeamConfig {
  min_items?: number;
  max_items?: number;
  order?: number;
}

// TeamEnv, TeamHeader, and TeamUrlQueryParam are just aliases for TeamConfig
export type TeamEnv = TeamConfig;
export type TeamHeader = TeamConfig;
export type TeamUrlQueryParam = TeamConfig;

export interface UserConfig extends BaseConfig {
  min_items?: number;
  max_items?: number;
  order?: number;
}

// UserArg is just an alias for UserConfig
export type UserArg = UserConfig;
// UserEnv, UserHeader, and UserUrlQueryParam omit the array-specific fields and order (order is for args only)
export type UserEnv = Omit<UserConfig, 'min_items' | 'max_items' | 'order'>;
export type UserHeader = Omit<UserConfig, 'min_items' | 'max_items' | 'order'>;
export type UserUrlQueryParam = Omit<UserConfig, 'min_items' | 'max_items' | 'order'>;

export interface ConfigurationSchema {
  template_args?: TemplateArg[];
  template_env?: TemplateEnv[];
  template_headers?: TemplateHeader[];
  template_url_query_params?: TemplateUrlQueryParam[];
  team_args_schema?: TeamArg[];
  team_env_schema?: TeamEnv[];
  team_headers_schema?: TeamHeader[];
  team_url_query_params_schema?: TeamUrlQueryParam[];
  user_args_schema?: UserArg[];
  user_env_schema?: UserEnv[];
  user_headers_schema?: UserHeader[];
  user_url_query_params_schema?: UserUrlQueryParam[];
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
  
  // Version information
  version?: string;
  
  // Configuration
  configuration_schema?: ConfigurationSchema;
  transport_type?: 'stdio' | 'http' | 'sse';
  packages?: any[];
  remotes?: any[];
  tools?: Tool[];
  
  // Old format (backward compatibility) - optional
  claude_desktop_config?: ClaudeDesktopConfig;
  
  // Optional fields
  long_description?: string;
  repository_url?: string;
  repository_source?: string;
  repository_id?: string;
  repository_subfolder?: string;
  git_branch?: string;
  website_url?: string;
  icon_url?: string;
  github_account_id?: string;
  github_stars?: number;
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
  requires_oauth?: boolean;

  // Official Registry Sync Tracking
  official_name?: string;
  synced_from_official_registry?: boolean;
  official_registry_server_id?: string | null;
  official_registry_version_id?: string | null;
  official_registry_published_at?: Date | null;
  official_registry_updated_at?: Date | null;
}

export interface CreateGlobalServerSuccessResponse {
  success: boolean;
  data: ServerEntity;
}

export interface GetServerSuccessResponse {
  success: boolean;
  data: GetServerEntity;
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

export interface BulkDeleteGlobalServersRequest {
  server_ids: string[];
}

export interface BulkDeleteJobItem {
  server_id: string;
  server_name: string;
  job_id: string;
}

export interface BulkDeleteSkippedItem {
  server_id: string;
  reason: string;
}

export interface BulkDeleteGlobalServersSuccessResponse {
  success: boolean;
  message: string;
  data: {
    total_requested: number;
    total_queued: number;
    total_skipped: number;
    jobs: BulkDeleteJobItem[];
    skipped: BulkDeleteSkippedItem[];
  };
}

// Category embed interface for list responses
export interface CategoryEmbed {
  id: string;
  name: string;
  icon: string | null;
}

// Minimal server entity for list responses
export interface ServerListEntity {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string | null;
  website_url: string | null;
  language: string;
  runtime: string;
  transport_type: 'stdio' | 'http' | 'sse';
  visibility: 'global' | 'team';
  owner_team_id: string | null;
  category: CategoryEmbed | null;
  tags: string[] | null;
  status: McpServerStatus;
  featured: boolean;
  requires_oauth: boolean;
  github_stars: number | null;
  author_name: string | null;
  organization: string | null;
  official_name: string | null;
  source: 'official_registry' | 'manual' | 'github';
  created_at: string;
  updated_at: string;
  // Team information (present when server belongs to a team)
  team_name?: string;
  team_slug?: string;
  team_id?: string;
}

export interface ListServersSuccessResponse {
  success: boolean;
  data: {
    servers: ServerListEntity[];
    pagination: PaginationInfo;
  };
}

export interface GetTagsSuccessResponse {
  success: boolean;
  data: {
    tags: string[];
    total: number;
  };
}

export interface GetLanguagesSuccessResponse {
  success: boolean;
  data: {
    languages: string[];
    total: number;
  };
}

export interface GetRuntimesSuccessResponse {
  success: boolean;
  data: {
    runtimes: string[];
    total: number;
  };
}

export interface ReadmeEntity {
  github_readme_base64: string | null;
}

export interface GetReadmeSuccessResponse {
  success: boolean;
  data: ReadmeEntity;
}

export interface UpdateGlobalServerStatusRequest {
  status: McpServerStatus;
}

export interface UpdateGlobalServerStatusSuccessResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    slug: string;
    status: McpServerStatus;
    previous_status: McpServerStatus;
    updated_at: string;
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
  // Helper function to safely parse JSON fields
  const safeJsonParse = (field: any, defaultValue: any) => {
    if (!field) return defaultValue;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return defaultValue;
      }
    }
    // If it's already an object/array, return as-is
    return field;
  };

  return {
    id: server.id,
    name: server.name,
    slug: server.slug,
    description: server.description,
    long_description: server.long_description || null,
    repository_url: server.repository_url || null,
    repository_source: server.repository_source || null,
    repository_id: server.repository_id || null,
    repository_subfolder: server.repository_subfolder || null,
    git_branch: server.git_branch || null,
    website_url: server.website_url || null,
    icon_url: server.icon_url || null,
    github_account_id: server.github_account_id || null,
    github_stars: server.github_stars || null,
    language: server.language,
    runtime: server.runtime,
    packages: safeJsonParse(server.packages, []),
    remotes: safeJsonParse(server.remotes, null),
    resources: safeJsonParse(server.resources, null),
    prompts: safeJsonParse(server.prompts, null),
    visibility: server.visibility,
    owner_team_id: server.owner_team_id || null,
    created_by: server.created_by,
    author_name: server.author_name || null,
    author_contact: server.author_contact || null,
    organization: server.organization || null,
    license: server.license || null,
    transport_type: server.transport_type,
    // Three-tier configuration schema - safely parse JSON fields
    template_args: safeJsonParse(server.template_args, []),
    template_env: safeJsonParse(server.template_env, []),
    template_headers: safeJsonParse(server.template_headers, []),
    template_url_query_params: safeJsonParse(server.template_url_query_params, []),
    team_args_schema: safeJsonParse(server.team_args_schema, []),
    team_env_schema: safeJsonParse(server.team_env_schema, []),
    team_headers_schema: safeJsonParse(server.team_headers_schema, []),
    team_url_query_params_schema: safeJsonParse(server.team_url_query_params_schema, []),
    user_args_schema: safeJsonParse(server.user_args_schema, []),
    user_env_schema: safeJsonParse(server.user_env_schema, null),
    user_headers_schema: safeJsonParse(server.user_headers_schema, null),
    user_url_query_params_schema: safeJsonParse(server.user_url_query_params_schema, null),
    dependencies: safeJsonParse(server.dependencies, null),
    category_id: server.category_id || null,
    tags: safeJsonParse(server.tags, null),
    status: server.status,
    featured: server.featured,
    auto_install_new_default_team: server.auto_install_new_default_team,
    requires_oauth: server.requires_oauth || false,
    source: server.source || 'manual',
    
    // Official Registry Sync Tracking
    official_name: server.official_name || null,
    synced_from_official_registry: server.synced_from_official_registry || false,
    official_registry_server_id: server.official_registry_server_id || null,
    official_registry_version_id: server.official_registry_version_id || null,
    official_registry_published_at: server.official_registry_published_at?.toISOString() || null,
    official_registry_updated_at: server.official_registry_updated_at?.toISOString() || null,
    
    created_at: server.created_at.toISOString(),
    updated_at: server.updated_at.toISOString(),
    last_sync_at: server.last_sync_at?.toISOString() || null
  };
}

/**
 * Converts McpServer to minimal API response format for list endpoints
 * Excludes configuration schemas, packages, remotes, and other heavy fields
 *
 * @param server - The server entity from database
 * @param categoriesMap - Optional map of category_id to category data for embedding
 */
export function formatServerListResponse(
  server: any,
  categoriesMap?: Map<string, CategoryEmbed>
): ServerListEntity {
  const safeJsonParse = (field: any, defaultValue: any) => {
    if (!field) return defaultValue;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return defaultValue;
      }
    }
    return field;
  };

  // Get category embed if available
  const categoryId = server.category_id || null;
  const category = categoryId && categoriesMap ? categoriesMap.get(categoryId) || null : null;

  return {
    id: server.id,
    name: server.name,
    slug: server.slug,
    description: server.description,
    icon_url: server.icon_url || null,
    website_url: server.website_url || null,
    language: server.language,
    runtime: server.runtime,
    transport_type: server.transport_type,
    visibility: server.visibility,
    owner_team_id: server.owner_team_id || null,
    category: category,
    tags: safeJsonParse(server.tags, null),
    status: server.status,
    featured: server.featured,
    requires_oauth: server.requires_oauth || false,
    github_stars: server.github_stars || null,
    author_name: server.author_name || null,
    organization: server.organization || null,
    official_name: server.official_name || null,
    source: server.source || 'manual',
    created_at: server.created_at.toISOString(),
    updated_at: server.updated_at.toISOString(),
    // Include team information if present (when server belongs to a team)
    ...(server.team_name && {
      team_name: server.team_name,
      team_slug: server.team_slug,
      team_id: server.team_id
    })
  };
}
