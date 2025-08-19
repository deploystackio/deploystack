/* eslint-disable @typescript-eslint/no-explicit-any */

export interface McpServer {
  id: string
  name: string
  slug: string
  description: string
  long_description?: string
  github_url?: string
  git_branch?: string
  homepage_url?: string
  language: string
  runtime: string
  runtime_min_version?: string
  installation_methods: InstallationMethod[]
  tools: McpTool[]
  resources?: McpResource[]
  prompts?: McpPrompt[]
  visibility: 'global' | 'team'
  owner_team_id?: string
  created_by: string
  author_name?: string
  author_contact?: string
  organization?: string
  license?: string
  transport_type?: 'stdio' | 'http' | 'sse'
  environment_variables?: EnvironmentVariable[]
  dependencies?: Record<string, any>
  category_id?: string
  tags?: string[]
  status: 'active' | 'deprecated' | 'maintenance'
  featured: boolean
  auto_install_new_default_team: boolean
  created_at: string
  updated_at: string
  last_sync_at?: string
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
  client: 'claude-desktop'
  command: string
  args: string[]
  env: Record<string, string>
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

export interface CreateMcpServerRequest {
  name: string
  description: string
  long_description?: string
  github_url?: string
  git_branch?: string
  homepage_url?: string
  language?: string
  runtime?: string
  runtime_min_version?: string
  installation_methods?: InstallationMethod[]
  tools?: McpTool[]
  resources?: McpResource[]
  prompts?: McpPrompt[]
  visibility: 'global' | 'team'
  author_name?: string
  author_contact?: string
  organization?: string
  license?: string
  transport_type?: 'stdio' | 'http' | 'sse'
  environment_variables?: EnvironmentVariable[]
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
  description?: string
  long_description?: string
  github_url?: string
  git_branch?: string
  homepage_url?: string
  language?: string
  runtime?: string
  runtime_min_version?: string
  installation_methods?: InstallationMethod[]
  tools?: McpTool[]
  resources?: McpResource[]
  prompts?: McpPrompt[]
  author_name?: string
  author_contact?: string
  organization?: string
  license?: string
  transport_type?: 'stdio' | 'http' | 'sse'
  environment_variables?: EnvironmentVariable[]
  dependencies?: Record<string, any>
  category_id?: string
  tags?: string[]
  status?: 'active' | 'deprecated' | 'maintenance'
  featured?: boolean
  auto_install_new_default_team?: boolean
}

export interface McpServerFilters {
  visibility?: 'global' | 'team'
  category_id?: string
  language?: string
  runtime?: string
  status?: 'active' | 'deprecated' | 'maintenance'
  featured?: boolean
  search?: string
}

// Form step data interfaces
export interface BasicInfoFormData {
  name: string
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
}

export interface RepositoryFormData {
  github_url: string
  git_branch: string
  homepage_url: string
}

export interface TechnicalFormData {
  language: string
  runtime: string
  runtime_min_version: string
  installation_methods: InstallationMethod[]
  dependencies: string
  transport_type: string
}

export interface CapabilitiesFormData {
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  environment_variables: EnvironmentVariable[]
}

export interface GitHubFormData {
  github_url: string
  git_branch: string
  auto_populated?: boolean
  repo_data?: any
}

export type ReviewFormData = object

export interface McpServerFormData {
  basic: BasicInfoFormData
  repository: RepositoryFormData
  technical: TechnicalFormData
  capabilities: CapabilitiesFormData
  github: GitHubFormData
  review: ReviewFormData
}

// Form step configuration
export interface FormStep {
  key: keyof McpServerFormData
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
  { value: 'maintenance', label: 'Maintenance' }
]

export const TRANSPORT_TYPE_OPTIONS = [
  { value: 'auto', label: 'Extract from Claude Desktop Configuration' },
  { value: 'stdio', label: 'stdio (Standard Input/Output)' },
  { value: 'http', label: 'http (HTTP Transport)' },
  { value: 'sse', label: 'sse (Server-Sent Events)' }
]
