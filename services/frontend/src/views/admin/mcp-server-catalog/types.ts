/* eslint-disable @typescript-eslint/no-explicit-any */

export interface McpServer {
  id: string
  name: string
  slug: string
  description: string
  long_description?: string
  github_account_id?: string
  icon_url?: string
  github_stars?: number
  // Repository platform fields
  repository_url?: string
  repository_source?: string // 'github', 'gitlab', 'bitbucket', etc.
  repository_id?: string // Platform-specific repository ID
  repository_subfolder?: string // For monorepos
  git_branch?: string
  website_url?: string
  language: string
  runtime: string
  packages: any
  remotes: any
  resources?: McpResource[]
  prompts?: McpPrompt[]
  visibility: 'global' | 'team'
  owner_team_id?: string | null
  created_by: string
  author_name?: string
  author_contact?: string
  organization?: string
  license?: string
  transport_type?: 'stdio' | 'http' | 'sse'
  requires_oauth?: boolean
  skip_oauth_flow?: boolean

  // New three-tier schema fields
  template_args?: TemplateArg[] | string
  template_env?: TemplateEnvVar[] | string
  template_headers?: TemplateHeaderVar[] | string
  template_url_query_params?: TemplateUrlQueryParam[] | string
  team_args_schema?: TeamArgsSchema[] | string
  team_env_schema?: TeamEnvSchema[] | string
  team_headers_schema?: TeamHeadersSchema[] | string
  team_url_query_params_schema?: TeamUrlQueryParamsSchema[] | string
  user_args_schema?: UserArgsSchema[] | string
  user_env_schema?: UserEnvSchema[] | string
  user_headers_schema?: UserHeadersSchema[] | string
  user_url_query_params_schema?: UserUrlQueryParamsSchema[] | string

  dependencies?: Record<string, any>
  category_id?: string
  category?: {
    id: string
    name: string
    icon: string | null
  } | null
  tags?: string[]
  status: 'active' | 'deprecated' | 'maintenance' | 'disabled'
  featured: boolean
  auto_install_new_default_team: boolean
  source: 'official_registry' | 'manual' | 'github'
  created_at: string
  updated_at: string
  last_sync_at?: string
  github_readme_base64?: string
  // Team information (present when server belongs to a team)
  team_name?: string
  team_slug?: string
  team_id?: string
}

// Extend McpServer type to include team information for deployments
export interface McpServerWithTeam extends McpServer {
  team_name: string
  team_slug: string
  team_id: string
}

// Deployment-specific server type
export interface McpServerDeployment extends McpServer {
  source: 'github'
  owner_team_id: string  // Required for deployments
  team_name: string      // Required for deployments
}

export interface McpCategory {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  sort_order: number
  created_at: string
}

export interface InstallationMethod {
  client: 'claude-desktop' | string
  command?: string
  args?: string[]
  env?: Record<string, string>
  // New fields for remote MCP servers
  url?: string
  type?: 'streamableHttp' | 'stdio' | 'http' | 'sse'
  headers?: Record<string, string>
}

export interface McpTool {
  name: string
  description: string
}

export interface McpResource {
  type: string
  description: string
}

export interface McpPrompt {
  name: string
  description: string
}

export interface EnvironmentVariable {
  name: string
  description: string
  required: boolean
}



// New three-tier schema type definitions
export interface TemplateArg {
  value: string
  locked: boolean
  description?: string
}

export interface TemplateEnvVar {
  name: string
  value: string
  locked: boolean
  description?: string
}

export interface TemplateHeaderVar {
  name: string
  value: string
  locked: boolean
  description?: string
}

export interface TemplateUrlQueryParam {
  name: string
  value: string
  locked: boolean
  description?: string
}

export interface TeamArgsSchema {
  name: string
  type: 'string' | 'number' | 'boolean'
  description?: string
  required: boolean
  locked: boolean
  default_value?: string
}

export interface TeamEnvSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean
  default_value?: string
}

export interface TeamHeadersSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean
  default_value?: string
}

export interface TeamUrlQueryParamsSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean
  default_value?: string
}

export interface UserArgsSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_value?: string
}

export interface UserEnvSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_value?: string
}

export interface UserHeadersSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_value?: string
}

export interface UserUrlQueryParamsSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description?: string
  required: boolean
  locked: boolean
  default_value?: string
}

export interface CreateMcpServerRequest {
  name: string
  description: string
  long_description?: string
  github_account_id?: string
  icon_url?: string
  github_stars?: number
  // Repository platform fields
  repository_url?: string
  repository_source?: string
  repository_id?: string
  repository_subfolder?: string
  git_branch?: string
  website_url?: string
  language?: string
  runtime?: string
  packages?: any
  remotes?: any
  resources?: McpResource[]
  prompts?: McpPrompt[]
  visibility: 'global' | 'team'
  author_name?: string
  author_contact?: string
  organization?: string
  license?: string
  transport_type?: 'stdio' | 'http' | 'sse'
  requires_oauth?: boolean
  skip_oauth_flow?: boolean

