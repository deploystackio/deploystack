// MCP protocol types
// TODO: Define MCP protocol types and interfaces

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPRequest {
  // Placeholder for MCP request types
}

export interface MCPResponse {
  // Placeholder for MCP response types
}
