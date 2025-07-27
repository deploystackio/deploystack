// MCP protocol types
// TODO: Define MCP protocol types and interfaces

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MCPRequest {
  // Placeholder for MCP request types
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MCPResponse {
  // Placeholder for MCP response types
}
