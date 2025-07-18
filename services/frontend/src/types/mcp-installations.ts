export interface McpServer {
  id: string
  name: string
  description: string
  language: string
  runtime: string
  status: 'active' | 'deprecated' | 'maintenance'
  author_name?: string
  homepage_url?: string
  github_url?: string
  tags?: string[]
  environment_variables?: EnvironmentVariable[]
}

export interface EnvironmentVariable {
  name: string
  description: string
  required: boolean
  type: 'text' | 'password' | 'number' | 'url'
  validation?: string
  placeholder?: string
}

export interface McpInstallation {
  id: string
  installation_name: string
  server_id: string
  server: McpServer
  status: 'active' | 'error' | 'installing' | 'stopped'
  user_environment_variables: Record<string, string>
  team_id: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface InstallServerRequest {
  server_id: string
  installation_name: string
  installation_type: 'local'
  user_environment_variables: Record<string, string>
}
