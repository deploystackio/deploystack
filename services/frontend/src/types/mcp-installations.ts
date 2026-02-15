/* eslint-disable @typescript-eslint/no-explicit-any */
export interface McpServer {
  // Fields always present (list view)
  id: string
  runtime: string
  icon_url?: string | null
  category_id?: string

  // Fields only present in detail view (optional)
  name?: string
  description?: string
  language?: string
  status?: 'active' | 'deprecated' | 'maintenance'
  author_name?: string | null
  website_url?: string | null
  repository_url?: string | null
  repository_source?: string | null
  repository_id?: string | null
  repository_subfolder?: string | null
  source?: 'official_registry' | 'manual' | 'github'
  git_branch?: string | null
  git_commit_sha?: string | null
  slug?: string
  tags?: string[] | null
  environment_variables?: EnvironmentVariable[]
  transport_type?: 'stdio' | 'http' | 'sse'
  installation_methods?: any[]
  packages?: any | null
  remotes?: any | null
  requires_oauth?: boolean
  skip_oauth_flow?: boolean
  // Three-tier configuration schema fields
  template_args?: any[] | null
  template_env?: Record<string, string> | null
  template_headers?: Record<string, string> | null
  team_args_schema?: any[] | null
  team_env_schema?: any[] | null
  team_headers_schema?: any[] | null
  team_url_query_params_schema?: any[] | null
  user_args_schema?: any[] | null
  user_env_schema?: any[] | null
  user_headers_schema?: any[] | null
  user_url_query_params_schema?: any[] | null
}

export interface EnvironmentVariable {
  name: string
  description: string
  required: boolean
  type: 'text' | 'password' | 'number' | 'url'
  validation?: string
  placeholder?: string
}

export type InstallationStatus =
  | 'provisioning'
  | 'command_received'
  | 'connecting'
  | 'discovering_tools'
  | 'syncing_tools'
  | 'online'
  | 'restarting'
  | 'offline'
  | 'error'
  | 'requires_reauth'
  | 'permanently_failed'

export interface InstallationStatusData {
  installation_id: string
  instance_id: string
  user_id: string
  user_slug: string
  status: InstallationStatus
  status_message: string | null
  status_updated_at: string
  last_health_check_at: string | null
}

export interface McpInstallationInstance {
  id: string
  user_id: string
  user_slug: string
  user_email: string
  instance_path?: string | null
  instance_token?: string | null
  status: string
  status_message: string | null
  status_updated_at: string
  last_health_check_at: string | null
  created_at: string
  updated_at: string
}

export interface McpInstallation {
  // Fields always present (list view)
  id: string
  installation_name: string
  installation_type: 'global' | 'team'
  team_id: string
  team_slug?: string
  created_at: string
  last_used_at: string | null
  server?: McpServer

  // Fields only present in detail view (optional)
  server_id?: string
  satellite_id?: string
  satellite_url?: string | null
  user_environment_variables?: Record<string, string>
  team_args?: string[]
  team_env?: Record<string, string>
  team_headers?: Record<string, string>
  team_url_query_params?: Record<string, string>
  user_id?: string
  updated_at?: string
  instance_id?: string
  user_slug?: string
  status?: InstallationStatus
  status_message?: string | null
  status_updated_at?: string
  last_health_check_at?: string | null
  instances?: McpInstallationInstance[]
}

export interface InstallServerRequest {
  server_id: string
  installation_name: string
  installation_type: 'global' | 'team'
  user_environment_variables: Record<string, string>
}

export interface UserConfiguration {
  id: string
  installation_id: string
  user_id: string
  device_id: string
  device_name?: string
  user_args?: Record<string, string>
  user_env?: Record<string, string>
  user_headers?: Record<string, string>
  user_url_query_params?: Record<string, string>
  created_at: string
  updated_at: string
  last_used_at?: string
}

export interface CreateUserConfigRequest {
  device_id?: string
  user_args?: Record<string, string>
  user_env?: Record<string, string>
  user_headers?: Record<string, string>
  user_url_query_params?: Record<string, string>
}

export interface UpdateUserConfigRequest {
  device_id?: string
  user_args?: Record<string, string>
  user_env?: Record<string, string>
  user_headers?: Record<string, string>
  user_url_query_params?: Record<string, string>
}