  // New three-tier schema fields
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  template_headers?: TemplateHeaderVar[]
  template_url_query_params?: TemplateUrlQueryParam[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  team_headers_schema?: TeamHeadersSchema[]
  team_url_query_params_schema?: TeamUrlQueryParamsSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
  user_headers_schema?: UserHeadersSchema[]
  user_url_query_params_schema?: UserUrlQueryParamsSchema[]

  dependencies?: Record<string, any>
  category_id?: string
  tags?: string[]
  featured?: boolean
  auto_install_new_default_team?: boolean
  // NEW: Claude Desktop configuration for automatic extraction
  claude_desktop_config?: Record<string, any>
}

export interface UpdateMcpServerRequest {
  name?: string
  slug?: string
  description?: string
  long_description?: string
  github_account_id?: string
  icon_url?: string
  github_readme_base64?: string
  github_stars?: number
  // Repository platform fields
  repository_url?: string
  repository_source?: string
  repository_id?: string
  repository_subfolder?: string
  git_branch?: string | null
  website_url?: string
  language?: string
  runtime?: string
  packages?: any
  remotes?: any
  resources?: McpResource[]
  prompts?: McpPrompt[]
  author_name?: string
  author_contact?: string
  organization?: string
  license?: string
  transport_type?: 'stdio' | 'http' | 'sse'
  requires_oauth?: boolean
  skip_oauth_flow?: boolean

  // New three-tier schema fields
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  template_headers?: TemplateHeaderVar[]
  template_url_query_params?: TemplateUrlQueryParam[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  team_headers_schema?: TeamHeadersSchema[]
  team_url_query_params_schema?: TeamUrlQueryParamsSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
  user_headers_schema?: UserHeadersSchema[]
  user_url_query_params_schema?: UserUrlQueryParamsSchema[]

  dependencies?: Record<string, any>
  category_id?: string
  tags?: string[]
  status?: 'active' | 'deprecated' | 'maintenance' | 'disabled'
  featured?: boolean
  auto_install_new_default_team?: boolean
}

export interface McpServerFilters {
  visibility?: 'global' | 'team'
  category_id?: string
  language?: string
  runtime?: string
  status?: 'active' | 'deprecated' | 'maintenance' | 'disabled'
  featured?: boolean
  search?: string
}

// Form step data interfaces
export interface BasicInfoFormData {
  name: string
  slug?: string
  description: string
  long_description: string
  category_id: string
  author_name: string
  author_contact: string
  organization: string
  license: string
  tags: string[]
  featured: boolean
  auto_install_new_default_team: boolean
  skip_oauth_flow: boolean
  website_url: string
  icon_url?: string
  language: string
  runtime: string
}

export interface RepositoryFormData {
  repository_url: string
  repository_source: string // 'github', 'gitlab', 'bitbucket', etc.
  repository_id?: string // Platform-specific repository ID
  repository_subfolder?: string // For monorepos
  git_branch: string
  website_url: string
}

export interface TechnicalFormData {
  language: string
  runtime: string
  packages?: any
  remotes?: any
  installation_methods?: InstallationMethod[]
  dependencies: string
  transport_type: string
}



export interface RepositorySetupFormData {
  repository_url: string
  repository_source: string
  git_branch: string
  auto_populated?: boolean
  repo_data?: any
}

export type ReviewFormData = object

export interface ConfigurationSchemaFormData {
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  template_headers?: TemplateHeaderVar[]
  template_url_query_params?: TemplateUrlQueryParam[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  team_headers_schema?: TeamHeadersSchema[]
  team_url_query_params_schema?: TeamUrlQueryParamsSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
  user_headers_schema?: UserHeadersSchema[]
  user_url_query_params_schema?: UserUrlQueryParamsSchema[]
}

export interface ReadmeFormData {
  github_readme_base64: string
}

export interface McpServerFormData {
  basic: BasicInfoFormData
  repository: RepositoryFormData
  technical: TechnicalFormData
  configuration_schema: ConfigurationSchemaFormData
  repository_setup: RepositorySetupFormData
  readme: ReadmeFormData
  review: ReviewFormData
}

// Form step configuration
export interface FormStep {
  key: keyof McpServerFormData | 'repository'
  label: string
  icon: any
  component: any
}

// Extended FormStep for wizard with additional keys
export interface ExtendedFormStep {
  key: keyof McpServerFormData | 'configurationSchema' | 'repository'
  label: string
  icon: any
  component: any
}

// Language and runtime options
export const LANGUAGE_OPTIONS = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'other', label: 'Other' }
]

export const RUNTIME_OPTIONS = [
  { value: 'node', label: 'Node.js' },
  { value: 'python', label: 'Python' },
  { value: 'docker', label: 'Docker' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'dotnet', label: '.NET' },
  { value: 'other', label: 'Other' }
]

export const CLIENT_TYPE_OPTIONS = [
  { value: 'claude-desktop', label: 'Claude Desktop' }
]

export const INSTALLATION_TYPE_OPTIONS = [
  { value: 'npm', label: 'npm' },
  { value: 'pip', label: 'pip' },
  { value: 'docker', label: 'Docker' },
  { value: 'git', label: 'Git Clone' },
  { value: 'binary', label: 'Binary Download' },
  { value: 'other', label: 'Other' }
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'disabled', label: 'Disabled' }
]

export const TRANSPORT_TYPE_OPTIONS = [
  { value: 'auto', label: 'Extract from Claude Desktop Configuration' },
  { value: 'stdio', label: 'stdio (Standard Input/Output)' },
  { value: 'http', label: 'http (HTTP Transport)' },
  { value: 'sse', label: 'sse (Server-Sent Events)' }
]
