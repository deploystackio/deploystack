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
  category_id?: string
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
  installation_type: 'local' | 'cloud'
  user_environment_variables: Record<string, string>
  team_id: string
  user_id: string
  created_at: string
  updated_at: string
  last_used_at: string | null
}

export interface InstallServerRequest {
  server_id: string
  installation_name: string
  installation_type: 'local'
  user_environment_variables: Record<string, string>
}
