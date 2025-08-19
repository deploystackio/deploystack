// MCP protocol types and installation management

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// MCP Server Installation from API
export interface MCPInstallation {
  id: string;
  team_id: string;
  server_id: string;
  user_id: string;
  installation_name: string;
  installation_type: 'local' | 'cloud';
  user_environment_variables: Record<string, string>;
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

// MCP Installation API Response
export interface MCPInstallationsResponse {
  success: boolean;
  data: MCPInstallation[];
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

// Team MCP Configuration stored securely
export interface TeamMCPConfig {
  team_id: string;
  team_name: string;
  installations: MCPInstallation[];
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
