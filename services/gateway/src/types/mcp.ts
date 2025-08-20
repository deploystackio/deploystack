// MCP protocol types and installation management

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// MCP Server Installation from API (Three-tier architecture)
export interface MCPInstallation {
  id: string;
  team_id: string;
  server_id: string;
  created_by: string;
  installation_name: string;
  installation_type: 'local' | 'cloud';
  team_args: string[] | null;
  team_env: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  server: {
    id: string;
    name: string;
    description: string;
    github_url: string | null;
    runtime: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installation_methods: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    environment_variables: any[];
    transport_type: 'stdio' | 'http' | 'sse';
  };
}

// MCP User Configuration from API (Three-tier architecture)
export interface MCPUserConfiguration {
  id: string;
  installation_id: string;
  user_id: string;
  device_name: string | null;
  user_args: string[] | null;
  user_env: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

// MCP Installation API Response
export interface MCPInstallationsResponse {
  success: boolean;
  data: MCPInstallation[];
}

// MCP User Configurations API Response
export interface MCPUserConfigurationsResponse {
  success: boolean;
  data: MCPUserConfiguration[];
  message?: string;
}

// Processed MCP Server Config for Gateway
export interface MCPServerConfig {
  id: string;
  name: string;
  installation_name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  runtime: string;
  installation_type: 'local' | 'cloud';
  transport_type: 'stdio' | 'http' | 'sse';
}

// Team MCP Configuration stored securely (Three-tier architecture)
export interface TeamMCPConfig {
  team_id: string;
  team_name: string;
  installations: MCPInstallation[];
  user_configurations: MCPUserConfiguration[];
  servers: MCPServerConfig[];
  last_updated: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MCPRequest {
  // Placeholder for MCP request types
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MCPResponse {
  // Placeholder for MCP response types
}
